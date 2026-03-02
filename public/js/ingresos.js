// public/js/ingresos.js — v2 con selección de persona y prestamos automáticos

// Dueños de cada área (deben coincidir con PrestamoService.js)
const DUENOS = { verduras_granos: 'jose', carniceria: 'claudia' };

class IngresosPage {
  constructor() {
    if (!api.requireAuth()) return;
    if (!api.isAdmin()) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
          <div>
            <div style="font-size:60px">🔒</div>
            <h2>Acceso denegado</h2>
            <p>Esta sección es solo para administradores.</p>
            <a href="/pages/venta.html" class="btn btn-primary">← Volver a ventas</a>
          </div>
        </div>`;
      return;
    }
    this._editId      = null;
    this._pag2Visible = false;
    this._initUI();
    this._setDefaultDates();
    this.loadResumen();
    this.load();
  }

  // ── UI init ───────────────────────────────────────────────────
  _initUI() {
    const user = api.getUser();
    if (user) {
      document.getElementById('user-name').textContent   = user.username;
      document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }
  }

  _setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();
    const sun   = new Date(now); sun.setDate(now.getDate() - now.getDay());
    document.getElementById('filter-from').value = sun.toISOString().split('T')[0];
    document.getElementById('filter-to').value   = today;
  }

  // ── Formato de moneda ─────────────────────────────────────────
  _fmt(v) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', minimumFractionDigits: 0
    }).format(v || 0);
  }

  // ── Formato de fecha/hora Colombia (UTC-5) ───────────────────
  _fmtDatetime(iso) {
    if (!iso) return '—';
    // Convertir de UTC a Colombia (UTC-5)
    const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
    const date = d.toISOString().split('T')[0];
    const time = d.toISOString().split('T')[1].slice(0, 5);
    const [y, m, day] = date.split('-');
    const dateLabel = new Date(Date.UTC(+y, +m - 1, +day))
      .toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });
    return `${dateLabel} · ${time}`;
  }

  // ── Resumen del día ───────────────────────────────────────────
  async loadResumen() {
    const el = document.getElementById('resumen-hoy');
    try {
      const s   = await api.getIngresoStats();
      const fmt = v => this._fmt(v);
      el.innerHTML = `
        <div class="resumen-card">
          <div class="label">📥 Total recibido hoy</div>
          <div class="value green">${fmt(s.today.total)}</div>
          <div class="sub">${s.today.count} ingreso${s.today.count !== 1 ? 's' : ''}</div>
        </div>
        <div class="resumen-card">
          <div class="label">🥦 Verduras y Granos hoy</div>
          <div class="value" style="color:#065F46">${fmt(s.today.verduras_granos)}</div>
          <div class="sub">Área de José</div>
        </div>
        <div class="resumen-card">
          <div class="label">🥩 Carnicería hoy</div>
          <div class="value" style="color:#9A3412">${fmt(s.today.carniceria)}</div>
          <div class="sub">Área de Claudia</div>
        </div>`;
    } catch (e) {
      el.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
    }
  }

  // ── Cargar historial ──────────────────────────────────────────
  async load() {
    const from    = document.getElementById('filter-from').value;
    const to      = document.getElementById('filter-to').value;
    const dept    = document.getElementById('filter-dept').value;
    const persona = document.getElementById('filter-persona').value;
    const list    = document.getElementById('ingresos-list');
    list.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    try {
      let rows = await api.getIngresos(from || null, to || null, dept || null);
      // Filtro por persona (local)
      if (persona) {
        rows = rows.filter(r =>
          (r.pagador_1 || '').toLowerCase() === persona ||
          (r.pagador_2 || '').toLowerCase() === persona
        );
      }
      this._render(rows, list);
    } catch (e) {
      list.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
    }
  }

  // ── Renderizar lista ──────────────────────────────────────────
  _render(rows, container) {
    if (!rows.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon" style="font-size:36px">📭</div>
          <p>Sin ingresos en este período</p>
        </div>`;
      return;
    }

    const fmt = v => this._fmt(v);

    // Agrupar por fecha
    const groups = {};
    rows.forEach(r => {
      const d = r.fecha;
      if (!groups[d]) groups[d] = [];
      groups[d].push(r);
    });

