// Bõnotto — landing page de vendas (branch landing-page)
// Vanilla JS puro, sem dependência de nenhum arquivo de js/ do app principal.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
   * Nav: fundo sólido depois de rolar a tela
   * ------------------------------------------------------------------ */
  var nav = document.getElementById('lp-nav');
  if (nav) {
    var updateNav = function () {
      if (window.scrollY > 24) {
        nav.classList.add('is-scrolled');
      } else {
        nav.classList.remove('is-scrolled');
      }
    };
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
  }

  /* ------------------------------------------------------------------
   * Scroll-reveal via IntersectionObserver — sem lib externa.
   * Com prefers-reduced-motion, os elementos já nascem visíveis (CSS
   * cuida disso sozinho), mas ainda assim marcamos is-visible pra não
   * depender de nenhum estado condicional aqui.
   * ------------------------------------------------------------------ */
  var revealTargets = document.querySelectorAll('.lp-reveal');
  if ('IntersectionObserver' in window && revealTargets.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    // Sem suporte a IntersectionObserver: garante que o conteúdo apareça.
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ------------------------------------------------------------------
   * Parallax sutil no hero — só roda sem prefers-reduced-motion.
   * Throttle via requestAnimationFrame, nada de listener pesado.
   * ------------------------------------------------------------------ */
  if (!reduceMotion) {
    var glow = document.querySelector('.lp-hero__glow:not(.lp-hero__glow--cta)');
    var watermark = document.querySelector('.lp-hero__watermark');
    var ticking = false;

    var applyParallax = function () {
      var y = window.scrollY;
      if (glow) glow.style.transform = 'translateY(' + (y * 0.18) + 'px)';
      if (watermark) watermark.style.transform = 'translateY(calc(-50% + ' + (y * 0.08) + 'px))';
      ticking = false;
    };

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          window.requestAnimationFrame(applyParallax);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------
   * Lista de espera — formulário ainda sem backend real.
   * Placeholder de front-end só pra validar a experiência: ao integrar
   * de verdade, trocar o bloco abaixo por uma chamada real (ex.: tabela
   * no Supabase, Formspree, etc.) antes de publicar a página.
   * ------------------------------------------------------------------ */
  var form = document.getElementById('lp-waitlist-form');
  var status = document.getElementById('lp-waitlist-status');
  if (form && status) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = document.getElementById('lp-email');
      var email = input && input.value ? input.value.trim() : '';
      var isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!isValid) {
        status.textContent = 'Digite um e-mail válido pra entrar na lista.';
        status.style.color = '#E8836B';
        if (input) input.focus();
        return;
      }

      // TODO: integrar com um backend real antes de publicar a página.
      status.style.color = '';
      status.textContent = 'Prontinho — você está na lista de espera.';
      form.reset();
    });
  }
})();
