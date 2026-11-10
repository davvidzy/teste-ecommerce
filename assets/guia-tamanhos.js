/*
  ============================================================
  guia-tamanhos.js — calculadora de aro + abertura do pop-up
  ============================================================

  <calcula-aro> (snippets/guia-tamanhos.liquid)
    Converte a medida digitada em aro brasileiro:
      circunferência (mm) − 40 = aro
      diâmetro (mm) × π = circunferência
    Entre dois aros, arredonda PARA CIMA (anel um pouco folgado
    entra; apertado não). Acende a linha da tabela e rola até ela.

  [data-abrir-guia] (bloco "Guia de tamanhos" da página de produto)
    Abre o <dialog> indicado em aria-controls com showModal()
    (foco preso no pop-up, Esc fecha, fundo inerte — tudo nativo).
    Clicar no fundo escuro também fecha.
*/
(() => {
  const ARO_MIN = 10;
  const ARO_MAX = 30;
  const textos = (window.themeStrings && window.themeStrings.guia) || {};

  if (!customElements.get('calcula-aro')) {
    customElements.define('calcula-aro', class extends HTMLElement {
      connectedCallback() {
        this.campo = this.querySelector('[data-medida]');
        this.resultado = this.querySelector('[data-resultado]');
        this.vazio = this.resultado.textContent;
        this.addEventListener('input', () => this.calcular());
        this.addEventListener('change', () => this.calcular());
      }

      calcular() {
        const modo = this.querySelector('[data-modo]:checked')?.value;
        const valor = parseFloat(String(this.campo.value).replace(',', '.'));
        this.querySelectorAll('tr.is-ativo').forEach((tr) => tr.classList.remove('is-ativo'));

        if (!valor) { this.resultado.textContent = this.vazio; return; }

        const circunferencia = modo === 'diametro' ? valor * Math.PI : valor;
        const aro = Math.ceil(circunferencia - 40 - 0.05); // 0.05 de folga: 52,0 mm ainda é aro 12

        if (aro < ARO_MIN || aro > ARO_MAX) {
          this.resultado.textContent = textos.foraDaTabela || 'Medida fora da tabela — fale com a gente.';
          return;
        }

        this.resultado.innerHTML = (textos.resultado || 'Seu aro é <strong>[aro]</strong>').replace('[aro]', aro);
        const linha = this.querySelector(`tr[data-aro="${aro}"]`);
        if (linha) {
          linha.classList.add('is-ativo');
          const caixa = linha.closest('.guia__tabela-wrapper');
          // rola só a tabela (não a página), centralizando a linha
          if (caixa) caixa.scrollTo({ top: linha.offsetTop - caixa.clientHeight / 2 + linha.offsetHeight / 2, behavior: 'smooth' });
        }
      }
    });
  }

  document.addEventListener('click', (evento) => {
    const gatilho = evento.target.closest('[data-abrir-guia]');
    if (gatilho) {
      const dialogo = document.getElementById(gatilho.getAttribute('aria-controls'));
      if (dialogo && typeof dialogo.showModal === 'function') {
        evento.preventDefault();
        dialogo.showModal();
      }
      return;
    }
    if (evento.target.closest('[data-fechar-guia]')) {
      evento.target.closest('dialog')?.close();
      return;
    }
    // clique no "fundo": o alvo é o próprio <dialog>, fora da caixa de conteúdo
    if (evento.target.matches('dialog.guia-dialogo')) evento.target.close();
  });
})();
