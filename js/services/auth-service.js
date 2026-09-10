import { xtreamApi } from './xtream-api.js';
import { setSecure, getSecure, removeSecure } from '../core/secure-storage.js';
import { store } from '../core/state.js';

class AuthService {
  async login(username, password) {
    const response = await xtreamApi.authenticate(username, password);

    if (!response?.user_info) {
      throw new Error('Respuesta inválida del servidor');
    }
    if (response.user_info.status !== 'Active') {
      throw new Error(`Cuenta ${response.user_info.status.toLowerCase()}`);
    }

    store.set('session', { ...response, username, password });
    await setSecure('xtream_session', { username, password });
    return response;
  }

  async restoreSession() {
    const saved = await getSecure('xtream_session');
    if (!saved) return false;

    try {
      await this.login(saved.username, saved.password);
      return true;
    } catch {
      await this.logout();
      return false;
    }
  }

  async logout() {
    store.set('session', null);
    removeSecure('xtream_session');
  }

  isAuthenticated() {
    return store.get('session')?.user_info?.status === 'Active';
  }

  getCredentials() {
    const s = store.get('session');
    return s ? { username: s.username, password: s.password } : null;
  }
}

export const authService = new AuthService();