    let html = '';
    for (const fecha of Object.keys(groups).sort().reverse()) {
      const items    = groups[fecha];
      const totalDia = items.reduce((a, r) => a + parseFloat(r.monto_total || 0), 0);
      const dateLabel = new Date(fecha + 'T12:00:00')
        .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

      html += `
        <div class="day-group">
          <div class="day-group-header">
            <h4>${dateLabel}</h4>
            <span class="day-total">${items.length} ingreso${items.length !== 1 ? 's' : ''} · ${fmt(totalDia)}</span>
          </div>`;

      items.forEach(r => {
        const deptTag = r.departamento === 'carniceria'
          ? '<span class="dept-tag carniceria">🥩 Carnicería</span>'
          : '<span class="dept-tag verduras">🥦 Verduras y Granos</span>';

        // Chips de pagadores
        let pagadores = '';
        if (r.pagador_1) {
          const p1 = (r.pagador_1 || '').toLowerCase();
          const chip1Class = p1 === 'jose' ? 'jose' : p1 === 'claudia' ? 'claudia' : 'otro';
          const icon1 = p1 === 'jose' ? '👨' : p1 === 'claudia' ? '👩' : '👤';
          const name1 = p1 === 'jose' ? 'José' : p1 === 'claudia' ? 'Claudia' : r.pagador_1;
          pagadores += `
            <div class="pagador-row">
              <span class="pagador-chip ${chip1Class}">${icon1} ${name1}</span>
              <span style="font-weight:600">${fmt(r.monto_1)}</span>
              ${this._prestamoTag(p1, r.departamento)}
            </div>`;
        }
        if (r.pagador_2) {
          const p2 = (r.pagador_2 || '').toLowerCase();
          const chip2Class = p2 === 'jose' ? 'jose' : p2 === 'claudia' ? 'claudia' : 'otro';
          const icon2 = p2 === 'jose' ? '👨' : p2 === 'claudia' ? '👩' : '👤';
          const name2 = p2 === 'jose' ? 'José' : p2 === 'claudia' ? 'Claudia' : r.pagador_2;
          pagadores += `
            <div class="pagador-row">
              <span class="pagador-chip ${chip2Class}">${icon2} ${name2}</span>
              <span style="font-weight:600">${fmt(r.monto_2)}</span>
              ${this._prestamoTag(p2, r.departamento)}
            </div>`;
        }

        // Usuario que registró + hora
        const username = r.users?.username || null;
        const registradoPor = username
          ? `<span class="ingreso-registro">
               🕐 ${this._fmtDatetime(r.created_at)}
               &nbsp;·&nbsp; registrado por <span class="registro-user">@${username}</span>
             </span>`
          : r.created_at
            ? `<span class="ingreso-registro">🕐 ${this._fmtDatetime(r.created_at)}</span>`
            : '';

        html += `
          <div class="ingreso-card">
            <div class="ingreso-info">
              <div class="ingreso-producto">${r.producto}</div>
              <div class="ingreso-meta">
                ${deptTag}
                ${r.cantidad ? `<span>· ${r.cantidad}</span>` : ''}
              </div>
              ${pagadores ? `<div class="ingreso-pagadores">${pagadores}</div>` : ''}
              ${r.notas ? `<div style="font-size:12px;color:var(--text-muted);margin-top:5px">📝 ${r.notas}</div>` : ''}
              ${registradoPor}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <div class="ingreso-monto">${fmt(r.monto_total)}</div>
              <div class="ingreso-actions">
                <button class="btn btn-secondary btn-sm" onclick="ingresosPage.openModal('${r.id}')" title="Editar">✏️</button>
                <button class="btn btn-danger btn-sm"    onclick="ingresosPage.confirmDelete('${r.id}','${r.producto.replace(/'/g, "\\'")}')">🗑️</button>
              </div>
            </div>
          </div>`;
      });

      html += `</div>`; // cierra day-group
    }

