import { xtreamApi } from './xtream-api.js';
import { authService } from './auth-service.js';
import { CONFIG } from '../config.js';

class ChannelsService {
  #categories = null;
  #streamsByCategory = new Map();
  #allStreamsCache = null;

  async getCategories() {
    if (this.#categories) return this.#categories;
    const creds = authService.getCredentials();
    if (!creds) throw new Error('No hay sesión activa');

    this.#categories = await xtreamApi.getLiveCategories(creds.username, creds.password);
    return this.#categories;
  }

  async getStreams(categoryId = null) {
    const cacheKey = categoryId ?? '__all__';
    if (this.#streamsByCategory.has(cacheKey)) {
      return this.#streamsByCategory.get(cacheKey);
    }

    const creds = authService.getCredentials();
    if (!creds) throw new Error('No hay sesión activa');

    const streams = await xtreamApi.getLiveStreams(creds.username, creds.password, categoryId);
    this.#streamsByCategory.set(cacheKey, streams);
    return streams;
  }

  // Trae todas las categorías y aplana sus streams en una sola lista.
  // Para catálogos muy grandes conviene paginar por categoría en vez de esto,
  // pero para un listado tipo "Descubrir mas contenido" funciona bien.
  async getAllStreamsFlat() {
    if (this.#allStreamsCache) return this.#allStreamsCache;

    const categories = await this.getCategories();
    const results = await Promise.all(
      categories.map((c) => this.getStreams(c.category_id).catch(() => []))
    );
    this.#allStreamsCache = results.flat();
    return this.#allStreamsCache;
  }

  getCategoryName(categories, categoryId) {
    const cat = categories.find((c) => c.category_id === categoryId);
    return cat ? cat.category_name : '';
  }

  getStreamUrl(streamId, ext = 'm3u8') {
    const creds = authService.getCredentials();
    if (!creds) throw new Error('No hay sesión activa');

    const upstreamUrl = xtreamApi.buildStreamUrl(creds.username, creds.password, streamId, ext);
    return CONFIG.transcode
      ? `${CONFIG.transcodeUrl}?streamUrl=${encodeURIComponent(upstreamUrl)}`
      : CONFIG.mode === 'proxy'
        ? `${CONFIG.streamProxyUrl}?streamUrl=${encodeURIComponent(upstreamUrl)}`
      : upstreamUrl;
  }

  clearCache() {
    this.#categories = null;
    this.#streamsByCategory.clear();
    this.#allStreamsCache = null;
  }
}

export const channelsService = new ChannelsService();
