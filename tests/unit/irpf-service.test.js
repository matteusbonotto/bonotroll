// services/irpf.js no modo demonstração (mockDb em memória): importação,
// arquivo inválido, duplicidade, revisão, isolamento entre usuários e IA
// simulada. Leitura de PDF/OCR é injetada (deps.lerPaginas) — sem rede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as irpf from '../../js/services/irpf.js';
import { FalhaIa } from '../../js/services/ia.js';
import { calcularResumo } from '../../js/irpf/calculo.js';
import { informeEmpregador, informeBanco } from '../fixtures/irpf/sinteticos.js';

const PDF = (nome, conteudo = 'corpo') => new File([`%PDF-1.4\n${conteudo}`], nome, { type: 'application/pdf' });
const leitor = (paginas) => ({ lerPaginas: async () => ({ paginas, paginasTotal: paginas.length }) });

async function novaDeclaracao(dono = `u-${Math.random()}`) {
  return { dono, decl: await irpf.abrirDeclaracao(dono, 2026) };
}

test('abrirDeclaracao é find-or-create por dono e exercício', async () => {
  const { dono, decl } = await novaDeclaracao();
  const de2 = await irpf.abrirDeclaracao(dono, 2026);
  assert.equal(de2.id, decl.id);
  await assert.rejects(irpf.abrirDeclaracao(dono, 2010), /não suportado/);
});

test('importação de informe válido → itens "importado", nada conta até confirmar', async () => {
  const { dono, decl } = await novaDeclaracao();
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('informe.pdf'), deps: leitor(informeEmpregador()) });
  assert.equal(r.documento.status, 'processado');
  assert.equal(r.documento.extraidoPor, 'local');
  assert.ok(r.itens.every((i) => i.revisao === 'importado'));
  const dados = await irpf.carregarDeclaracao(decl.id, dono);
  const antes = calcularResumo({ exercicio: 2026, ...dados, respostas: {} });
  assert.equal(antes.totais.tributavel, 0);
  for (const i of dados.itens) await irpf.atualizarItem(i.id, { revisao: 'confirmado' });
  const depois = calcularResumo({ exercicio: 2026, ...(await irpf.carregarDeclaracao(decl.id, dono)), respostas: {} });
  assert.equal(depois.totais.tributavel, 4800000);
});

test('arquivo inválido: tipo, vazio, grande e conteúdo que não bate com a extensão', async () => {
  const { dono, decl } = await novaDeclaracao();
  assert.match(irpf.validarArquivo(new File(['x'], 'a.exe')), /não aceito/);
  assert.match(irpf.validarArquivo(new File([], 'a.pdf')), /vazio/);
  const grande = { name: 'a.pdf', size: irpf.LIMITE_BYTES + 1, type: 'application/pdf' };
  assert.match(irpf.validarArquivo(grande), /10 MB/);
  const falso = new File(['não sou pdf'], 'falso.pdf', { type: 'application/pdf' });
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: falso });
  assert.equal(r.documento.status, 'rejeitado');
  assert.match(r.documento.motivo, /não corresponde/);
});

test('PDF corrompido/protegido vira "rejeitado" com motivo, sem quebrar o lote', async () => {
  const { dono, decl } = await novaDeclaracao();
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('senha.pdf'), deps: { lerPaginas: async () => { throw new Error('PasswordException'); } } });
  assert.equal(r.documento.status, 'rejeitado');
  assert.match(r.documento.motivo, /senha/);
});

test('mesmo arquivo não é importado de novo; mesmo conteúdo fica marcado como duplicado', async () => {
  const { dono, decl } = await novaDeclaracao();
  const a = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('informe.pdf'), deps: leitor(informeEmpregador()) });
  const existentes = [a.documento];
  const repetido = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('informe (1).pdf'), existentes, deps: leitor(informeEmpregador()) });
  assert.equal(repetido.naoGravado, true);
  const outraCopia = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('informe-email.pdf', 'outros bytes'), existentes, deps: leitor(informeEmpregador()) });
  assert.equal(outraCopia.documento.status, 'duplicado');
  assert.equal(outraCopia.documento.duplicadoDe, a.documento.id);

  // Confirma tudo: mesmo assim o salário conta UMA vez.
  let dados = await irpf.carregarDeclaracao(decl.id, dono);
  for (const i of dados.itens) await irpf.atualizarItem(i.id, { revisao: 'confirmado' });
  dados = await irpf.carregarDeclaracao(decl.id, dono);
  assert.equal(calcularResumo({ exercicio: 2026, ...dados }).totais.tributavel, 4800000);

  // Troca qual versão vale: continua contando uma vez.
  await irpf.escolherVersao(outraCopia.documento, a.documento);
  dados = await irpf.carregarDeclaracao(decl.id, dono);
  assert.equal(dados.documentos.find((d) => d.id === a.documento.id).status, 'duplicado');
  assert.equal(calcularResumo({ exercicio: 2026, ...dados }).totais.tributavel, 4800000);
});

