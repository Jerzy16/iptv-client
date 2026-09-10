export class LoadingSpinner extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div class="spinner" role="status" aria-label="Cargando"></div>`;
  }
}

customElements.define('loading-spinner', LoadingSpinner);
