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
        return refreshCartCount(true).then(function (cart) {
          emitir('carrinho:adicionado', { form: form, item: item, cart: cart });
          if (typeof window.mostrarAlerta === 'function') {
            window.mostrarAlerta(textos.addedToCart || 'Added to cart', 'positivo');
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
