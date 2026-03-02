// public/js/prestamos.js

class PrestamosPage {
  constructor() {
    if (!api.requireAuth()) return;
    if (!api.isAdmin()) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
          <div><div style="font-size:60px">🔒</div><h2>Acceso denegado</h2>
          <p>Esta sección es solo para administradores.</p>
          <a href="/pages/venta.html" class="btn btn-primary">← Volver a ventas</a></div>
        </div>`;
      return;
    }
    this._pendingCancelId = null;
    this._todos           = [];
    this._initUI();
    this.reload();
  }

  _initUI() {
    const user = api.getUser();
    if (user) {
      document.getElementById('user-name').textContent = user.username;
      document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }
  }

  async reload() {
    await Promise.all([this.loadResumen(), this.loadTabla()]);
  }

  // ── Saldo hero + desglose ─────────────────────────────────────
  async loadResumen() {
    const hero    = document.getElementById('saldo-hero');
    const desglose= document.getElementById('desglose-grid');
    try {
      const r = await api.getPrestamoResumen();
      const fmt = v => this._fmt(v);

      const { neto, detalle } = r;

      // Hero
      let heroClass = 'equilibrado';
      let heroTexto = '✅ Sin deudas pendientes';
      let heroSub   = 'Todo está al día entre José y Claudia';
      let heroMonto = '$0';

      if (neto.quien_debe === 'jose') {
        heroClass = 'jose-debe';
        heroTexto = '⚠️ José le debe a Claudia';
        heroSub   = 'Claudia cubrió pagos del área de José';
        heroMonto = fmt(neto.monto_neto);
      } else if (neto.quien_debe === 'claudia') {
        heroClass = 'claudia-debe';
        heroTexto = '⚠️ Claudia le debe a José';
        heroSub   = 'José cubrió pagos del área de Claudia';
        heroMonto = fmt(neto.monto_neto);
      }

      hero.className = `saldo-hero ${heroClass}`;
      hero.innerHTML = `
        <div class="hero-text">
          <h3>${heroTexto}</h3>
          <p>${heroSub} · ${r.total_activos} préstamo${r.total_activos !== 1 ? 's' : ''} pendiente${r.total_activos !== 1 ? 's' : ''}</p>
        </div>
        <div class="hero-monto">${heroMonto}</div>`;

      // Desglose por persona
      const joseColor    = detalle.jose_pago_por_claudia > 0 ? 'dc-positivo' : '';
      const claudiaColor = detalle.claudia_pago_por_jose > 0 ? 'dc-positivo' : '';

      desglose.innerHTML = `
        <!-- José -->
        <div class="desglose-card">
          <div class="dc-avatar">👨</div>
          <div class="dc-nombre">José</div>
          <div class="dc-area">🥦 Dueño de Verduras y Granos</div>
          <div class="dc-row">
            <span>Pagó en Carnicería (área de Claudia)</span>
            <span class="${joseColor}">${fmt(detalle.jose_pago_por_claudia)}</span>
          </div>
          <div class="dc-row">
            <span>Claudia le pagó a José en Verduras</span>
            <span>${fmt(detalle.claudia_pago_por_jose)}</span>
          </div>
          <div class="dc-row">
            <span>Saldo a favor de José</span>
            <span class="${neto.quien_debe === 'jose' ? 'dc-negativo' : 'dc-positivo'}">${fmt(Math.max(0, detalle.jose_pago_por_claudia - detalle.claudia_pago_por_jose))}</span>
          </div>
        </div>

        <!-- Claudia -->
        <div class="desglose-card">
          <div class="dc-avatar">👩</div>
          <div class="dc-nombre">Claudia</div>
          <div class="dc-area">🥩 Dueña de Carnicería</div>
          <div class="dc-row">
            <span>Pagó en Verduras y Granos (área de José)</span>
            <span class="${claudiaColor}">${fmt(detalle.claudia_pago_por_jose)}</span>
          </div>
          <div class="dc-row">
            <span>José le pagó a Claudia en Carnicería</span>
            <span>${fmt(detalle.jose_pago_por_claudia)}</span>
          </div>
          <div class="dc-row">
            <span>Saldo a favor de Claudia</span>
            <span class="${neto.quien_debe === 'claudia' ? 'dc-negativo' : 'dc-positivo'}">${fmt(Math.max(0, detalle.claudia_pago_por_jose - detalle.jose_pago_por_claudia))}</span>
          </div>
        </div>`;
    } catch(e) {
      hero.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
    }
  }

  // ── Tabla de préstamos ────────────────────────────────────────
  async loadTabla() {
    const tbody    = document.getElementById('prestamos-tbody');
    const estado   = document.getElementById('filter-estado').value;
    const persona  = document.getElementById('filter-persona').value;
    tbody.innerHTML= `<tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr>`;

    try {
      const soloActivos = estado === 'activos';
      this._todos = await api.getPrestamos(soloActivos);
      let rows    = this._todos;

      if (persona) {
        rows = rows.filter(r => r.pagador === persona || r.beneficiario === persona);
      }

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:24px"><div class="icon" style="font-size:32px">🤝</div><p>Sin préstamos en este período</p></div></td></tr>`;
        return;
      }

