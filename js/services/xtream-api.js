import { CONFIG } from '../config.js';

class XtreamApiService {
  async authenticate(username, password) {
    const url = `${CONFIG.apiBaseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo conectar al servidor');
    return res.json();
  }

  async getLiveCategories(username, password) {
    const url = `${CONFIG.apiBaseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudieron cargar las categorías');
    return res.json();
  }

  async getLiveStreams(username, password, categoryId = null) {
    let url = `${CONFIG.apiBaseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
    if (categoryId) url += `&category_id=${encodeURIComponent(categoryId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudieron cargar los canales');
    return res.json();
  }

  buildStreamUrl(username, password, streamId, ext = 'm3u8') {
    return `${CONFIG.apiBaseUrl}/live/${username}/${password}/${streamId}.${ext}`;
  }
}

export const xtreamApi = new XtreamApiService();
