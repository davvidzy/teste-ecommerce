/*
  ============================================================
  carrossel.js — <trilho-carrossel>: setas para um trilho com scroll-snap
  ============================================================

  O QUE FAZ:
  O trilho em si é CSS puro (overflow-x + scroll-snap): funciona com
  dedo, trackpad e sem JS. Este componente só acrescenta as setas:
  - avançar/voltar rolam exatamente um card (largura + gap);
  - as setas desligam nas pontas e somem se tudo couber na tela.

  MARCAÇÃO:
  <trilho-carrossel>
    <button data-voltar>…</button> <button data-avancar>…</button>
    <ul data-trilho> <li>…</li> … </ul>
  </trilho-carrossel>

  USADO EM: sections/depoimentos.liquid, sections/categorias.liquid.
*/
if (!customElements.get('trilho-carrossel')) {
  customElements.define('trilho-carrossel', class extends HTMLElement {
    connectedCallback() {
      this.trilho = this.querySelector('[data-trilho]');
      this.voltar = this.querySelector('[data-voltar]');
      this.avancar = this.querySelector('[data-avancar]');
      if (!this.trilho) return;

      this.voltar?.addEventListener('click', () => this.rolar(-1));
      this.avancar?.addEventListener('click', () => this.rolar(1));

      // rAF: o evento scroll dispara dezenas de vezes por segundo
      let agendado = false;
      this.trilho.addEventListener('scroll', () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(() => { agendado = false; this.atualizar(); });
      }, { passive: true });

      this.observador = new ResizeObserver(() => this.atualizar());
      this.observador.observe(this.trilho);
      this.atualizar();
    }

    disconnectedCallback() { this.observador?.disconnect(); }

    passo() {
      const item = this.trilho.firstElementChild;
      if (!item) return this.trilho.clientWidth;
      const gap = parseFloat(getComputedStyle(this.trilho).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    }

    rolar(direcao) {
      this.trilho.scrollBy({ left: direcao * this.passo(), behavior: 'smooth' });
    }

    atualizar() {
      const { scrollLeft, scrollWidth, clientWidth } = this.trilho;
      const sobra = scrollWidth - clientWidth;
      this.toggleAttribute('data-cabe', sobra <= 2);
      if (this.voltar) this.voltar.disabled = scrollLeft <= 2;
      if (this.avancar) this.avancar.disabled = scrollLeft >= sobra - 2;
    }
  });
}
