let currentHls = null;

export async function attachStream(videoElement, streamUrl) {
  detachStream(videoElement);

  // Silenciar para evitar bloqueos por políticas de Autoplay del navegador
  videoElement.muted = true;

  // CASO 1: HLS.js disponible (Chrome, Android TV, Tizen)
  if (window.Hls && Hls.isSupported()) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let mediaRecoveryAttempts = 0;
      currentHls = new Hls({
        enableWorker: false,
        maxBufferLength: 10,
        lowLatencyMode: false,
        autoStartLoad: true
      });

      currentHls.loadSource(streamUrl);
      currentHls.attachMedia(videoElement);

      currentHls.on(Hls.Events.MEDIA_ATTACHED, () => {
        currentHls.on(Hls.Events.MANIFEST_PARSED, async (_event, data) => {
          console.info('[Player] HLS manifest parsed', {
            levels: data.levels?.length,
            codecs: data.levels?.map((level) => level.videoCodec || level.audioCodec),
            url: streamUrl
          });
          try {
            await videoElement.play();
            videoElement.muted = false;
            settled = true;
            resolve();
          } catch (err) {
            console.warn('[Player] No se pudo iniciar la reproducción:', err);
            if (!settled) reject(err);
          }
        });
      });

      currentHls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[Player] HLS error', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          response: data.response,
          error: data.error
        });
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[Player] Error de red, reintentando HLS...');
              currentHls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoveryAttempts < 1) {
                mediaRecoveryAttempts += 1;
                console.warn('[Player] Error de media, recuperando HLS una vez...');
                currentHls.recoverMediaError();
              } else {
                if (!settled) reject(new Error(`HLS ${data.details || 'mediaError'}`));
                detachStream(videoElement);
              }
              break;
            default:
              if (!settled) reject(new Error(`HLS ${data.details || data.type}`));
              detachStream(videoElement);
              break;
          }
        }
      });
    });
  }

  // CASO 2: Reproducción nativa (Safari / LG webOS)
  if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    videoElement.src = streamUrl;
    try {
      await videoElement.play();
      videoElement.muted = false;
    } catch (err) {
      if (err.name !== 'AbortError') console.error("Error nativo:", err);
    }
    return;
  }

  // CASO 3: Flujos directos MPEG-TS (.ts)
  videoElement.src = streamUrl;
  try {
    await videoElement.play();
    videoElement.muted = false;
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
      console.error("Error reproduciendo .ts:", err);
    }
  }
}

export function detachStream(videoElement) {
  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }
  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
  }
}