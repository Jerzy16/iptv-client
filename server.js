// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.static(__dirname));

const IPTV_HOST = '192.168.200.6';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const TRANSCODE_ROOT = path.join(os.tmpdir(), 'figo-iptv-hls');
const transcodes = new Map();
let transcodeRequestId = 0;
let transcodeOperation = Promise.resolve();

fs.mkdirSync(TRANSCODE_ROOT, { recursive: true });

function getUpstreamUrl(value) {
  const upstream = new URL(value);
  if (upstream.hostname !== IPTV_HOST || !['http:', 'https:'].includes(upstream.protocol)) {
    throw new Error('Origen de stream no permitido');
  }
  return upstream;
}

function proxyUrl(url) {
  return `/stream-proxy?streamUrl=${encodeURIComponent(url.href)}`;
}

function rewriteManifest(manifest, manifestUrl) {
  return manifest.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#EXT-X-ENDLIST')) return line;

    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, value) => {
        const childUrl = new URL(value, manifestUrl);
        return `URI="${proxyUrl(childUrl)}"`;
      });
    }

    const childUrl = new URL(trimmed, manifestUrl);
    return proxyUrl(childUrl);
  }).join('\n');
}

function transcodeKey(url) {
  return crypto.createHash('sha256').update(url.href).digest('hex').slice(0, 24);
}

function safeFileName(value) {
  return value.split(/[\\/]/).pop();
}

function stopTranscode(state) {
  if (!state) return Promise.resolve();
  transcodes.delete(state.key);
  if (state.process.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    state.process.once('close', resolve);
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(state.process.pid), '/T', '/F'], { windowsHide: true });
      } catch {
        state.process.kill();
      }
    } else {
      state.process.kill('SIGTERM');
    }
    setTimeout(resolve, 3000);
  });
}

async function stopOtherTranscodes(activeKey) {
  await Promise.all([...transcodes.values()]
    .filter((state) => state.key !== activeKey)
    .map((state) => stopTranscode(state)));
}

async function startTranscode(upstreamUrl, includeAudio = true) {
  const operation = transcodeOperation.then(() => startTranscodeInternal(upstreamUrl, includeAudio));
  transcodeOperation = operation.catch(() => {});
  return operation;
}

async function startTranscodeInternal(upstreamUrl, includeAudio = true) {
  const key = transcodeKey(upstreamUrl);
  const outputDir = path.join(TRANSCODE_ROOT, key);
  const playlistPath = path.join(outputDir, 'index.m3u8');
  const existing = transcodes.get(key);
  if (existing) return existing;

  await stopOtherTranscodes(key);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const proxiedInputUrl = `http://127.0.0.1:${PORT}/stream-proxy?streamUrl=${encodeURIComponent(upstreamUrl.href)}`;
  const ffmpeg = spawn(FFMPEG_PATH, [
    '-hide_banner', '-loglevel', 'warning',
    '-user_agent', 'VLC/3.0.18',
    '-http_persistent', '0',
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
    '-analyzeduration', '10M', '-probesize', '50M', '-fpsprobesize', '200',
    '-fflags', '+genpts+discardcorrupt', '-err_detect', 'ignore_err',
    '-i', proxiedInputUrl,
    '-map', '0:v:0', ...(includeAudio ? ['-map', '0:a:0?'] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-level', '4.1', '-r', '25',
    '-b:v', '2500k', '-maxrate', '2800k', '-bufsize', '5000k',
    ...(includeAudio ? ['-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '2', '-ar', '44100', '-af', 'aresample=async=1:first_pts=0'] : []),
    '-avoid_negative_ts', 'make_zero',
    '-f', 'hls', '-hls_segment_type', 'mpegts',
    '-hls_time', '3', '-hls_list_size', '10',
    '-hls_flags', 'delete_segments+independent_segments+program_date_time',
    '-hls_segment_filename', path.join(outputDir, 'segment-%06d.ts'),
    playlistPath
  ], { windowsHide: true });

  const state = { key, outputDir, playlistPath, process: ffmpeg, error: null, includeAudio };
  transcodes.set(key, state);
  ffmpeg.stderr.on('data', (data) => console.warn(`[FFmpeg ${key}] ${data.toString().trim()}`));
  ffmpeg.on('error', (error) => {
    state.error = error;
    transcodes.delete(key);
  });
  ffmpeg.on('close', (code) => {
    transcodes.delete(key);
    if (code !== 0 && !state.error) {
      state.error = new Error(`FFmpeg terminó con código ${code}`);
      console.error(`[FFmpeg ${key}] terminó con código ${code}`);
    }
  });
  return state;
}

app.get('/stream-transcode', async (req, res) => {
  const { streamUrl } = req.query;
  if (!streamUrl) return res.status(400).send('URL de video no proporcionada');

  try {
    const requestId = ++transcodeRequestId;
    const upstreamUrl = getUpstreamUrl(streamUrl);
    let state = await startTranscode(upstreamUrl, true);
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(state.playlistPath) && !state.error && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!fs.existsSync(state.playlistPath) && !state.includeAudio) {
      return res.status(502).send(`FFmpeg no pudo crear el manifest transcodificado: ${state.error?.message || 'fuente inválida'}`);
    }

    if (!fs.existsSync(state.playlistPath)) {
      if (requestId !== transcodeRequestId) return res.status(409).send('Solicitud de canal reemplazada');
      console.warn(`[FFmpeg ${state.key}] La pista de audio no es válida; reintentando solo video.`);
      await stopTranscode(state);
      if (requestId !== transcodeRequestId) return res.status(409).send('Solicitud de canal reemplazada');
      state = await startTranscode(upstreamUrl, false);
      const fallbackDeadline = Date.now() + 15000;
      while (!fs.existsSync(state.playlistPath) && !state.error && Date.now() < fallbackDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (state.error) {
      return res.status(502).send(`No se pudo abrir el canal: ${state.error.message}`);
    }
    if (!fs.existsSync(state.playlistPath)) {
      return res.status(502).send('FFmpeg no pudo crear el manifest transcodificado');
    }
    const playlist = fs.readFileSync(state.playlistPath, 'utf8').split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, value) => {
          return `URI="/stream-transcode-files/${state.key}/${safeFileName(value)}"`;
        });
      }
      return `/stream-transcode-files/${state.key}/${trimmed}`;
    }).join('\n');
    res.type('application/vnd.apple.mpegurl').set('Cache-Control', 'no-store').send(playlist);
  } catch (error) {
    console.error('Error iniciando transcodificación:', error.message);
    res.status(500).send(error.message);
  }
});

