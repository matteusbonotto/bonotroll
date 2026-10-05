import { NUMEROS_EMERGENCIA, TOPICOS_PRIMEIROS_SOCORROS, filtrarTopicos } from '../data/primeirosSocorros.js';

// Tela "Primeiros socorros" (2026-10-05): menu com 3 caminhos — Emergência,
// Sintomas e Informações dos membros — e cada situação numa página própria.
const TITULOS = { menu: 'Primeiros socorros', emergencia: 'Emergência', sintomas: 'Sintomas', membros: 'Informações dos membros' };

export function primeirosSocorrosView() {
  return {
    numeros: NUMEROS_EMERGENCIA,
    busca: '',
    secao: 'menu', // menu | emergencia | sintomas | membros | topico
    origem: 'menu', // de onde a situação foi aberta (para o Voltar)
    topicoId: null,

    get topicos() {
      return filtrarTopicos(TOPICOS_PRIMEIROS_SOCORROS, this.busca);
    },
    get urgentes() {
      return TOPICOS_PRIMEIROS_SOCORROS.filter((t) => t.urgente);
    },
    get topicoAtual() {
      return TOPICOS_PRIMEIROS_SOCORROS.find((t) => t.id === this.topicoId) || null;
    },
    get tituloAtual() {
      return this.secao === 'topico' ? (this.topicoAtual?.titulo || '') : TITULOS[this.secao];
    },

    ir(secao) {
      this.secao = secao;
      window.scrollTo({ top: 0 });
    },
    abrirTopico(id) {
      this.origem = this.secao;
      this.topicoId = id;
      this.secao = 'topico';
      window.scrollTo({ top: 0 });
    },
    voltar() {
      this.secao = this.secao === 'topico' ? this.origem : 'menu';
      window.scrollTo({ top: 0 });
    },
  };
}
