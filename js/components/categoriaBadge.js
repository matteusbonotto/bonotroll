// Badge de categoria — ÚNICA implementação do "chip" de categoria (antes eram
// 5 cópias de markup em app.html, cada uma com uma variação: umas sem
// icone_url, uma só com bolinha, todas com texto branco fixo).
//
// Uso (2026-10-11):
//   <span class="cg-chip cg-chip--cat" x-data="cgCategoria(() => categoryFor(row.categoria_id))" x-bind="raiz">
//     <template x-if="iconeUrl"><img alt="" :src="iconeUrl" class="cg-chip__icon-img" /></template>
//     <template x-if="!iconeUrl"><i class="bi" :class="icone" aria-hidden="true"></i></template>
//     <span class="cg-chip__nome" x-text="nome"></span>
//     <span class="cg-chip__balao" role="tooltip" :id="idBalao" x-show.important="aberto" x-text="nome"></span>
//   </span>
//
// - Celular (< 576 px): só o ícone (CSS em components.css); o nome continua
//   no nome acessível (aria-label) e aparece num balão ao tocar ou ao focar
//   pelo teclado (Enter/Espaço alternam, Esc fecha).
// - Tela maior: ícone + nome; o balão só abre se o nome estiver cortado.
// - Cor do ícone/texto calculada pelo contraste com a cor da categoria
//   (js/utils/cor.js) — não depende só da cor: cada categoria tem ícone.
// - `trocavel`: quando o chip é o botão que abre o menu de trocar categoria
//   (Movimentações), o clique fica com o menu e o balão abre só por foco e
//   hover — mesmo cuidado do cgHelp com a corrida hover → clique.
import { corDoTexto } from '../utils/cor.js';

const COR_SEM_CATEGORIA = '#94A3B8';
let contador = 0;

export function cgCategoria(fonte, { trocavel = false } = {}) {
  const componente = {
    aberto: false,
    // Abriu por hover ou foco, e o clique que vem na MESMA ação (toque no
    // celular = foco + clique; mouse = mouseenter + clique) só confirma em vez
    // de fechar — mesma corrida documentada em help.js.
    abertoPorHover: false,
    idBalao: `cg-cat-balao-${++contador}`,

    get cat() {
      return typeof fonte === 'function' ? fonte() : fonte;
    },
    get nome() {
      return this.cat?.nome || 'Sem categoria';
    },
    get icone() {
      return this.cat?.icone || 'bi-tag';
    },
    get iconeUrl() {
      return this.cat?.icone_url || '';
    },
    get fundo() {
      return this.cat?.cor || COR_SEM_CATEGORIA;
    },

    // O balão só tem o que mostrar quando o nome não está inteiro na tela
    // (escondido no celular ou cortado com reticências).
    nomeEscondido() {
      const n = this.$el.querySelector?.('.cg-chip__nome') || this.$root.querySelector('.cg-chip__nome');
      return !n || n.offsetWidth < 2 || n.scrollWidth > n.clientWidth + 1;
    },
    abrir() {
      if (this.nomeEscondido()) this.aberto = true;
    },
    fechar() {
      this.aberto = false;
      this.abertoPorHover = false;
    },

    raiz: {
      [':style']() {
        return { background: this.fundo, color: corDoTexto(this.fundo) };
      },
      [':aria-label']() {
        return trocavel ? `Categoria: ${this.nome}. Toque para trocar` : `Categoria: ${this.nome}`;
      },
      [':aria-describedby']() {
        return this.aberto ? this.idBalao : null;
      },
      // Abre um balão → é um botão (padrão "toggletip", igual ao cgHelp).
      [':role']() {
        return 'button';
      },
      [':aria-expanded']() {
        return String(this.aberto);
      },
      [':tabindex']() {
        return '0';
      },
      // Hover só de MOUSE: no toque o navegador emula mouseenter/mouseleave
      // em volta do clique, e o mouseleave fecharia o balão recém-aberto.
      ['@pointerenter'](e) {
        if (e.pointerType !== 'mouse') return;
        this.abrir();
        this.abertoPorHover = this.aberto;
      },
      ['@pointerleave'](e) {
        if (e.pointerType === 'mouse') this.fechar();
      },
      ['@focus']() {
        if (!this.$el.matches(':focus-visible')) return;
        this.abrir();
        this.abertoPorHover = this.aberto;
      },
      ['@blur']() {
        this.fechar();
      },
      ['@keydown.escape']() {
        this.fechar();
      },
      ['@keydown.enter.prevent']() {
        if (trocavel) return;
        if (this.aberto) this.fechar();
        else this.abrir();
      },
      ['@keydown.space.prevent']() {
        if (trocavel) return;
        if (this.aberto) this.fechar();
        else this.abrir();
      },
      ['@click']() {
        if (trocavel) return;
        if (this.abertoPorHover) {
          this.abertoPorHover = false;
          return;
        }
        if (this.aberto) this.fechar();
        else this.abrir();
      },
      ['@click.outside']() {
        this.fechar();
      },
    },
  };
  // No botão de trocar categoria, papel, foco e aria-expanded são do próprio
  // <button> e do menu dele — o badge não pode sobrescrever.
  if (trocavel) for (const k of [':role', ':aria-expanded', ':tabindex']) delete componente.raiz[k];
  return componente;
}