app.use('/stream-transcode-files', express.static(TRANSCODE_ROOT, {
  fallthrough: true,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (filePath.endsWith('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    if (filePath.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');
    if (filePath.endsWith('.m4s')) res.setHeader('Content-Type', 'video/iso.segment');
    if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
  }
}));

app.get('/stream-transcode-playlist/:key/index.m3u8', (req, res) => {
  const state = transcodes.get(req.params.key);
  if (!state) return res.status(404).send('Transcodificación no encontrada');
  res.sendFile(state.playlistPath);
});

function stopTranscodes() {
  for (const state of transcodes.values()) stopTranscode(state);
}

process.on('SIGINT', () => {
  stopTranscodes();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopTranscodes();
  process.exit(0);
});
process.on('exit', stopTranscodes);

// Proxy exclusivo para el flujo de video (Video Stream)
app.get('/stream-proxy', async (req, res) => {
  const { streamUrl } = req.query;

  if (!streamUrl) {
    return res.status(400).send('URL de video no proporcionada');
  }

  try {
    const upstreamUrl = getUpstreamUrl(streamUrl);
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await axios({
        method: 'get',
        url: upstreamUrl.href,
        responseType: 'arraybuffer',
        validateStatus: () => true,
        headers: {
          'User-Agent': 'VLC/3.0.18',
          Accept: '*/*',
          Connection: 'close'
        }
      });
      if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }

    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).send(`El proveedor respondió HTTP ${response.status}`);
    }

    const contentType = response.headers['content-type'] || '';
    const buffer = Buffer.from(response.data);
    const isManifest = contentType.includes('mpegurl') || /^#EXTM3U/m.test(buffer.toString('utf8'));
    const body = isManifest ? rewriteManifest(buffer.toString('utf8'), upstreamUrl) : response.data;

    res.status(response.status);
    res.setHeader('Content-Type', isManifest ? 'application/vnd.apple.mpegurl' : (contentType || 'application/octet-stream'));
    if (response.headers['cache-control']) res.setHeader('Cache-Control', response.headers['cache-control']);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.send(body);
  } catch (error) {
    console.error('Error al reproducir el canal:', error.message);
    res.status(500).send('Error en la retransmisión');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy de Video corriendo en http://localhost:${PORT}`);
});