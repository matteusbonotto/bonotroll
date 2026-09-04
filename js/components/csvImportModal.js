import { parseCsvFile, applyMapping, IMPORT_TARGETS, normalizarDataCsv, baixarTemplateCsv } from '../services/csvImport.js';
import { createTransaction } from '../services/transactions.js';
import { createCategory } from '../services/categories.js';
import { createCompany, updateCompany } from '../services/companies.js';
import { todayIso, MOEDAS_SUPORTADAS } from '../utils/format.js';
import * as sl from '../services/shoppingList.js';
import * as res from '../services/resources.js';
import * as cx from '../services/caixinhas.js';

// Modal global de importação de CSV (Alpine.store('csvModal')) — reaproveitado
// para transações e para itens de lista de compras.
export function csvModalStore() {
  return {
    open: false,
    step: 'upload', // upload -> map -> preview -> resultado
    target: 'transacoes',
    listId: null,
    headers: [],
    rawRows: [],
    mapping: {},
    result: { ok: 0, pulados: 0, erros: [] },
    IMPORT_TARGETS,

    openFor(target, listId = null) {
      this.target = target;
      this.listId = listId;
      this.step = 'upload';
      this.headers = [];
      this.rawRows = [];
      this.mapping = {};
      this.result = { ok: 0, pulados: 0, erros: [] };
      // Cache de cômodos/subcategorias/itens já resolvidos NESTE import (ver
      // resolveComodo/resolveSubcategoria/itemDuplicado) — zerado a cada
      // abertura pra não arrastar estado de uma importação anterior na
      // mesma sessão.
      this._roomsCache = null;
      this._catCache = {};
      this._itemsCache = null;
      this.open = true;
    },

    close() {
      this.open = false;
    },

    fields() {
      return this.IMPORT_TARGETS[this.target].fields;
    },

    async onFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const { headers, rows } = await parseCsvFile(file);
      this.headers = headers;
      this.rawRows = rows;
      this.mapping = {};
      for (const f of this.fields()) {
        // Match exato primeiro (ex: cabeçalho "tipo_despesa" tem que ganhar
        // do campo "tipo_despesa" antes de "tipo" tentar um match por
        // substring — senão "tipo" e "tipo_despesa" colidiam no mesmo
        // cabeçalho "tipo" e um dos dois ficava sem coluna nenhuma).
        const exact = headers.find((h) => h.toLowerCase() === f.key.toLowerCase());
        if (exact) {
          this.mapping[f.key] = exact;
          continue;
        }
        const chave = f.key.split('_')[0].toLowerCase();
        const match = headers.find((h) => h.toLowerCase().includes(chave));
        if (match) this.mapping[f.key] = match;
      }
      this.step = 'map';
    },

    avancarPreview() {
      this.step = 'preview';
    },

    baixarModelo() {
      baixarTemplateCsv(this.target);
    },

    async confirmar() {
      const store = Alpine.store('app');
      const mapeadas = applyMapping(this.rawRows, this.mapping);
      let ok = 0;
      const erros = [];

      for (const [i, row] of mapeadas.entries()) {
        try {
          if (this.target === 'transacoes') {
            if (!row.titulo || !row.valor) throw new Error('título e valor são obrigatórios');
            const pago = /^(pago|quitado|pg|paid)/i.test(row.status || '');
            const parcelaAtual = row.parcela_atual ? Number(row.parcela_atual) || null : null;
            const parcelaTotal = row.parcela_total ? Number(row.parcela_total) || null : null;
            const dataVencimento = normalizarDataCsv(row.data_vencimento);
            // "Pago em" usa a coluna própria (data_pagamento) quando o
            // usuário mapeou uma — antes, toda linha marcada como paga
            // gravava a mesma data do vencimento nos dois campos, sem jeito
            // de importar uma data de pagamento de verdade. Sem essa coluna
            // mapeada, mantém o comportamento antigo como fallback: paga sem
            // data própria assume o vencimento (ou hoje, se nem isso vier).
            const dataPagamento = normalizarDataCsv(row.data_pagamento) || (pago ? dataVencimento || todayIso() : null);
            await createTransaction({
              tipo: (row.tipo || 'saida').toLowerCase().startsWith('entr') ? 'entrada' : 'saida',
              titulo: row.titulo,
              empresa_servico: row.empresa_servico || null,
              categoria_id: await this.resolveCategoria(row.categoria_nome),
              tipo_despesa: (row.tipo_despesa || 'variavel').toLowerCase().startsWith('fix') ? 'fixa' : 'variavel',
              valor: Number(String(row.valor).replace(',', '.')) || 0,
              data_vencimento: dataVencimento,
              data_pagamento: dataPagamento,
              responsavel_id: await this.resolveResponsavel(row.responsavel_nome),
              owner_id: store.profile.id,
              group_id: store.group?.group?.id ?? null,
              parcela_atual: parcelaAtual,
              parcela_total: parcelaTotal,
              observacoes: row.observacoes || null,
            });
            await this.resolveEmpresa(row.empresa_servico, row.empresa_logo_url);
          } else if (this.target === 'recursos') {
            if (!row.nome) throw new Error('nome do item é obrigatório');
            if (!row.comodo_nome) throw new Error('cômodo é obrigatório');
            const room = await this.resolveComodo(row.comodo_nome);
            const categoria = await this.resolveSubcategoria(room, row.subcategoria_nome);
            // Sem isso, reimportar o mesmo CSV (ex.: reabrir o mesmo
            // arquivo de itens essenciais por engano) duplicava tudo — cada
            // linha virava um item NOVO sempre, nunca reaproveitando um já
            // existente com o mesmo nome no mesmo cômodo/subcategoria
            // (reportado pelo usuário). "Já existe" pula a linha (não é
            // erro, só não cria de novo); quem quiser AJUSTAR quantidade de
            // um item repetido faz isso na tela de Recursos mesmo.
            if (await this.itemDuplicado(room, categoria, row.nome)) {
              this.result.pulados++;
              continue;
            }
            const criado = await res.createItem({
              nome: row.nome,
              room_id: room.id,
              category_id: categoria?.id || null,
              quantidade: Number(String(row.quantidade || 1).replace(',', '.')) || 1,
              data_validade: normalizarDataCsv(row.data_validade),
              icone: row.icone || null,
              foto_url: row.foto_url || null,
              owner_id: store.profile.id,
              group_id: store.group?.group?.id ?? null,
            });
            this._itemsCache.push(criado);
          } else if (this.target === 'itens_compra') {
            if (!row.nome) throw new Error('nome do item é obrigatório');
            const unidade = ['kg', 'g'].includes((row.unidade || '').toLowerCase()) ? row.unidade.toLowerCase() : 'un';
            await sl.addItem(this.listId, {
              nome: row.nome,
              categoria_id: await this.resolveCategoria(row.categoria_nome),
              unidade,
              quantidade: Number(String(row.quantidade || 1).replace(',', '.')) || 1,
            });
          } else {
            // caixinhas: sem find-or-create por nome — banco_nome não é
            // único aqui (a própria tela permite mais de uma caixinha no
            // mesmo banco, ex.: moedas diferentes), então cada linha vira
            // uma caixinha nova, igual a "Nova caixinha" manual.
            if (!row.banco_nome) throw new Error('banco é obrigatório');
            const meta = row.meta ? Number(String(row.meta).replace(',', '.')) || null : null;
            const valorInicial = row.valor_inicial ? Number(String(row.valor_inicial).replace(',', '.')) || 0 : 0;
            const moeda = (row.moeda || 'BRL').toUpperCase();
            // Valida contra a lista real de moedas que o app sabe converter
            // (MOEDAS_SUPORTADAS) — sem isso, um código digitado errado no
            // CSV ("REAL" em vez de "BRL") criava a caixinha mesmo assim e
            // ela ficava com símbolo/cotação errados pra sempre, sem aviso
            // nenhum na hora que daria pra corrigir fácil.
            if (moeda && !MOEDAS_SUPORTADAS.some((m) => m.codigo === moeda)) {
              throw new Error(`moeda "${row.moeda}" não reconhecida (use ${MOEDAS_SUPORTADAS.map((m) => m.codigo).join(', ')})`);
            }
            const caixinha = await cx.createCaixinha({
              bancoNome: row.banco_nome,
              moeda,
              meta,
              icone: row.icone || null,
              ownerId: store.profile.id,
              groupId: store.group?.group?.id ?? null,
            });
            // Valor inicial é opcional: cria a caixinha vazia mesmo sem ele
            // (mesmo fluxo de "Nova caixinha" manual, que também começa
            // zerada até o primeiro aporte) em vez de falhar a linha.
            if (valorInicial > 0) {
              await cx.createMovimentacao({ caixinhaId: caixinha.id, tipo: 'guardado', valor: valorInicial, data: todayIso() });
            }
          }
          ok++;
        } catch (e) {
          erros.push({ linha: i + 2, motivo: e.message });
        }
      }

      this.result = { ok, erros };
      this.step = 'resultado';
      window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
      window.dispatchEvent(new CustomEvent('cg:shopping-changed'));
      window.dispatchEvent(new CustomEvent('cg:recursos-changed'));
      window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
    },

    // Casa o nome da coluna "comodo" com um cômodo já existente (cria os
    // padrão via ensureDefaultRooms se ainda não existirem, igual ao
    // primeiro acesso à tela de Recursos) — sem match, cria um cômodo novo
    // com esse nome em vez de falhar a linha inteira.
    async resolveComodo(nome) {
      const store = Alpine.store('app');
      if (!this._roomsCache) {
        this._roomsCache = await res.ensureDefaultRooms(store.profile.id, store.group?.group?.id);
      }
      const alvo = nome.trim().toLowerCase();
      let room = this._roomsCache.find((r) => r.nome.trim().toLowerCase() === alvo);
      if (!room) {
        room = await res.createRoom({ nome: nome.trim(), ownerId: store.profile.id, groupId: store.group?.group?.id });
        this._roomsCache.push(room);
      }
      return room;
    },

    async resolveSubcategoria(room, nome) {
      if (!nome) return null;
      if (!this._catCache[room.id]) {
        this._catCache[room.id] = await res.listRoomCategories(room.id);
      }
      const alvo = nome.trim().toLowerCase();
      let categoria = this._catCache[room.id].find((c) => c.nome.trim().toLowerCase() === alvo);
      if (!categoria) {
        categoria = await res.createRoomCategory({ roomId: room.id, nome: nome.trim() });
        this._catCache[room.id].push(categoria);
      }
      return categoria;
    },

    // Mesmo nome (normalizado), mesmo cômodo E mesma subcategoria já
    // existente — "Arroz" em Cozinha/Armário não conta como duplicata de
    // "Arroz" em Cozinha/Geladeira, são coisas diferentes de verdade.
    async itemDuplicado(room, categoria, nome) {
      if (!this._itemsCache) {
        const store = Alpine.store('app');
        this._itemsCache = await res.listAllItems({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      }
      const alvo = nome.trim().toLowerCase();
      const categoriaId = categoria?.id || null;
      return this._itemsCache.some(
        (it) => it.room_id === room.id && (it.category_id || null) === categoriaId && it.nome.trim().toLowerCase() === alvo
      );
    },

    async resolveCategoria(nome) {
      if (!nome) return null;
      const store = Alpine.store('app');
      const alvo = nome.trim().toLowerCase();
      let cat = store.categories.find((c) => c.nome.trim().toLowerCase() === alvo);
      if (!cat) {
        try {
          cat = await createCategory({ nome: nome.trim(), ownerId: store.profile.id, groupId: store.group?.group?.id });
        } catch (e) {
          // 23505 = outra linha do MESMO import (ou uma corrida com outra
          // aba) já criou essa categoria entre o find() e o createCategory()
          // acima — não é erro de verdade, só significa que ela já existe;
          // busca de novo em vez de deixar a linha inteira falhar.
          if (e?.code !== '23505') throw e;
        }
        await store.refreshCategories();
        if (!cat) cat = store.categories.find((c) => c.nome.trim().toLowerCase() === alvo);
      }
      return cat.id;
    },

    // Casa o nome da coluna "responsavel" com um membro do grupo (dono da
    // conta incluído) — sem coluna, sem match, ou importando fora de um
    // grupo, cai pra quem está importando (mesmo comportamento de antes
    // dessa coluna existir).
    resolveResponsavel(nome) {
      const store = Alpine.store('app');
      if (!nome) return store.profile.id;
      const alvo = nome.trim().toLowerCase();
      const membros = [store.profile, ...(store.group?.members || [])];
      const achado = membros.find((m) => m?.nome?.trim().toLowerCase() === alvo);
      return achado ? achado.id : store.profile.id;
    },

    // Find-or-create de empresa/serviço (mesmo find-or-create que
    // transactionForm.js::syncEmpresa faz depois de salvar manualmente) —
    // só que aqui o logo pode vir pronto de uma coluna do próprio CSV
    // (colada pelo usuário, nunca adivinhada por mim).
    async resolveEmpresa(nome, logoUrl) {
      if (!nome) return;
      const store = Alpine.store('app');
      const existente = store.companyByName(nome);
      if (!existente) {
        await createCompany({ nome, logoUrl: logoUrl || null, ownerId: store.profile.id, groupId: store.group?.group?.id });
      } else if (logoUrl && !existente.logo_url) {
        await updateCompany(existente.id, { logo_url: logoUrl });
      } else {
        return; // nada novo — evita um refreshCompanies() por linha à toa
      }
      await store.refreshCompanies();
    },
  };
}
