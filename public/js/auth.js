// public/js/auth.js

class AuthPage {
  constructor() {
    if (api.isAuthenticated()) {
      window.location.href = '/pages/venta.html';
      return;
    }
    this._bindEvents();
  }

  switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab)
    );
    document.getElementById('form-login').style.display    = tab === 'login'    ? 'flex' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';
  }

  async login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('btn-login');

    errEl.classList.remove('show');
    if (!username || !password)
      return this._showError(errEl, 'Completa todos los campos.');

    this._setLoading(btn, true, 'Ingresando...');
    try {
      await api.login(username, password);
      window.location.href = '/pages/venta.html';
    } catch (error) {
      this._showError(errEl, error.message);
    } finally {
      this._setLoading(btn, false, 'Ingresar');
    }
  }

  async register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    const sucEl    = document.getElementById('reg-success');
    const btn      = document.getElementById('btn-register');

    errEl.classList.remove('show');
    sucEl.classList.remove('show');

    if (!username || !password)
      return this._showError(errEl, 'Completa todos los campos.');
    if (password.length < 4)
      return this._showError(errEl, 'Mínimo 4 caracteres o dígitos.');

    this._setLoading(btn, true, 'Creando cuenta...');
    try {
      await api.register(username, password);
      sucEl.textContent = '✅ Cuenta creada. Ya puedes ingresar.';
      sucEl.classList.add('show');
      this.switchTab('login');
      document.getElementById('login-username').value = username;
    } catch (error) {
      this._showError(errEl, error.message);
    } finally {
      this._setLoading(btn, false, 'Crear cuenta');
    }
  }

  _showError(el, msg)           { el.textContent = msg; el.classList.add('show'); }
  _setLoading(btn, state, text) { btn.disabled = state; btn.textContent = text; }

  _bindEvents() {
    document.getElementById('login-password')
      .addEventListener('keydown', e => { if (e.key === 'Enter') this.login(); });
    document.getElementById('reg-password')
      .addEventListener('keydown', e => { if (e.key === 'Enter') this.register(); });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.authPage = new AuthPage();
});
