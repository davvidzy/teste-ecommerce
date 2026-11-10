/*
  ============================================================
  catalogo.js — <catalogo-abas>: abas, swatches e compra rápida
  ============================================================

  O QUE FAZ:
  Define o custom element <catalogo-abas> usado em
  sections/catalogo.liquid. Um Web Component é ideal em temas
  Shopify: o navegador chama connectedCallback() sozinho sempre que
  o elemento aparece no DOM — inclusive quando o editor de temas
  re-renderiza a seção — então não precisamos "reinicializar" nada.

  RESPONSABILIDADES:
  1. ABAS
     - Clique ou teclado (← → Home End) ativa uma aba.
     - Painel antigo sai (fade + sobe), a altura do container anima
       do tamanho antigo para o novo (sem "pulo" na página) e os
       cards do painel novo entram em cascata ([data-reveal]).
     - Indicador desliza até a aba ativa (só transform: translateX
       + scaleX, calculados a partir de offsetLeft/offsetWidth).
  2. MINI-GALERIA DO CARD
     - Setas [data-seta] fazem scrollTo no trilho (scroll-snap);
       no celular o próprio dedo arrasta. Depois do último volta ao 1º.
     - Um listener de "scroll" em fase de captura atualiza os
       pontinhos de todos os cards (1 por frame, via rAF).
  3. SWATCHES
     - Clique no swatch lê os data-* do botão e atualiza o card:
       rola a galeria até a foto da variante (data-indice-midia),
       preço, preço "de", badge de desconto, esgotado, variante do
       formulário e links.
  4. COMPRA RÁPIDA
     - O envio em si é do assets/carrinho.js (AJAX). Aqui só
       ouvimos os eventos dele para trocar o estado visual do botão:
       padrao → carregando → sucesso → padrao (ou esgotado).

  OBSERVAÇÕES:
  - Respeita prefers-reduced-motion (troca de aba sem esperar animação).
  - Listeners globais (document/resize) são removidos em
    disconnectedCallback para não vazar memória no editor.
*/
(function () {
  'use strict';

  if (customElements.get('catalogo-abas')) return;

  var reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  var DURACAO_SAIDA = 200; // ms — igual a --dur-fast no CSS
  var DURACAO_ALTURA = 450; // ms — igual a --dur-base no CSS
  var TEMPO_SUCESSO = 1800; // ms que o "Adicionado ✓" fica visível

  class CatalogoAbas extends HTMLElement {
    connectedCallback() {
      this.abas = Array.prototype.slice.call(this.querySelectorAll('[role="tab"]'));
      this.indicador = this.querySelector('[data-indicador]');
      this.containerPaineis = this.querySelector('[data-paineis]');
      this.timers = [];

      this.aoClicar = this.aoClicar.bind(this);
      this.aoTeclar = this.aoTeclar.bind(this);
      this.aoAdicionando = this.aoAdicionando.bind(this);
      this.aoAdicionado = this.aoAdicionado.bind(this);
      this.aoErro = this.aoErro.bind(this);

      this.aoRolarTrilho = this.aoRolarTrilho.bind(this);

      this.addEventListener('click', this.aoClicar);
      this.addEventListener('keydown', this.aoTeclar);
      // "scroll" não borbulha, mas a fase de CAPTURA passa pelos ancestrais:
      // um único listener aqui ouve o scroll de todos os trilhos dos cards.
      this.addEventListener('scroll', this.aoRolarTrilho, { capture: true, passive: true });
      document.addEventListener('carrinho:adicionando', this.aoAdicionando);
      document.addEventListener('carrinho:adicionado', this.aoAdicionado);
      document.addEventListener('carrinho:erro', this.aoErro);

      // Reposiciona o indicador quando a lista de abas muda de tamanho
      // (resize da janela, fonte carregando, etc.).
      if (this.indicador && 'ResizeObserver' in window) {
        this.observadorTamanho = new ResizeObserver(() => this.moverIndicador(false));
        this.observadorTamanho.observe(this.indicador.parentElement);
      }
      this.moverIndicador(false);
    }

    disconnectedCallback() {
      document.removeEventListener('carrinho:adicionando', this.aoAdicionando);
      document.removeEventListener('carrinho:adicionado', this.aoAdicionado);
      document.removeEventListener('carrinho:erro', this.aoErro);
      if (this.observadorTamanho) this.observadorTamanho.disconnect();
      this.limparTimers();
    }

    /* =================== ABAS =================== */

    abaAtiva() {
      return this.abas.find((aba) => aba.getAttribute('aria-selected') === 'true');
    }

    ativar(aba, focar) {
      if (!aba || aba === this.abaAtiva()) return;

      var painelNovo = document.getElementById(aba.getAttribute('aria-controls'));
      var paineis = Array.prototype.slice.call(this.querySelectorAll('[data-painel]'));
      var painelAtual = paineis.find((p) => !p.hidden);
      if (!painelNovo) return;

      // 1. Estado ARIA + roving tabindex
      this.abas.forEach((a) => {
        var selecionada = a === aba;
        a.setAttribute('aria-selected', String(selecionada));
        a.tabIndex = selecionada ? 0 : -1;
      });
      if (focar) aba.focus();
      aba.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduzirMovimento.matches ? 'auto' : 'smooth' });
      this.moverIndicador(true);

      // Cliques rápidos: cancela a transição anterior e começa do zero
      this.limparTimers();
      paineis.forEach((p) => {
        p.classList.remove('is-saindo');
        if (p !== painelAtual) p.hidden = true;
      });

      if (reduzirMovimento.matches || !painelAtual) {
        if (painelAtual) painelAtual.hidden = true;
        painelNovo.hidden = false;
        this.revelarCards(painelNovo, false);
        return;
      }

      // 2. Trava a altura atual para o container não "pular"
      var container = this.containerPaineis;
      container.style.height = painelAtual.offsetHeight + 'px';
      painelAtual.classList.add('is-saindo');

      // 3. Depois da saída: troca os painéis e anima a altura até a nova
      this.timers.push(
        setTimeout(() => {
          painelAtual.hidden = true;
          painelAtual.classList.remove('is-saindo');
          painelNovo.hidden = false;
          this.revelarCards(painelNovo, true);
          container.style.height = painelNovo.offsetHeight + 'px';

          // 4. Libera a altura (volta a ser automática)
          this.timers.push(setTimeout(() => { container.style.height = ''; }, DURACAO_ALTURA));
        }, DURACAO_SAIDA)
      );
    }

    revelarCards(painel, animar) {
      var cards = painel.querySelectorAll('[data-reveal]');
      if (!animar) {
        cards.forEach((c) => c.classList.add('is-visible'));
        return;
      }
      cards.forEach((c) => c.classList.remove('is-visible'));
      void painel.offsetWidth; // força o navegador a "ver" o estado inicial
      requestAnimationFrame(() => cards.forEach((c) => c.classList.add('is-visible')));
    }

    moverIndicador(animar) {
      var aba = this.abaAtiva();
      if (!this.indicador || !aba) return;
      if (!animar) this.indicador.style.transition = 'none';
      this.indicador.style.setProperty('--x', aba.offsetLeft + 'px');
      this.indicador.style.setProperty('--w', aba.offsetWidth);
      if (!animar) {
        void this.indicador.offsetWidth;
        this.indicador.style.transition = '';
      }
    }

    aoTeclar(evento) {
      var aba = evento.target.closest('[role="tab"]');
      if (!aba) return;
      var i = this.abas.indexOf(aba);
      var destino = null;

      switch (evento.key) {
        case 'ArrowRight': destino = this.abas[(i + 1) % this.abas.length]; break;
        case 'ArrowLeft': destino = this.abas[(i - 1 + this.abas.length) % this.abas.length]; break;
        case 'Home': destino = this.abas[0]; break;
        case 'End': destino = this.abas[this.abas.length - 1]; break;
        default: return;
      }
      evento.preventDefault();
      this.ativar(destino, true);
    }

    limparTimers() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
    }

    /* =================== CLIQUES =================== */

    aoClicar(evento) {
      var aba = evento.target.closest('[role="tab"]');
      if (aba) return this.ativar(aba, false);

      var seta = evento.target.closest('[data-seta]');
      if (seta) {
        evento.preventDefault();
        var trilhoDaSeta = seta.closest('[data-card]').querySelector('[data-trilho]');
        return this.irParaSlide(trilhoDaSeta, this.slideAtual(trilhoDaSeta) + Number(seta.dataset.seta));
      }

      var swatch = evento.target.closest('[data-swatch]');
      if (swatch) return this.selecionarSwatch(swatch);
    }

    /* =================== MINI-GALERIA DO CARD =================== */

    slideAtual(trilho) {
      return Math.round(trilho.scrollLeft / trilho.clientWidth);
    }

    // Vai para o slide `indice` (com volta: depois do último vem o primeiro)
    irParaSlide(trilho, indice) {
      if (!trilho) return;
      var total = trilho.children.length;
      var destino = ((indice % total) + total) % total;
      trilho.scrollTo({
        left: destino * trilho.clientWidth,
        behavior: reduzirMovimento.matches ? 'auto' : 'smooth'
      });
    }

    // Atualiza os pontinhos enquanto o trilho rola (seta, swipe ou swatch)
    aoRolarTrilho(evento) {
      var trilho = evento.target;
      if (!trilho.matches || !trilho.matches('[data-trilho]')) return;
      if (trilho._agendado) return;
      trilho._agendado = true;
      requestAnimationFrame(() => {
        trilho._agendado = false;
        var atual = this.slideAtual(trilho);
        var pontos = trilho.closest('[data-card]').querySelectorAll('.card-cat__ponto');
        pontos.forEach((p, i) => p.classList.toggle('is-ativo', i === atual));
      });
    }

    /* =================== SWATCHES =================== */

    selecionarSwatch(botao) {
      var card = botao.closest('[data-card]');
      if (!card || botao.getAttribute('aria-pressed') === 'true') return;
      var d = botao.dataset;

      card.querySelectorAll('[data-swatch]').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
      card.style.setProperty('--card-tint', d.cor || 'transparent');

      // Rola a mini-galeria até a foto desta variante (se ela tiver uma)
      if (d.indiceMidia !== '' && d.indiceMidia !== undefined) {
        this.irParaSlide(card.querySelector('[data-trilho]'), Number(d.indiceMidia));
      }

      // Preço e desconto
      var precoAtual = card.querySelector('[data-preco-atual]');
      var precoDe = card.querySelector('[data-preco-de]');
      var badgeDesconto = card.querySelector('[data-badge-desconto]');
      if (precoAtual) precoAtual.textContent = d.preco;
      if (precoDe) {
        precoDe.textContent = d.precoDe || '';
        precoDe.hidden = !d.precoDe;
      }
      if (badgeDesconto) {
        badgeDesconto.textContent = d.desconto ? '-' + d.desconto + '%' : '';
        badgeDesconto.hidden = !d.desconto;
      }

      // Disponibilidade
      var disponivel = d.disponivel === 'true';
      var badgeEsgotado = card.querySelector('[data-badge-esgotado]');
      if (badgeEsgotado) badgeEsgotado.hidden = disponivel;

      // Formulário de compra rápida → variante escolhida
      var inputVariante = card.querySelector('[data-card-variante]');
      var botaoCompra = card.querySelector('[data-card-botao]');
      if (inputVariante && d.varianteId) inputVariante.value = d.varianteId;
      if (botaoCompra) {
        botaoCompra.disabled = !disponivel;
        botaoCompra.dataset.estado = disponivel ? 'padrao' : 'esgotado';
      }

      // Links do card abrem a página já com a variante (?variant=ID)
      if (d.url) card.querySelectorAll('[data-card-link]').forEach((a) => { a.href = d.url; });
    }

    /* =================== COMPRA RÁPIDA =================== */

    botaoDoEvento(evento) {
      var form = evento.detail && evento.detail.form;
      if (!form || !this.contains(form)) return null;
      return form.querySelector('[data-card-botao]');
    }

    aoAdicionando(evento) {
      var botao = this.botaoDoEvento(evento);
      if (botao) botao.dataset.estado = 'carregando';
    }

    aoAdicionado(evento) {
      var botao = this.botaoDoEvento(evento);
      if (!botao) return;
      botao.dataset.estado = 'sucesso';
      setTimeout(() => {
        if (botao.dataset.estado === 'sucesso') botao.dataset.estado = 'padrao';
      }, TEMPO_SUCESSO);
    }

    aoErro(evento) {
      var botao = this.botaoDoEvento(evento);
      if (botao) botao.dataset.estado = botao.disabled ? 'esgotado' : 'padrao';
    }
  }

  customElements.define('catalogo-abas', CatalogoAbas);
})();
