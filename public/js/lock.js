// public/js/lock.js
// Pantalla de bloqueo por inactividad (15 minutos)
// Incluir este script en todas las páginas protegidas DESPUÉS de ApiClient.js

window.LockScreen = {
  _overlay: null,

  // Mostrar la pantalla de bloqueo
  async show() {
    if (document.getElementById('lock-overlay')) return;

    // Obtener lista de usuarios para el selector
    let users = [];
    try { users = await api.getUsers(); } catch (_) {}

    const currentUser = api.getUser();

    const overlay = document.createElement('div');
    overlay.id = 'lock-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(15,20,25,0.92);
      backdrop-filter:blur(12px);
      display:flex; align-items:center; justify-content:center;
      font-family:var(--sans, system-ui, sans-serif);
    `;

    const usersOptions = users.map(u =>
      `<option value="${u.username}" ${u.username === currentUser?.username ? 'selected' : ''}>
        ${u.username} ${u.role === 'admin' ? '(Admin)' : '(Cajero)'}
      </option>`
    ).join('');

    overlay.innerHTML = `
      <div style="
        background:var(--surface, #fff);
        border:1.5px solid var(--border, #e5e7eb);
        border-radius:20px; padding:40px 36px;
        width:360px; max-width:90vw;
        box-shadow:0 25px 60px rgba(0,0,0,0.4);
        text-align:center;
      ">
        <div style="font-size:48px; margin-bottom:12px;">🔒</div>
        <h2 style="font-family:var(--serif, Georgia, serif); font-size:22px; font-weight:900; margin:0 0 6px; color:var(--text, #111);">
          Sesión bloqueada
        </h2>
        <p style="color:var(--text-muted, #6b7280); font-size:13px; margin:0 0 24px;">
          La sesión se bloqueó por inactividad.<br>Ingresa tu contraseña para continuar.
        </p>

        ${users.length > 1 ? `
        <div style="margin-bottom:14px; text-align:left;">
          <label style="font-size:12px; font-weight:600; color:var(--text-muted, #6b7280); display:block; margin-bottom:6px;">Usuario</label>
          <select id="lock-user-select" style="
            width:100%; padding:10px 12px; border:1.5px solid var(--border, #e5e7eb);
            border-radius:10px; font-size:14px; background:var(--card, #f9fafb);
            color:var(--text, #111); cursor:pointer;
          ">${usersOptions}</select>
        </div>` : `
        <p style="font-weight:700; font-size:15px; margin-bottom:16px; color:var(--text, #111);">
          👤 ${currentUser?.username || 'Usuario'}
        </p>`}

        <div style="text-align:left; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:600; color:var(--text-muted, #6b7280); display:block; margin-bottom:6px;">Contraseña o PIN</label>
          <input type="password" id="lock-password" placeholder="Ingresa tu contraseña"
            style="
              width:100%; box-sizing:border-box; padding:12px 14px;
              border:1.5px solid var(--border, #e5e7eb);
              border-radius:10px; font-size:16px;
              background:var(--bg, #fff); color:var(--text, #111);
            "
            autocomplete="current-password"
          />
        </div>

        <div id="lock-error" style="
          color:#dc2626; font-size:13px; margin-bottom:12px;
          display:none; background:#fef2f2; padding:8px 12px;
          border-radius:8px; text-align:left;
        "></div>

        <button id="lock-btn" onclick="LockScreen.unlock()" style="
          width:100%; padding:13px; border:none; border-radius:10px;
          background:var(--green, #16a34a); color:white;
          font-size:15px; font-weight:700; cursor:pointer;
          font-family:inherit; transition:opacity 0.2s;
        ">Desbloquear →</button>

        <button onclick="LockScreen.logout()" style="
          width:100%; padding:10px; border:none; border-radius:10px;
          background:transparent; color:var(--text-muted, #6b7280);
          font-size:13px; cursor:pointer; margin-top:10px;
          font-family:inherit;
        ">Cerrar sesión completa</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this._overlay = overlay;

    // Foco automático en contraseña
    setTimeout(() => {
      const pwd = document.getElementById('lock-password');
      if (pwd) pwd.focus();
    }, 100);

    // Enter para desbloquear
    document.getElementById('lock-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.unlock();
    });
  },

  async unlock() {
    const btn      = document.getElementById('lock-btn');
    const errEl    = document.getElementById('lock-error');
    const password = document.getElementById('lock-password').value;
    const select   = document.getElementById('lock-user-select');
    const username = select ? select.value : api.getUser()?.username;

    if (!password) return;

    btn.disabled    = true;
    btn.textContent = 'Verificando...';
    errEl.style.display = 'none';

    try {
      await api.login(username, password);
      // Login exitoso → remover overlay y reiniciar timer
      if (this._overlay) {
        this._overlay.remove();
        this._overlay = null;
      }
      InactivityTimer.start();
      showToast(`✅ Bienvenido, ${username}`);

      // Actualizar nombre en la barra si existe
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = username;
      const avatarEl = document.getElementById('user-avatar');
      if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();

    } catch (err) {
      errEl.textContent   = err.message || 'Contraseña incorrecta.';
      errEl.style.display = 'block';
      document.getElementById('lock-password').value = '';
      document.getElementById('lock-password').focus();
      btn.disabled    = false;
      btn.textContent = 'Desbloquear →';
    }
  },

  logout() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    api.logout();
  }
};

// Iniciar timer en cuanto carga la página (si el usuario está autenticado)
document.addEventListener('DOMContentLoaded', () => {
  if (api.isAuthenticated()) {
    InactivityTimer.start();
  }
});
