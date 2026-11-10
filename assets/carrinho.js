/*
  ============================================================
  carrinho.js — Helper de carrinho (add-to-cart via AJAX)
  ============================================================

  O QUE FAZ:
  Melhoria progressiva para adicionar produtos ao carrinho sem
  recarregar a pagina. Intercepta o envio de qualquer formulario
  de add-to-cart, envia para a Cart AJAX API do Shopify
  (/cart/add.js), atualiza o contador do carrinho no header
  (buscando /cart.js) e mostra uma confirmacao leve via
  window.mostrarAlerta (definido em snippets/alerta.liquid).

  EVENTOS (para outras partes do tema reagirem):
  Disparados no `document`, com { form } em event.detail:
  - carrinho:adicionando  → a requisicao comecou
  - carrinho:adicionado   → sucesso; detail.item = item retornado
                            pela API, detail.cart = carrinho atual
  - carrinho:erro         → a API recusou (ex: sem estoque);
                            detail.mensagem = texto do Shopify
  Exemplo: assets/catalogo.js usa esses eventos para animar o
  botao "Adicionar" do card (carregando → adicionado).

  ANIMACAO "+" → SACOLA:
  Ao adicionar com sucesso, um "+" sai do botao clicado e voa em
  arco ate o icone [data-carrinho-alvo] do header (voarParaCarrinho).
  So depois do pouso o contador pula e o alerta lateral aparece,
  com o botao "Ver sacola" (link para /cart).

  OBSERVACOES:
  Funciona sem JS: o formulario de produto ja envia nativamente
  para /cart/add. Se a REDE falhar, o script faz fallback e
  submete o formulario do jeito tradicional. Se a API RESPONDER
  com erro (422, ex: estoque insuficiente), mostramos a mensagem
  do Shopify num alerta, sem sair da pagina.
  O contador usa elementos com [data-cart-count] e ganha a classe
  .is-bump (animacao em movimento.css). Os textos vem de
  window.themeStrings (definido em layout/theme.liquid).
*/
(function () {
  'use strict';

  var raiz = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var textos = window.themeStrings || {};

  function emitir(nome, detalhe) {
    document.dispatchEvent(new CustomEvent(nome, { detail: detalhe }));
  }

  function updateCartCount(count, animar) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      if (!animar) return;
      el.classList.remove('is-bump');
      void el.offsetWidth; // força reflow para reiniciar a animação
      el.classList.add('is-bump');
    });
  }

  /*
    "+" voando do botão até o ícone da sacola no header.
    O truque do ARCO: duas camadas animadas em eixos separados, cada
    uma com uma curva de easing diferente.
      - camada X: começa devagar e acelera  → vai para a direita
      - camada Y: começa rápida e desacelera → sobe primeiro
    Somadas, as duas retas viram uma curva natural (como um arremesso).
    Uma terceira camada só faz o "pop" de escala no começo.
    Tudo com Web Animations API (element.animate): transform/opacity,
    sem bibliotecas, e devolve uma Promise que resolve ao pousar.
  */
  function voarParaCarrinho(origem) {
    var alvo = document.querySelector('[data-carrinho-alvo]');
    var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!origem || !alvo || reduzir || !document.body.animate) return Promise.resolve();

    var a = origem.getBoundingClientRect();
    var b = alvo.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();

    var dx = b.left + b.width / 2 - (a.left + a.width / 2);
    var dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var duracao = Math.min(900, Math.max(550, Math.hypot(dx, dy) * 0.9));

    var eixoX = document.createElement('div');
    var eixoY = document.createElement('div');
    var ponto = document.createElement('div');
    eixoX.className = 'voo-carrinho';
    eixoX.style.left = a.left + a.width / 2 + 'px';
    eixoX.style.top = a.top + a.height / 2 + 'px';
    ponto.className = 'voo-carrinho__ponto';
    ponto.innerHTML = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    eixoY.appendChild(ponto);
    eixoX.appendChild(eixoY);
    document.body.appendChild(eixoX);

    var opcoes = { duration: duracao, fill: 'forwards' };
    var vooX = eixoX.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(' + dx + 'px)' }],
      Object.assign({ easing: 'cubic-bezier(0.45, 0, 0.85, 0.6)' }, opcoes)
    );
    eixoY.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(' + dy + 'px)' }],
      Object.assign({ easing: 'cubic-bezier(0.15, 0.7, 0.35, 1)' }, opcoes)
    );
    ponto.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.15)', opacity: 1, offset: 0.18 },
        { transform: 'scale(1)', opacity: 1, offset: 0.35 },
        { transform: 'scale(0.5)', opacity: 0.85 }
      ],
      opcoes
    );

    // .catch: se a animação for cancelada, NÃO pode rejeitar — senão o
    // handleSubmit entenderia como falha de rede e reenviaria o form.
    return vooX.finished.catch(function () {}).then(function () {
      eixoX.remove();
      // O ícone da sacola "recebe" o item
      alvo.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      );
    });
  }

  // Estilo do "+" voador — injetado uma vez (evita depender de um CSS a mais)
  (function injetarEstiloVoo() {
    var css =
      '.voo-carrinho{position:fixed;z-index:10002;pointer-events:none;width:0;height:0}' +
      '.voo-carrinho__ponto{position:absolute;left:-15px;top:-15px;width:30px;height:30px;display:grid;place-items:center;' +
      'border-radius:50%;color:var(--color-accent-text,#fff);background:var(--color-accent,#000);' +
      'box-shadow:0 8px 20px -6px rgb(0 0 0 / .35)}';
    var tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
  })();

  function refreshCartCount(animar) {
    return fetch(raiz + 'cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        updateCartCount(cart.item_count, animar);
        return cart;
      })
      .catch(function () { return null; });
  }

  function handleSubmit(event) {
    var form = event.target;
    if (!form.matches('form[action$="/cart/add"], form[data-type="add-to-cart-form"]')) return;

    event.preventDefault();
    var button = form.querySelector('[type="submit"], [name="add"]');
    if (button) button.setAttribute('aria-busy', 'true');
    emitir('carrinho:adicionando', { form: form });

    var erroDaApi = false;

    fetch(raiz + 'cart/add.js', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: new FormData(form)
    })
      .then(function (r) {
        return r.json().then(function (dados) {
          if (!r.ok) {
            erroDaApi = true;
            throw new Error(dados.description || dados.message || textos.cartError || 'Error');
          }
          return dados;
        });
      })
      .then(function (item) {
        // Voo do "+" e busca do carrinho atualizado acontecem EM PARALELO;
        // quando os dois terminam, o contador pula e o alerta aparece.
        var buscaCarrinho = fetch(raiz + 'cart.js', { headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .catch(function () { return null; });

        return Promise.all([buscaCarrinho, voarParaCarrinho(button)]).then(function (resultado) {
          var cart = resultado[0];
          if (cart) updateCartCount(cart.item_count, true);
          emitir('carrinho:adicionado', { form: form, item: item, cart: cart });
          if (typeof window.mostrarAlerta === 'function') {
            var nome = item && item.product_title ? item.product_title + ' — ' : '';
            window.mostrarAlerta(
              nome + (textos.addedToCart || 'Added to cart'),
              'positivo',
              5000,
              { texto: textos.viewCart || 'View cart', url: textos.cartUrl || raiz + 'cart' }
            );
          }
        });
      })
      .catch(function (erro) {
        if (!erroDaApi) {
          // Falha de rede/JSON: envia o formulário do jeito tradicional.
          form.submit();
          return;
        }
        emitir('carrinho:erro', { form: form, mensagem: erro.message });
        if (typeof window.mostrarAlerta === 'function') {
          window.mostrarAlerta(erro.message, 'negativo', 5000);
        }
      })
      .finally(function () {
        if (button) button.removeAttribute('aria-busy');
      });
  }

  document.addEventListener('submit', handleSubmit);
  document.addEventListener('DOMContentLoaded', function () { refreshCartCount(false); });
})();
