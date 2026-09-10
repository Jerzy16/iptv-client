import { channelsService } from '../services/channels-service.js';
import { attachStream, detachStream } from '../services/player-service.js';
import { navigate } from '../core/router.js';
import { refreshFocusables } from '../core/focus-manager.js';
import '../components/channel-card.js';

let hideControlsTimeout = null;
let keydownHandler = null;

export async function renderPlayerView(streamId) {
  cleanupPreviousInstance();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="player-screen">
      <video id="player-video" autoplay playsinline></video>

      <div class="player-overlay visible" id="player-overlay">
        <div class="player-top">
          <button class="icon-btn" id="btn-back" data-focusable aria-label="Volver">←</button>
          <div class="player-info">
            <p class="player-channel-name" id="player-channel-name">Cargando...</p>
            <p class="player-channel-category" id="player-channel-category"></p>
          </div>
        </div>

        <div class="player-bottom">
          <button class="icon-btn" id="btn-play-pause" data-focusable aria-label="Pausar">⏸</button>
          <div class="player-channel-row" id="player-channel-row"></div>
        </div>
      </div>
    </div>
  `;

  const video = document.getElementById('player-video');
  const nameEl = document.getElementById('player-channel-name');
  const categoryEl = document.getElementById('player-channel-category');
  const playPauseBtn = document.getElementById('btn-play-pause');
  const overlay = document.getElementById('player-overlay');

  video.addEventListener('error', () => {
    console.error('[Player] HTMLVideoElement error', video.error);
  });
  video.addEventListener('loadedmetadata', () => {
    console.info('[Player] Video metadata', {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration
    });
  });

  document.getElementById('btn-back').addEventListener('click', goBack);

  try {
    const [categories, streams] = await Promise.all([
      channelsService.getCategories(),
      channelsService.getAllStreamsFlat()
    ]);

    const stream = streams.find((s) => String(s.stream_id) === String(streamId)) || streams[0];
    if (!stream) throw new Error('Canal no encontrado');

    const categoryName = channelsService.getCategoryName(categories, stream.category_id);
    nameEl.textContent = `${stream.num}.${stream.name}`;
    categoryEl.textContent = categoryName.toUpperCase();

    const url = channelsService.getStreamUrl(stream.stream_id);
    await attachStream(video, url);

    const row = document.getElementById('player-channel-row');
    streams.forEach((s) => {
      const card = document.createElement('channel-card');
      card.setAttribute('name', `${s.num}.${s.name}`);
      card.setAttribute('icon', s.stream_icon || '');
      card.setAttribute('stream-id', s.stream_id);
      if (String(s.stream_id) === String(stream.stream_id)) card.classList.add('active');
      row.appendChild(card);
    });

    row.addEventListener('channel-select', (e) => {
      navigate(`/player/${e.detail.streamId}`);
    });
  } catch (err) {
    nameEl.textContent = 'Error al cargar el canal';
    categoryEl.textContent = 'Revisa la consola: ' + (err.message || 'error de reproducción');
    console.error(err);
  }

  playPauseBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      playPauseBtn.textContent = '⏸';
    } else {
      video.pause();
      playPauseBtn.textContent = '▶';
    }
  });

  video.addEventListener('click', () => overlay.classList.toggle('visible'));

  keydownHandler = () => resetHideControlsTimer(overlay);
  document.addEventListener('keydown', keydownHandler);
  resetHideControlsTimer(overlay);

  function goBack() {
    cleanupPreviousInstance();
    detachStream(video);
    navigate('/channels');
  }

  refreshFocusables(app);
}

function resetHideControlsTimer(overlay) {
  overlay.classList.add('visible');
  clearTimeout(hideControlsTimeout);
  hideControlsTimeout = setTimeout(() => overlay.classList.remove('visible'), 5000);
}

function cleanupPreviousInstance() {
  clearTimeout(hideControlsTimeout);
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
}
