import { channelsService } from '../services/channels-service.js';
import { authService } from '../services/auth-service.js';
import { navigate } from '../core/router.js';
import { refreshFocusables } from '../core/focus-manager.js';
import '../components/channel-card.js';
import '../components/loading-spinner.js';

// Recuerda el canal destacado mientras dura la sesión de navegación
let featuredStream = null;

export async function renderChannelsView() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="channels-screen"><loading-spinner></loading-spinner></div>`;

  let categories, streams;
  try {
    categories = await channelsService.getCategories();
    streams = await channelsService.getAllStreamsFlat();
  } catch (err) {
    app.innerHTML = `<div class="channels-screen"><p class="empty-state">Error cargando canales: ${err.message}</p></div>`;
    return;
  }

  if (!streams.length) {
    app.innerHTML = `<div class="channels-screen"><p class="empty-state">No hay canales disponibles en tu cuenta</p></div>`;
    return;
  }

  featuredStream = featuredStream || streams[0];
  const categoryName = channelsService.getCategoryName(categories, featuredStream.category_id);

  app.innerHTML = `
    <div class="channels-screen">
      <div class="top-bar">
        <button class="icon-btn" id="btn-home" data-focusable aria-label="Inicio">⌂</button>
        <button class="icon-btn" id="btn-exit" data-focusable aria-label="Salir">⏻</button>
      </div>

      <div class="featured-banner" style="background-image:url('${escapeUrl(featuredStream.stream_icon)}')">
        <div class="featured-overlay">
          <p class="featured-title">${escapeHtml(featuredStream.num)}.${escapeHtml(featuredStream.name)}</p>
          <p class="featured-category">${escapeHtml(categoryName.toUpperCase())}</p>
          <button class="btn-ver-ahora" id="btn-ver-ahora" data-focusable>▶ Ver ahora</button>
        </div>
      </div>

      <div class="discover-section">
        <h2>Descubrir mas contenido</h2>
        <div class="channel-row" id="channel-row"></div>
      </div>
    </div>
  `;

  const row = document.getElementById('channel-row');
  streams.forEach((s) => {
    const card = document.createElement('channel-card');
    card.setAttribute('name', `${s.num}.${s.name}`);
    card.setAttribute('icon', s.stream_icon || '');
    card.setAttribute('stream-id', s.stream_id);
    row.appendChild(card);
  });

  row.addEventListener('channel-select', (e) => {
    navigate(`/player/${e.detail.streamId}`);
  });

  document.getElementById('btn-ver-ahora').addEventListener('click', () => {
    navigate(`/player/${featuredStream.stream_id}`);
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    // Ya estamos en el home de canales; útil si luego agregas más secciones
    navigate('/channels');
  });

  document.getElementById('btn-exit').addEventListener('click', async () => {
    await authService.logout();
    channelsService.clearCache();
    featuredStream = null;
    navigate('/login');
  });

  refreshFocusables(app);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeUrl(url) {
  return String(url || '').replace(/['"]/g, '');
}
