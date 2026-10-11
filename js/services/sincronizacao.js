// Fronteira das telas com o modo offline (2026-10-11): o store e a topbar
// falam com isto, nunca direto com js/data/offline.js — mesma regra de
// "services/ é a única fronteira" do resto do app.
export {
  iniciarOffline,
  encerrarOffline,
  aoMudarEstado,
  sincronizar,
  resolverConflito,
  tentarDeNovo,
  descartarOperacao,
} from '../data/offline.js';

const NOMES = {
  transactions: 'Lançamento',
  shopping_list_items: 'Item da lista de compras',
  resource_items: 'Item do inventário',
};

// Texto curto para a lista de pendências/conflitos.
export function descreverOperacao(op) {
  const oque = NOMES[op.tabela] || 'Registro';
  const nome = op.dados?.titulo || op.dados?.nome || op.servidor?.titulo || op.servidor?.nome || '';
  const acao = op.tipo === 'insert' ? 'novo' : 'alterado';
  return `${oque} ${acao}${nome ? `: ${nome}` : ''}`;
}
