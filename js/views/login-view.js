import { authService } from '../services/auth-service.js';
import { navigate } from '../core/router.js';
import { refreshFocusables } from '../core/focus-manager.js';

export function renderLoginView() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-screen">
      <button class="icon-btn btn-back" id="btn-back" data-focusable aria-label="Volver">←</button>

      <div class="login-card">
        <div class="logo-circle">
          <img src="assets/logo.png" alt="Logo" onerror="this.style.display='none'" />
        </div>

        <h1>Ingresa tus credenciales para acceder</h1>

        <form id="login-form" novalidate>
          <input type="text" id="username" data-focusable placeholder="Ingresa tu usuario" autocomplete="username" required />
          <input type="password" id="password" data-focusable placeholder="Ingresa tu contraseña" autocomplete="current-password" required />
          <p id="login-error" class="error-message" hidden></p>
          <button type="submit" class="btn-primary" id="btn-submit" data-focusable>Iniciar Sesion</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('btn-submit');

  document.getElementById('btn-back').addEventListener('click', () => history.back());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      errorEl.textContent = 'Ingresa usuario y contraseña';
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';

    try {
      await authService.login(username, password);
      navigate('/channels');
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo iniciar sesión';
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesion';
    }
  });

  refreshFocusables(app);
}