      // Total de activos
      const totalActivo = rows.filter(r => !r.cancelado).reduce((a, r) => a + parseFloat(r.monto || 0), 0);

      let html = rows.map(r => {
        const fecha     = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
        const chipPag   = this._chip(r.pagador);
        const chipBen   = this._chip(r.beneficiario);
        const deptLabel = r.departamento === 'carniceria' ? '🥩 Carnicería' : '🥦 Verduras y Granos';
        const badge     = r.cancelado
          ? `<span class="badge-cancelado">✅ Cancelado</span>`
          : `<span class="badge-activo">⏳ Pendiente</span>`;
        const canceladoInfo = r.cancelado
          ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">por ${r.cancelado_by || '—'}</div>` : '';
        const acciones = r.cancelado
          ? `<button class="btn btn-danger btn-sm" title="Eliminar registro" onclick="prestamosPage.eliminar('${r.id}')">🗑️</button>`
          : `<button class="btn btn-primary btn-sm" onclick="prestamosPage.abrirConfirm('${r.id}')">✅ Cancelado</button>`;

        return `
          <tr class="prestamo-row${r.cancelado ? ' cancelado' : ''}">
            <td>${fecha}</td>
            <td>${chipPag}</td>
            <td style="font-size:13px">${deptLabel}</td>
            <td>${chipBen}</td>
            <td><strong>${this._fmt(r.monto)}</strong></td>
            <td style="font-size:12px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notas||''}">${r.notas || '—'}</td>
            <td>${badge}${canceladoInfo}</td>
            <td>${acciones}</td>
          </tr>`;
      }).join('');

      // Fila de total activo
      if (totalActivo > 0) {
        html += `
          <tr class="total-row">
            <td colspan="4" style="text-align:right;color:var(--text-muted)">Total pendiente</td>
            <td colspan="4" style="color:var(--red)">${this._fmt(totalActivo)}</td>
          </tr>`;
      }

      tbody.innerHTML = html;
    } catch(e) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">${e.message}</td></tr>`;
    }
  }

  // ── Modal de confirmación ─────────────────────────────────────
  abrirConfirm(id) {
    const row = this._todos.find(r => r.id === id);
    if (!row) return;
    this._pendingCancelId = id;

    document.getElementById('confirm-text').textContent =
      `¿Confirmas que ${this._nombre(row.beneficiario)} le pagó a ${this._nombre(row.pagador)} este préstamo?`;

    document.getElementById('confirm-detalle').innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--text-muted)">Quién pagó originalmente</span>
        <strong>${this._nombre(row.pagador)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--text-muted)">Área cubierta</span>
        <strong>${row.departamento === 'carniceria' ? '🥩 Carnicería' : '🥦 Verduras y Granos'}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--text-muted)">Referencia</span>
        <span>${row.notas || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
        <span style="color:var(--text-muted)">Monto a cancelar</span>
        <strong style="font-size:18px;color:var(--green)">${this._fmt(row.monto)}</strong>
      </div>`;

    document.getElementById('confirm-modal').classList.add('open');
  }

  closeConfirm() {
    document.getElementById('confirm-modal').classList.remove('open');
    this._pendingCancelId = null;
  }

  async confirmarCancelacion() {
    if (!this._pendingCancelId) return;
    const btn = document.getElementById('btn-confirm-ok');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      await api.cancelarPrestamo(this._pendingCancelId);
      showToast('✅ Préstamo cancelado correctamente');
      this.closeConfirm();
      this.reload();
    } catch(e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '✅ Confirmar pago';
    }
  }

  async eliminar(id) {
    if (!confirm('¿Eliminar este registro de préstamo permanentemente?')) return;
    try {
      await api.deletePrestamo(id);
      showToast('🗑️ Registro eliminado');
      this.reload();
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
  }

  clearFilters() {
    document.getElementById('filter-estado').value  = 'activos';
    document.getElementById('filter-persona').value = '';
    this.loadTabla();
  }

  _chip(persona) {
    const cls = persona === 'jose' ? 'chip-jose' : persona === 'claudia' ? 'chip-claudia' : 'chip-unknown';
    const ico = persona === 'jose' ? '👨' : persona === 'claudia' ? '👩' : '👤';
    return `<span class="persona-chip ${cls}">${ico} ${this._nombre(persona)}</span>`;
  }

  _nombre(p) {
    if (p === 'jose')    return 'José';
    if (p === 'claudia') return 'Claudia';
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : '—';
  }

  _fmt(v) { return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(v||0); }
}

document.addEventListener('DOMContentLoaded', () => { window.prestamosPage = new PrestamosPage(); });
