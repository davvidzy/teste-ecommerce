/*
  ============================================================
  busca.js — <busca-modal>: popup de busca preditiva
  ============================================================

  O QUE FAZ:
  1. Abre o <dialog> ao clicar em qualquer [data-abrir-busca]
     (a lupa do header). Atalho extra: tecla "/" fora de campos.
  2. Enquanto a pessoa digita, busca resultados na Predictive
     Search API do Shopify usando a Section Rendering API:
       /search/suggest?q=…&section_id=busca-preditiva
     O Shopify devolve o HTML pronto de sections/busca-preditiva.liquid.
  3. Fecha com Esc, botão X ou clique fora — com animação de saída.

  DETALHES QUE FAZEM DIFERENÇA:
  - Debounce de 220ms: não dispara 1 requisição por tecla.
  - AbortController: se a pessoa continua digitando, a requisição
    anterior é cancelada → resultados velhos nunca "piscam" por cima.
  - Cache em memória por termo: apagar e redigitar é instantâneo.
  - Mínimo de 2 caracteres para buscar.

  SEM JS: a lupa é um link para /search e o form envia normalmente.
*/
(function () {
  'use strict';

  if (customElements.get('busca-modal')) return;

  var ESPERA = 220; // ms de debounce
  var MINIMO = 2; // caracteres mínimos

  class BuscaModal extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('[data-busca-dialog]');
      this.form = this.querySelector('[data-busca-form]');
      this.input = this.querySelector('[data-busca-input]');
      this.resultados = this.querySelector('[data-busca-resultados]');
      this.cache = new Map();
      this.timer = null;
      this.controle = null;

      this.abrir = this.abrir.bind(this);
      this.aoClicarDocumento = this.aoClicarDocumento.bind(this);
      this.aoTeclarDocumento = this.aoTeclarDocumento.bind(this);

      document.addEventListener('click', this.aoClicarDocumento);
      document.addEventListener('keydown', this.aoTeclarDocumento);

      this.input.addEventListener('input', () => this.agendarBusca());

      // Num <input type="search">, o 1º Esc do Chrome só APAGA o texto e "consome"
      // a tecla — o <dialog> nem fica sabendo. Tratamos o Esc no próprio campo
      // para um único Esc fechar o popup (bug encontrado no teste com Playwright).
      this.input.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        this.fechar();
      });
      this.querySelector('[data-busca-fechar]').addEventListener('click', () => this.fechar());

      // Clique no "fundo" (fora do painel): o alvo é o próprio <dialog>
      this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.fechar(); });

      // Esc: o <dialog> dispara "cancel" — trocamos pelo fechamento animado
      this.dialog.addEventListener('cancel', (e) => { e.preventDefault(); this.fechar(); });

      // Chips de "buscas populares"
      this.addEventListener('click', (e) => {
        var chip = e.target.closest('[data-busca-termo]');
        if (!chip) return;
        this.input.value = chip.dataset.buscaTermo;
        this.input.focus();
        this.buscar();
      });
    }

    disconnectedCallback() {
      document.removeEventListener('click', this.aoClicarDocumento);
      document.removeEventListener('keydown', this.aoTeclarDocumento);
    }

    aoClicarDocumento(e) {
      var gatilho = e.target.closest('[data-abrir-busca]');
      if (!gatilho) return;
      e.preventDefault();
      this.abrir();
    }

    aoTeclarDocumento(e) {
      if (e.key !== '/' || this.dialog.open) return;
      var alvo = e.target;
      if (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      e.preventDefault();
      this.abrir();
    }

    abrir() {
      if (this.dialog.open) return;
      this.dialog.classList.remove('is-fechando');
      this.dialog.showModal();
      document.body.classList.add('bloquear'); // trava a rolagem do fundo (normalizar.css)
      this.input.focus();
      this.input.select();
      if (this.input.value.trim().length >= MINIMO) this.buscar();
    }

    fechar() {
      if (!this.dialog.open || this.dialog.classList.contains('is-fechando')) return;
      var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var concluir = () => {
        this.dialog.classList.remove('is-fechando');
        this.dialog.close();
        document.body.classList.remove('bloquear');
      };
      if (reduzir) return concluir();
      this.dialog.classList.add('is-fechando');
      setTimeout(concluir, 220); // = duração de busca-fecha no CSS
    }

    agendarBusca() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.buscar(), ESPERA);
    }

    buscar() {
      var termo = this.input.value.trim();
      this.dialog.classList.toggle('tem-termo', termo.length > 0);

      if (termo.length < MINIMO) {
        this.resultados.innerHTML = '';
        this.input.setAttribute('aria-expanded', 'false');
        return;
      }

      if (this.cache.has(termo)) return this.mostrar(this.cache.get(termo));

      if (this.controle) this.controle.abort();
      this.controle = new AbortController();
      this.dialog.classList.add('is-carregando');

      var raiz = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      var url =
        raiz + 'search/suggest' +
        '?q=' + encodeURIComponent(termo) +
        '&resources[type]=product,query' +
        '&resources[limit]=6' +
        '&resources[options][unavailable_products]=last' +
        '&section_id=busca-preditiva';

      fetch(url, { signal: this.controle.signal })
        .then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then((html) => {
          // A resposta é a section inteira; pegamos só o miolo.
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var conteudo = doc.querySelector('[data-busca-conteudo]');
          var markup = conteudo ? conteudo.innerHTML : '';
          this.cache.set(termo, markup);
          this.mostrar(markup);
        })
        .catch((erro) => {
          if (erro.name === 'AbortError') return; // foi substituída por uma busca mais nova
          this.resultados.innerHTML = '';
        })
        .finally(() => this.dialog.classList.remove('is-carregando'));
    }

    mostrar(markup) {
      this.resultados.innerHTML = markup;
      this.input.setAttribute('aria-expanded', markup.trim() ? 'true' : 'false');
    }
  }

  customElements.define('busca-modal', BuscaModal);
})();