test('isolamento: um usuário nunca vê a declaração do outro', async () => {
  const a = await novaDeclaracao('pessoa-a');
  await irpf.importarArquivo({ declaracao: a.decl, ownerId: 'pessoa-a', file: PDF('banco.pdf'), deps: leitor(informeBanco()) });
  const b = await novaDeclaracao('pessoa-b');
  assert.notEqual(a.decl.id, b.decl.id);
  const dadosB = await irpf.carregarDeclaracao(b.decl.id, 'pessoa-b');
  assert.equal(dadosB.documentos.length, 0);
  const tentativa = await irpf.carregarDeclaracao(a.decl.id, 'pessoa-b');
  assert.equal(tentativa.documentos.length, 0);
  assert.equal(tentativa.itens.length, 0);
});

test('IA: só é chamada com consentimento e quando o leitor local não reconhece', async () => {
  const { dono, decl } = await novaDeclaracao();
  let chamadas = 0;
  const ia = async () => { chamadas++; return { tipo: 'recibo_despesa', instituicao: { nome: 'Clínica', documento: '12345678000195' }, ano_calendario: 2025, itens: [{ campo: 'pagamento_medico', valor_original: '200,00' }] }; };
  const desconhecido = [{ pagina: 1, texto: 'Documento estranho sem rótulos conhecidos' }];

  const sem = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('a.pdf', '1'), usarIa: false, deps: { ...leitor(desconhecido), chamarIa: ia } });
  assert.equal(chamadas, 0);
  assert.equal(sem.documento.status, 'nao_identificado');

  await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('b.pdf', '2'), usarIa: true, deps: { ...leitor(informeEmpregador()), chamarIa: ia } });
  assert.equal(chamadas, 0, 'leitor local deu conta: não gasta IA');

  const com = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('c.pdf', '3'), usarIa: true, deps: { ...leitor(desconhecido), chamarIa: ia } });
  assert.equal(chamadas, 1);
  assert.equal(com.documento.extraidoPor, 'ia');
  assert.equal(com.itens[0].revisao, 'sugerido');
  assert.equal(com.itens[0].origem, 'ia');
});

test('IA fora do ar: cai para o leitor local com aviso claro', async () => {
  const { dono, decl } = await novaDeclaracao();
  const ia = async () => { throw new FalhaIa('ia_indisponivel', 'A IA está indisponível agora.'); };
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('x.pdf'), usarIa: true, deps: { ...leitor([{ pagina: 1, texto: 'nada reconhecível aqui' }]), chamarIa: ia } });
  assert.equal(r.documento.extraidoPor, 'local');
  assert.match(r.aviso, /indisponível.*leitor do aparelho/);
});

test('IA devolvendo campo inventado: descartado e registrado como dúvida', async () => {
  const { dono, decl } = await novaDeclaracao();
  const ia = async () => ({ tipo: 'informe_pj', itens: [{ campo: 'isento_total', valor_original: '999.999,00' }, { campo: 'irrf', valor_original: '10,00' }] });
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: PDF('y.pdf'), usarIa: true, deps: { ...leitor([{ pagina: 1, texto: '???' }]), chamarIa: ia } });
  assert.deepEqual(r.itens.map((i) => i.campo), ['irrf']);
  assert.ok(r.documento.duvidas.some((d) => /IA: Campo fora do esquema/.test(d)));
});

test('CSV do BNTT entra como "importado"; excluir documento leva os valores dele', async () => {
  const { dono, decl } = await novaDeclaracao();
  const csv = new File(['campo_interno;valor\nrendimento_pj;"1.000,00"\npagamento_medico;200,00'], 'bntt.csv', { type: 'text/csv' });
  const r = await irpf.importarArquivo({ declaracao: decl, ownerId: dono, file: csv });
  assert.equal(r.documento.status, 'processado');
  assert.equal(r.itens.length, 2);
  const manual = await irpf.adicionarItemManual({ declaracao: decl, ownerId: dono, campo: 'pagamento_medico', centavos: 5000 });
  await irpf.excluirDocumento(r.documento.id, dono, decl.id);
  const dados = await irpf.carregarDeclaracao(decl.id, dono);
  assert.deepEqual(dados.itens.map((i) => i.id), [manual.id]);
  assert.equal(dados.documentos.length, 0);
});

test('mensagem de tabela ausente (antes de ativar no servidor) é clara', () => {
  assert.match(irpf.mensagemErroIrpf(new Error('relation "irpf_itens" does not exist')), /sendo ativado/);
  assert.match(irpf.mensagemErroIrpf(new TypeError('Failed to fetch')), /Sem conexão/);
});