    container.innerHTML = html;
  }

  // Badge de préstamo (cuando alguien paga en área ajena)
  _prestamoTag(pagador, departamento) {
    const dueno = DUENOS[departamento];
    if (!dueno || pagador === dueno || !pagador) return '';
    const quien = pagador === 'jose' ? 'José' : 'Claudia';
    const area  = departamento === 'carniceria' ? 'Carnicería' : 'Verduras';
    return `<span style="font-size:10px;background:#FEF3C7;color:#92400E;border-radius:99px;padding:2px 8px;font-weight:700;border:1px solid #FCD34D">
      🤝 Préstamo generado
    </span>`;
  }

  // ── Modal ─────────────────────────────────────────────────────
  openModal(editId = null) {
    this._editId = editId;

    // Reset
    ['m-producto', 'm-cantidad', 'm-notas'].forEach(id => document.getElementById(id).value = '');
    ['m-mon1', 'm-mon2'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-pag1').value  = '';
    document.getElementById('m-pag2').value  = '';
    document.getElementById('m-dept').value  = 'verduras_granos';
    document.getElementById('m-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('m-total').value = '0';
    document.getElementById('m-total-display').textContent = '$0';
    document.getElementById('modal-error').textContent = '';
    document.getElementById('modal-error').classList.remove('show');

    // Limpiar selección de personas
    this._clearPersonaSelection(1);
    this._clearPersonaSelection(2);
    this._hideAlert(1);
    this._hideAlert(2);

    // Ocultar pagador 2
    this._pag2Visible = false;
    document.getElementById('pag2-wrap').style.display   = 'none';
    document.getElementById('btn-add-pag2').textContent  = '+ Agregar segundo pagador';

    document.getElementById('modal-title').textContent = editId ? 'Editar ingreso' : 'Registrar ingreso';

    if (editId) this._loadForEdit(editId);

    document.getElementById('ingreso-modal').classList.add('open');
  }

  async _loadForEdit(id) {
    try {
      const rows = await api.getIngresos();
      const r = rows.find(x => x.id === id);
      if (!r) return;
      document.getElementById('m-producto').value = r.producto || '';
      document.getElementById('m-dept').value     = r.departamento || 'verduras_granos';
      document.getElementById('m-cantidad').value = r.cantidad || '';
      document.getElementById('m-fecha').value    = r.fecha || '';
      document.getElementById('m-mon1').value     = r.monto_1 || '';
      document.getElementById('m-notas').value    = r.notas || '';

      if (r.pagador_1) {
        const p1 = r.pagador_1.toLowerCase();
        if (p1 === 'jose' || p1 === 'claudia') {
          this.selectPersona(1, p1);
        }
      }
      if (r.pagador_2) {
        this._pag2Visible = false;
        this.togglePag2();
        document.getElementById('m-mon2').value = r.monto_2 || '';
        const p2 = r.pagador_2.toLowerCase();
        if (p2 === 'jose' || p2 === 'claudia') {
          this.selectPersona(2, p2);
        }
      }
      this.calcTotal();
    } catch (e) { showToast('Error cargando: ' + e.message, 'error'); }
  }

  closeModal() { document.getElementById('ingreso-modal').classList.remove('open'); }

  // ── Selector de persona (José / Claudia) ──────────────────────
  selectPersona(num, persona) {
    document.getElementById(`m-pag${num}`).value = persona;
    const container = document.getElementById(`persona${num}-selector`);
    container.querySelectorAll('.persona-btn').forEach(btn => {
      btn.classList.remove('selected-jose', 'selected-claudia');
      if (btn.dataset.val === persona) {
        btn.classList.add(`selected-${persona}`);
      }
    });
    this._checkPrestamoAlert(num);
    this.calcTotal();
  }

  _clearPersonaSelection(num) {
    const container = document.getElementById(`persona${num}-selector`);
    if (!container) return;
    container.querySelectorAll('.persona-btn').forEach(btn => {
      btn.classList.remove('selected-jose', 'selected-claudia');
    });
    const inp = document.getElementById(`m-pag${num}`);
    if (inp) inp.value = '';
  }

  // Detectar si el pago generaría un préstamo y mostrar alerta
  _checkPrestamoAlert(num) {
    const pagador = document.getElementById(`m-pag${num}`)?.value;
    const dept    = document.getElementById('m-dept')?.value;
    const dueno   = DUENOS[dept];
    const alertEl = document.getElementById(`alert-pag${num}`);
    const textEl  = document.getElementById(`alert-pag${num}-text`);
    if (!alertEl) return;

    if (pagador && dueno && pagador !== dueno) {
      const quien    = pagador === 'jose' ? 'José' : 'Claudia';
      const duenoN   = dueno === 'jose' ? 'José' : 'Claudia';
      const area     = dept === 'carniceria' ? 'Carnicería' : 'Verduras y Granos';
      textEl.textContent = `${quien} está recibiendo dinero del área de ${duenoN} (${area}). Se generará un préstamo automáticamente en la sección de Préstamos.`;
      alertEl.classList.add('show');
    } else {
      this._hideAlert(num);
    }
  }

  _hideAlert(num) {
    const el = document.getElementById(`alert-pag${num}`);
    if (el) el.classList.remove('show');
  }

  // Cuando cambia el área, re-chequear alertas
  onDeptChange() {
    if (document.getElementById('m-pag1').value) this._checkPrestamoAlert(1);
    if (this._pag2Visible && document.getElementById('m-pag2').value) this._checkPrestamoAlert(2);
  }

  togglePag2() {
    this._pag2Visible = !this._pag2Visible;
    document.getElementById('pag2-wrap').style.display  = this._pag2Visible ? 'block' : 'none';
    document.getElementById('btn-add-pag2').textContent = this._pag2Visible ? '− Quitar segundo pagador' : '+ Agregar segundo pagador';
    if (!this._pag2Visible) {
      this._clearPersonaSelection(2);
      document.getElementById('m-mon2').value = '';
      this._hideAlert(2);
      this.calcTotal();
    }
  }

  calcTotal() {
    const m1    = parseFloat(document.getElementById('m-mon1').value) || 0;
    const m2    = this._pag2Visible ? (parseFloat(document.getElementById('m-mon2').value) || 0) : 0;
    const total = m1 + m2;
    document.getElementById('m-total').value = total;
    document.getElementById('m-total-display').textContent = this._fmt(total);
    // Re-chequear alertas al cambiar montos
    if (document.getElementById('m-pag1').value) this._checkPrestamoAlert(1);
    if (this._pag2Visible && document.getElementById('m-pag2').value) this._checkPrestamoAlert(2);
  }

  async save() {
    const producto     = document.getElementById('m-producto').value.trim();
    const departamento = document.getElementById('m-dept').value;
    const cantidad     = document.getElementById('m-cantidad').value.trim();
    const fecha        = document.getElementById('m-fecha').value;
    const pagador_1    = document.getElementById('m-pag1').value.trim();
    const monto_1      = parseFloat(document.getElementById('m-mon1').value) || 0;
    const pagador_2    = this._pag2Visible ? document.getElementById('m-pag2').value.trim() : '';
    const monto_2      = this._pag2Visible ? (parseFloat(document.getElementById('m-mon2').value) || 0) : 0;
    const monto_total  = monto_1 + monto_2;
    const notas        = document.getElementById('m-notas').value.trim();
    const errEl        = document.getElementById('modal-error');
    errEl.textContent  = '';
    errEl.classList.remove('show');

    if (!producto)        { errEl.textContent = 'El producto es obligatorio.';            errEl.classList.add('show'); return; }
    if (!pagador_1)       { errEl.textContent = 'Selecciona quién recibió el dinero.';    errEl.classList.add('show'); return; }
    if (monto_total <= 0) { errEl.textContent = 'El monto debe ser mayor a 0.';           errEl.classList.add('show'); return; }
    if (this._pag2Visible && pagador_2 && pagador_2 === pagador_1) {
      errEl.textContent = 'El segundo pagador no puede ser el mismo que el primero.';
      errEl.classList.add('show'); return;
    }

    const payload = {
      producto, departamento,
      cantidad: cantidad || null,
      fecha, monto_total,
      pagador_1, monto_1,
      pagador_2: pagador_2 || null,
      monto_2:   pagador_2 ? monto_2 : null,
      notas:     notas || null
    };

    const btn = document.getElementById('btn-save-ingreso');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      if (this._editId) {
        await api.updateIngreso(this._editId, payload);
        showToast('✅ Ingreso actualizado');
      } else {
        await api.createIngreso(payload);
        // Feedback si hubo préstamos
        const dueno = DUENOS[departamento];
        const hayPrestamo = (pagador_1 && pagador_1 !== dueno) ||
                            (pagador_2 && pagador_2 !== dueno);
        if (hayPrestamo) {
          showToast('✅ Ingreso registrado · 🤝 Préstamo generado en sección Préstamos');
        } else {
          showToast('✅ Ingreso registrado');
        }
      }
      this.closeModal();
      this.loadResumen();
      this.load();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }

  confirmDelete(id, nombre) {
    if (!confirm(`¿Eliminar el ingreso "${nombre}"?`)) return;
    api.deleteIngreso(id)
      .then(() => { showToast('🗑️ Eliminado'); this.loadResumen(); this.load(); })
      .catch(e => showToast('Error: ' + e.message, 'error'));
  }

  clearFilters() {
    document.getElementById('filter-from').value    = '';
    document.getElementById('filter-to').value      = '';
    document.getElementById('filter-dept').value    = '';
    document.getElementById('filter-persona').value = '';
    this.load();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ingresosPage = new IngresosPage();
});
