import { initRouter, registerRoute, navigate } from './core/router.js';
import { initRemoteControl } from './core/remote-control.js';
import { authService } from './services/auth-service.js';
import { renderLoginView } from './views/login-view.js';
import { renderChannelsView } from './views/channels-view.js';
import { renderPlayerView } from './views/player-view.js';

registerRoute('/login', renderLoginView);
registerRoute('/channels', renderChannelsView);
registerRoute('/player', renderPlayerView);

initRemoteControl();

// Al abrir la app, intenta restaurar sesión antes de decidir a dónde ir
authService.restoreSession().then((ok) => {
  initRouter();
  if (ok && (location.hash === '' || location.hash === '#/login')) {
    navigate('/channels');
  }
});