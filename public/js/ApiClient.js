// public/js/ApiClient.js

class ApiClient {
  constructor() { this.baseUrl = '/api'; }
  getToken()        { return localStorage.getItem('placita_token'); }
  setToken(t)       { localStorage.setItem('placita_token', t); }
  clearToken()      { localStorage.removeItem('placita_token'); localStorage.removeItem('placita_user'); }
  getUser()         { return JSON.parse(localStorage.getItem('placita_user') || 'null'); }
  setUser(u)        { localStorage.setItem('placita_user', JSON.stringify(u)); }
  isAuthenticated() { return !!this.getToken(); }

  isAdmin()   { const u = this.getUser(); return u && u.role === 'admin'; }
  isCajero()  { const u = this.getUser(); return u && u.role === 'cajero'; }
  getRole()   { const u = this.getUser(); return u ? u.role : null; }

  _getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = this.getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }

  async _request(method, endpoint, body = null) {
    const options = { method, headers: this._getHeaders() };
    if (body !== null) options.body = JSON.stringify(body);
    const response = await fetch(this.baseUrl + endpoint, options);
    if (response.status === 401) { this.clearToken(); window.location.href = '/pages/index.html'; return; }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('Error del servidor (respuesta no-JSON). Revisa que la tabla caja_base exista en Supabase.'); }
    if (!response.ok) throw new Error(data.error || 'Error ' + response.status);
    return data;
  }

  get(e)        { return this._request('GET',    e); }
  post(e, b)    { return this._request('POST',   e, b); }
  put(e, b)     { return this._request('PUT',    e, b); }
  patch(e, b)   { return this._request('PATCH',  e, b); }
  delete(e)     { return this._request('DELETE', e); }

  async login(username, password) {
    const data = await this.post('/auth/login', { username, password });
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  }
  register(username, password, role) { return this.post('/auth/register', { username, password, role }); }
  logout() { this.clearToken(); window.location.href = '/pages/index.html'; }
  requireAuth() { if (!this.isAuthenticated()) { window.location.href = '/pages/index.html'; return false; } return true; }

  getUsers() { return this.get('/auth/users'); }

  getProducts(onlyActive = false, department = null) {
    let qs = onlyActive ? '?active=true' : '';
    if (department) qs += (qs ? '&' : '?') + `department=${department}`;
    return this.get(`/products${qs}`);
  }
  createProduct(d)         { return this.post('/products', d); }
  updateProduct(id, d)     { return this.put(`/products/${id}`, d); }
  updatePrice(id, price)   { return this.patch(`/products/${id}/price`, { price }); }
  updateOrder(id, order)   { return this.patch(`/products/${id}/order`, { sort_order: order }); }
  deleteProduct(id)        { return this.delete(`/products/${id}`); }

  createSale(items, total, notes) { return this.post('/sales', { items, total, notes }); }
  getSales(from = null, to = null) {
    const p = new URLSearchParams();
    if (from) p.append('from', from);
    if (to)   p.append('to', to);
    const qs = p.toString();
    return this.get(`/sales${qs ? '?' + qs : ''}`);
  }
  getSaleStats() { return this.get('/sales/stats'); }

  getScales()        { return this.get('/scales'); }
  createScale(d)     { return this.post('/scales', d); }
  updateScale(id, d) { return this.put(`/scales/${id}`, d); }
  deleteScale(id)    { return this.delete(`/scales/${id}`); }

  // ── Ingresos (pedidos que llegan al local) ─────────────────
  createIngreso(d)       { return this.post('/ingresos', d); }
  updateIngreso(id, d)   { return this.put(`/ingresos/${id}`, d); }
  deleteIngreso(id)      { return this.delete(`/ingresos/${id}`); }
  getIngresos(from, to, departamento) {
    const p = new URLSearchParams();
    if (from)         p.append('from', from);
    if (to)           p.append('to', to);
    if (departamento) p.append('departamento', departamento);
    const qs = p.toString();
    return this.get(`/ingresos${qs ? '?' + qs : ''}`);
  }
  getIngresoStats() { return this.get("/ingresos/stats"); }

  // 25002500 Pr00e9stamos entre socios 25002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500
  getPrestamos(soloActivos = false) { return this.get(`/prestamos?soloActivos=${soloActivos}`); }
  getPrestamoResumen()              { return this.get("/prestamos/resumen"); }
  cancelarPrestamo(id)              { return this.patch(`/prestamos/${id}/cancelar`, {}); }
  deletePrestamo(id)                { return this.delete(`/prestamos/${id}`); }

  // ── Base de caja ──────────────────────────────────────────────
  getCajaBase(fecha)                         { return this.get(`/caja-base?fecha=${fecha}`); }
  saveCajaBase(fecha, verduras, carniceria, general) { return this.post('/caja-base', { fecha, verduras_granos: verduras, carniceria, general: general||0 }); }
}

const api = new ApiClient();

// ── Toast global ───────────────────────────────────────────────
function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = type;
  el.classList.add('show');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Temporizador de inactividad (15 minutos) ──────────────────
window.InactivityTimer = {
  _timer: null,
  TIMEOUT_MS: 15 * 60 * 1000,

  start() {
    this._reset();
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
      .forEach(ev => document.addEventListener(ev, () => this._reset(), { passive: true }));
  },

  _reset() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._lock(), this.TIMEOUT_MS);
  },

  _lock() {
    if (document.getElementById('lock-overlay')) return;
    if (window.LockScreen) window.LockScreen.show();
  },

  stop() {
    clearTimeout(this._timer);
  }
};
