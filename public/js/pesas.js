// Bloquear acceso a cajeros
document.addEventListener('DOMContentLoaded', () => {
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
    return; // detener el resto del script
  }
});

class PesasPage {
  constructor() {
    if (!api.requireAuth()) return;
    this._currentEditId = null;
    this._initUI();
    this.loadScales();
  }

  _initUI() {
    const user = api.getUser();
    if (user) { document.getElementById('user-name').textContent = user.username; document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase(); }
  }

  async loadScales() {
    const vBody = document.getElementById('tbody-scales-verduras');
    const cBody = document.getElementById('tbody-scales-carniceria');
    [vBody, cBody].forEach(b => b.innerHTML = `<tr><td colspan="5"><div class="loading-center"><div class="spinner"></div></div></td></tr>`);
    try {
      const scales = await api.getScales();
      this._renderGroup(vBody, scales.filter(s => s.department === 'verduras_granos'));
      this._renderGroup(cBody, scales.filter(s => s.department === 'carniceria'));
    } catch(e) { vBody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:20px">${e.message}</td></tr>`; }
  }

  _renderGroup(tbody, scales) {
    if (!scales.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:30px"><div class="icon" style="font-size:32px">⚖️</div><p>No hay pesas registradas aquí.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = scales.map(s => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.unit}</td>
        <td>${s.capacity ? s.capacity + ' ' + s.unit : '—'}</td>
        <td>${s.notes || '—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <span class="badge ${s.active ? 'badge-green' : 'badge-muted'}">${s.active ? 'Activa' : 'Inactiva'}</span>
            <button class="btn btn-secondary btn-sm" onclick="pesasPage.openModal('${s.id}')">Editar</button>
            <button class="btn btn-danger btn-sm"    onclick="pesasPage.deleteScale('${s.id}','${s.name.replace(/'/g,"\\'")}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  openModal(scaleId = null) {
    this._currentEditId = scaleId;
    document.getElementById('modal-title-scale').textContent = scaleId ? 'Editar pesa' : 'Nueva pesa';
    document.getElementById('modal-scale-error').classList.remove('show');
    ['modal-scale-name','modal-scale-capacity','modal-scale-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modal-scale-unit').value   = 'kg';
    document.getElementById('modal-scale-dept').value   = 'verduras_granos';
    document.getElementById('modal-scale-active').value = 'true';

    if (scaleId) {
      api.getScales().then(scales => {
        const s = scales.find(x => x.id === scaleId);
        if (s) {
          document.getElementById('modal-scale-name').value     = s.name;
          document.getElementById('modal-scale-unit').value     = s.unit;
          document.getElementById('modal-scale-capacity').value = s.capacity || '';
          document.getElementById('modal-scale-dept').value     = s.department;
          document.getElementById('modal-scale-active').value   = String(s.active);
          document.getElementById('modal-scale-notes').value    = s.notes || '';
        }
      });
    }
    document.getElementById('scale-modal').classList.add('open');
  }

  closeModal() { document.getElementById('scale-modal').classList.remove('open'); }

  async saveScale() {
    const name     = document.getElementById('modal-scale-name').value.trim();
    const unit     = document.getElementById('modal-scale-unit').value;
    const capacity = parseFloat(document.getElementById('modal-scale-capacity').value) || null;
    const dept     = document.getElementById('modal-scale-dept').value;
    const active   = document.getElementById('modal-scale-active').value === 'true';
    const notes    = document.getElementById('modal-scale-notes').value.trim();
    const errEl    = document.getElementById('modal-scale-error');
    errEl.classList.remove('show');

    if (!name) { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.add('show'); return; }

    const btn = document.getElementById('btn-save-scale');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const payload = { name, unit, capacity, department: dept, active, notes: notes || null };
      if (this._currentEditId) { await api.updateScale(this._currentEditId, payload); showToast('✅ Pesa actualizada'); }
      else { await api.createScale(payload); showToast('✅ Pesa registrada'); }
      this.closeModal(); this.loadScales();
    } catch(e) { errEl.textContent = e.message; errEl.classList.add('show'); }
    finally { btn.disabled = false; btn.textContent = 'Guardar'; }
  }

  async deleteScale(id, name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try { await api.deleteScale(id); showToast(`🗑 "${name}" eliminada`); this.loadScales(); }
    catch(e) { showToast('Error: ' + e.message, 'error'); }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.pesasPage = new PesasPage();
  document.getElementById('scale-modal').addEventListener('click', function(e) { if (e.target === this) pesasPage.closeModal(); });
});
