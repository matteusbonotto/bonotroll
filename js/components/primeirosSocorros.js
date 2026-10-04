import { NUMEROS_EMERGENCIA, TOPICOS_PRIMEIROS_SOCORROS, filtrarTopicos } from '../data/primeirosSocorros.js';

// Tela "Primeiros socorros" (2026-10-04): números de emergência em botões
// grandes de ligar + guias curtos pesquisáveis. Sem dado pessoal nenhum —
// a ficha médica da casa (alergias, remédios) vem depois, já cifrada.
export function primeirosSocorrosView() {
  return {
    numeros: NUMEROS_EMERGENCIA,
    busca: '',
    abertoId: null,

    get topicos() {
      return filtrarTopicos(TOPICOS_PRIMEIROS_SOCORROS, this.busca);
    },

    alternar(id) {
      this.abertoId = this.abertoId === id ? null : id;
    },
  };
}
