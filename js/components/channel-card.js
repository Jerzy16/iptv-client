export class ChannelCard extends HTMLElement {
  connectedCallback() {
    this.setAttribute('data-focusable', '');
    this.setAttribute('tabindex', '0');
    this.render();

    this.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('channel-select', {
        bubbles: true,
        composed: true,
        detail: { streamId: this.getAttribute('stream-id') }
      }));
    });
  }

  render() {
    const name = this.getAttribute('name') || '';
    const icon = this.getAttribute('icon') || '';
    const initials = name.replace(/^\d+\.\d+\s*/, '').slice(0, 2).toUpperCase();

    this.innerHTML = `
      <div class="channel-card">
        ${icon
          ? `<img src="${icon}" alt="${name}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'channel-card-fallback',textContent:'${initials}'}))" />`
          : `<div class="channel-card-fallback">${initials}</div>`
        }
        <span class="channel-card-name">${name}</span>
      </div>
    `;
  }
}

customElements.define('channel-card', ChannelCard);
