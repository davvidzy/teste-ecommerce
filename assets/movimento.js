/*
  ============================================================
  movimento.js — Revelar ao rolar, parallax e "rolar para a próxima"
  ============================================================

  O QUE FAZ:
  1. [data-reveal]       → usa IntersectionObserver para adicionar
                            .is-visible quando o elemento entra na tela
                            (o CSS da transição está em movimento.css).
  2. [data-parallax="0.2"] → desloca o elemento no eixo Y conforme a
                            rolagem (fator 0.2 = 20% da velocidade).
                            Escreve só a CSS var --parallax-y; quem
                            aplica o transform é o CSS da seção.
  3. [data-scroll-next]  → botão que rola suavemente até a seção
                            seguinte (usado no indicador do hero).
  4. [data-voltar-topo]  → link que volta ao topo suavemente (rodapé).
                            Sem JS, o href="#" já leva ao topo.

  POR QUE ASSIM:
  - IntersectionObserver não roda a cada pixel de scroll (o navegador
    avisa só quando o elemento cruza o limite) → barato.
  - O parallax usa requestAnimationFrame + listener passivo: no máximo
    uma escrita por frame, sem travar a rolagem.
  - Eventos do editor de temas (shopify:section:load) reinicializam
    tudo dentro da seção que acabou de ser re-renderizada.

  API GLOBAL:
  window.Movimento.observar(elementoRaiz) — registra novos [data-reveal]
  (útil quando um JS injeta HTML depois do carregamento).
*/
(function () {
  'use strict';

  var reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  var observer = null;

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('is-visible');
          observer.unobserve(entrada.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
  }

  function observar(raiz) {
    (raiz || document).querySelectorAll('[data-reveal]:not(.is-visible)').forEach(function (el) {
      if (!observer || reduzirMovimento.matches) {
        el.classList.add('is-visible');
        return;
      }
      observer.observe(el);
    });
  }

  /* ---------- Parallax ---------- */
  var elementosParallax = [];
  var agendado = false;

  function coletarParallax() {
    elementosParallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  }

  function aplicarParallax() {
    agendado = false;
    if (reduzirMovimento.matches) return;
    var alturaTela = window.innerHeight;

    elementosParallax.forEach(function (el) {
      var area = el.parentElement.getBoundingClientRect();
      if (area.bottom < 0 || area.top > alturaTela) return; // fora da tela: não gasta nada
      var fator = parseFloat(el.getAttribute('data-parallax')) || 0.15;
      el.style.setProperty('--parallax-y', (area.top * -fator).toFixed(1) + 'px');
    });
  }

  function aoRolar() {
    if (agendado || elementosParallax.length === 0) return;
    agendado = true;
    window.requestAnimationFrame(aplicarParallax);
  }

  /* ---------- Rolar para a próxima seção / voltar ao topo ---------- */
  function aoClicar(evento) {
    var comportamento = reduzirMovimento.matches ? 'auto' : 'smooth';

    var voltarTopo = evento.target.closest('[data-voltar-topo]');
    if (voltarTopo) {
      evento.preventDefault();
      window.scrollTo({ top: 0, behavior: comportamento });
      return;
    }

    var botao = evento.target.closest('[data-scroll-next]');
    if (!botao) return;
    var secaoAtual = botao.closest('.shopify-section');
    var proxima = secaoAtual && secaoAtual.nextElementSibling;
    if (proxima) proxima.scrollIntoView({ behavior: comportamento });
  }

  function iniciar() {
    observar(document);
    coletarParallax();
    aplicarParallax();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar, { passive: true });
  document.addEventListener('click', aoClicar);

  // Editor de temas: a seção foi re-renderizada após mudar uma setting.
  document.addEventListener('shopify:section:load', function (evento) {
    observar(evento.target);
    coletarParallax();
    aplicarParallax();
  });

  window.Movimento = { observar: observar };
})();
