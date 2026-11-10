/*
  ============================================================
  colecao.js — <colecao-filtros>: filtros ao vivo + gaveta
  ============================================================

  O QUE FAZ:
  Melhoria progressiva da página de coleção
  (sections/main-collection.liquid). Sem este JS, o form de filtros
  envia por GET e a página recarrega. Com ele:

  1. GAVETA: "Filtrar" abre o painel lateral (foco preso dentro,
     Esc/fundo/X fecham, rolagem do fundo travada).
  2. FILTROS AO VIVO: marcou um checkbox ou mudou a ordenação → em
     ~0,3s a grade, os chips, a contagem e o botão "Ver N produtos"
     atualizam, SEM recarregar e SEM fechar a gaveta.
     Preço: espera 600ms depois da última tecla.
  3. CHIPS, "LIMPAR" E PAGINAÇÃO: viram requisições AJAX também.
  4. URL sempre sincronizada (history.pushState): dá para copiar o
     link com os filtros, e o botão "voltar" do navegador funciona.

  COMO BUSCA OS DADOS — Section Rendering API:
    GET /collections/aneis?filter.v.option.metal=Ouro+rosé&sort_by=price-ascending
        &section_id=<id desta section>
  O Shopify devolve SÓ o HTML desta section, já renderizada com os
  filtros aplicados. O JS troca os pedaços marcados com data-*:
    [data-resultados]  grade + paginação
    [data-chips]       filtros ativos
    [data-contagem]    "12 produtos"
    [data-ver-resultados], [data-badge-filtros]
    [data-opcao]       contadores "(3)" e opções esgotadas de cada filtro
  Os checkboxes NÃO são trocados quando a mudança veio deles (para
  não perder o foco de quem está navegando pelo teclado).
*/
(function () {
  'use strict';

  if (customElements.get('colecao-filtros')) return;

  var ESPERA_CLIQUE = 250;
  var ESPERA_PRECO = 600;
  var reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  class ColecaoFiltros extends HTMLElement {
    connectedCallback() {
      this.secaoId = this.dataset.sectionId;
      this.form = this.querySelector('[data-form-filtros]');
      this.gaveta = this.querySelector('[data-gaveta]');
      this.botaoAbrir = this.querySelector('[data-abrir-filtros]');
      this.timer = null;
      this.controle = null;

      this.aoClicar = this.aoClicar.bind(this);
      this.aoMudar = this.aoMudar.bind(this);
      this.aoDigitar = this.aoDigitar.bind(this);
      this.aoTeclar = this.aoTeclar.bind(this);
      this.aoVoltar = this.aoVoltar.bind(this);

      this.addEventListener('click', this.aoClicar);
      this.addEventListener('change', this.aoMudar);
      this.addEventListener('input', this.aoDigitar);
      document.addEventListener('keydown', this.aoTeclar);
      window.addEventListener('popstate', this.aoVoltar);

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          // Os resultados já estão aplicados; o botão "Ver N produtos" só fecha a gaveta.
          e.preventDefault();
          if (this.timer) this.aplicarAgora();
          this.fecharGaveta();
        });
      }
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.aoTeclar);
      window.removeEventListener('popstate', this.aoVoltar);
      document.body.classList.remove('bloquear');
    }

    /* =================== GAVETA =================== */

    abrirGaveta() {
      if (!this.gaveta) return;
      this.focoAnterior = document.activeElement;
      this.gaveta.classList.add('is-aberta');
      this.botaoAbrir && this.botaoAbrir.setAttribute('aria-expanded', 'true');
      document.body.classList.add('bloquear');
      var painel = this.gaveta.querySelector('.filtros__painel');
      setTimeout(() => painel && painel.focus(), 50);
    }

    fecharGaveta() {
      if (!this.gaveta || !this.gaveta.classList.contains('is-aberta')) return;
      this.gaveta.classList.remove('is-aberta');
      this.botaoAbrir && this.botaoAbrir.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('bloquear');
      if (this.focoAnterior && this.focoAnterior.focus) this.focoAnterior.focus();
    }

    aoTeclar(e) {
      if (!this.gaveta || !this.gaveta.classList.contains('is-aberta')) return;
      if (e.key === 'Escape') return this.fecharGaveta();
      if (e.key !== 'Tab') return;

      // Foco preso dentro da gaveta (acessibilidade de diálogo modal)
      var focaveis = Array.prototype.filter.call(
        this.gaveta.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, summary, [tabindex]:not([tabindex="-1"])'),
        (el) => el.offsetParent !== null
      );
      if (!focaveis.length) return;
      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }

    /* =================== EVENTOS =================== */

    aoClicar(e) {
      if (e.target.closest('[data-abrir-filtros]')) return this.abrirGaveta();
      if (e.target.closest('[data-fechar-filtros]')) return this.fecharGaveta();

      // Chips, "Limpar tudo" e paginação → AJAX em vez de navegar
      var link = e.target.closest('[data-link-filtro], [data-resultados] a.pagination__item');
      if (!link) return;
      e.preventDefault();
      var paginacao = link.classList.contains('pagination__item');
      this.atualizar(new URL(link.href, window.location.origin).search.slice(1), {
        trocarFiltros: true,
        rolarParaTopo: paginacao
      });
    }

    aoMudar(e) {
      var alvo = e.target;
      if (alvo.matches('[data-preco]')) return; // preço tem debounce próprio (aoDigitar)
      if (!alvo.form || alvo.form !== this.form) return;
      this.agendar(ESPERA_CLIQUE);
    }

    aoDigitar(e) {
      if (e.target.matches('[data-preco]')) this.agendar(ESPERA_PRECO);
    }

    aoVoltar() {
      this.atualizar(window.location.search.slice(1), { trocarFiltros: true, semHistorico: true });
    }

    agendar(espera) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.aplicarAgora(), espera);
    }

    aplicarAgora() {
      clearTimeout(this.timer);
      this.timer = null;
      this.atualizar(this.parametrosDoForm(), { trocarFiltros: false });
    }

    // FormData inclui o <select> de ordenar (ligado ao form pelo atributo form="")
    parametrosDoForm() {
      var dados = new FormData(this.form);
      var params = new URLSearchParams();
      var ordenar = this.querySelector('[data-ordenar]');
      var ordemPadrao = ordenar ? ordenar.dataset.padrao : '';
      dados.forEach((valor, chave) => {
        if (valor === '') return;
        if (chave === 'sort_by' && valor === ordemPadrao) return; // URL mais limpa: ordem padrão não precisa ir
        params.append(chave, valor);
      });
      return params.toString();
    }

    /* =================== BUSCA + TROCA DE HTML =================== */

    atualizar(busca, opcoes) {
      opcoes = opcoes || {};
      if (this.controle) this.controle.abort();
      this.controle = new AbortController();
      this.classList.add('is-carregando');

      var urlSecao = window.location.pathname + '?' + (busca ? busca + '&' : '') + 'section_id=' + encodeURIComponent(this.secaoId);

      fetch(urlSecao, { signal: this.controle.signal })
        .then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then((html) => {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var novo = doc.querySelector('colecao-filtros');
          if (!novo) throw new Error('sem conteúdo');

          this.trocar(novo, '[data-resultados]');
          this.trocar(novo, '[data-chips]');
          this.trocarTexto(novo, '[data-contagem]');
          this.trocarTexto(novo, '[data-ver-resultados]');
          this.trocarBadge(novo);

          if (opcoes.trocarFiltros) {
            this.trocar(novo, '[data-grupos]');
            var ordenar = this.querySelector('[data-ordenar]');
            var ordenarNovo = novo.querySelector('[data-ordenar]');
            if (ordenar && ordenarNovo) ordenar.value = ordenarNovo.value;
          } else {
            this.sincronizarContadores(novo);
          }

          if (!opcoes.semHistorico) {
            var urlBonita = window.location.pathname + (busca ? '?' + busca : '');
            history.pushState({}, '', urlBonita);
          }

          var resultados = this.querySelector('[data-resultados]');
          if (window.Movimento && resultados) window.Movimento.observar(resultados);
          if (opcoes.rolarParaTopo) this.rolarParaTopo();
        })
        .catch((erro) => {
          if (erro.name === 'AbortError') return;
          // Falhou o AJAX: cai para a navegação normal (a página recarrega filtrada)
          window.location.search = busca;
        })
        .finally(() => this.classList.remove('is-carregando'));
    }

    trocar(novo, seletor) {
      var atual = this.querySelector(seletor);
      var substituto = novo.querySelector(seletor);
      if (atual && substituto) atual.innerHTML = substituto.innerHTML;
    }

    trocarTexto(novo, seletor) {
      var atual = this.querySelector(seletor);
      var substituto = novo.querySelector(seletor);
      if (atual && substituto) atual.textContent = substituto.textContent.trim();
    }

    trocarBadge(novo) {
      var atual = this.querySelector('[data-badge-filtros]');
      var substituto = novo.querySelector('[data-badge-filtros]');
      if (!atual || !substituto) return;
      atual.textContent = substituto.textContent;
      atual.hidden = substituto.hidden;
    }

    // Atualiza "(3)" e o estado desabilitado de cada opção, sem trocar os inputs
    sincronizarContadores(novo) {
      novo.querySelectorAll('[data-opcao]').forEach((opcaoNova) => {
        var chave = opcaoNova.getAttribute('data-opcao');
        var opcao = this.querySelector('[data-opcao="' + CSS.escape(chave) + '"]');
        if (!opcao) return;
        var qtd = opcao.querySelector('[data-qtd]');
        var qtdNova = opcaoNova.querySelector('[data-qtd]');
        if (qtd && qtdNova) qtd.textContent = qtdNova.textContent;
        var desabilitado = opcaoNova.classList.contains('is-desabilitado');
        opcao.classList.toggle('is-desabilitado', desabilitado);
        var input = opcao.querySelector('input');
        if (input && !input.checked) input.disabled = desabilitado;
      });
    }

    rolarParaTopo() {
      var header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-altura')) || 0;
      var topo = this.getBoundingClientRect().top + window.scrollY - header;
      window.scrollTo({ top: topo, behavior: reduzirMovimento.matches ? 'auto' : 'smooth' });
    }
  }

  customElements.define('colecao-filtros', ColecaoFiltros);
})();
