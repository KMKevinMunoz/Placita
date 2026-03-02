// public/js/contabilidad.js — limpio, usa CajaBase global de caja_base.js

class ContabilidadPage {
  constructor() {
    if (!api.requireAuth()) return;
    if (!api.isAdmin()) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
          <div><div style="font-size:60px">🔒</div><h2>Acceso denegado</h2>
          <p>Solo administradores.</p>
          <a href="/pages/venta.html" class="btn btn-primary">← Volver</a></div></div>`;
      return;
    }
    this._base  = null;
    this._today = this._localToday();
    this._initUI();
    this._initDateBar();
    this._loadBaseHoy().then(() => {
      this._renderBaseBanner();
      Promise.all([this.loadStats(), this.loadSales()]);
    });
  }

  _initUI() {
    const user = api.getUser();
    if (user) {
      const av = document.getElementById('user-avatar');
      const nm = document.getElementById('user-name');
      if (av) av.textContent = user.username[0].toUpperCase();
      if (nm) nm.textContent = user.username;
    }
    document.getElementById('btn-logout')?.addEventListener('click', () => api.logout());
  }

  _localToday() {
    return new Date(Date.now() - 5 * 3600 * 1000).toISOString().split('T')[0];
  }

  // ── Nequi & Cuentas del día ─────────────────────────────
  _nequiKey() { return 'placita_nequi_' + this._today; }

  _getNequi() {
    try { return JSON.parse(localStorage.getItem(this._nequiKey())) || { verduras: 0, carniceria: 0 }; }
    catch { return { verduras: 0, carniceria: 0 }; }
  }

  _saveNequi(v, c) {
    localStorage.setItem(this._nequiKey(), JSON.stringify({ verduras: parseFloat(v)||0, carniceria: parseFloat(c)||0 }));
  }

  _renderCuentasDia(today, ingresos, base) {
    const el = document.getElementById('cuentas-dia');
    if (!el) return;

    const nq = this._getNequi();
    const nqVerd = nq.verduras || 0;
    const nqCarn = nq.carniceria || 0;
    const nqTotal = nqVerd + nqCarn;

    const ventaV = today.verduras_granos || 0;
    const ventaC = today.carniceria || 0;
    const ventaT = today.total || 0;

    const baseV = base.verduras_granos || 0;
    const baseC = base.carniceria || 0;
    const baseT = (base.verduras_granos||0) + (base.carniceria||0) + (base.general||0);

    const netaV = Math.max(0, ventaV - baseV);
    const netaC = Math.max(0, ventaC - baseC);
    const netaT = Math.max(0, ventaT - baseT);

    const efecV = Math.max(0, netaV - nqVerd);
    const efecC = Math.max(0, netaC - nqCarn);
    const efecT = Math.max(0, netaT - nqTotal);

    const ingT = ingresos.total || 0;
    const difT = efecT - ingT;
    const difOk = difT >= 0;

    const row = (lbl, v, color='') =>
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:12px;color:var(--text-muted)">' + lbl + '</span>' +
        '<span style="font-weight:700;font-size:14px;' + (color ? 'color:'+color : '') + '">' + this._fmt(v) + '</span>' +
      '</div>';

    const col = (title, icon, color, v1lbl, v1, v2lbl, v2, v3lbl, v3, v4lbl, v4) =>
      '<div style="background:var(--surface);border:2px solid ' + color + ';border-radius:var(--radius);padding:16px;flex:1;min-width:200px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
          '<span style="font-size:22px">' + icon + '</span>' +
          '<span style="font-family:var(--serif);font-size:15px;font-weight:700;color:var(--text)">' + title + '</span>' +
        '</div>' +
        row(v1lbl, v1) + row(v2lbl, v2) + row(v3lbl, v3) +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:4px">' +
          '<span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">' + v4lbl + '</span>' +
          '<span style="font-family:var(--serif);font-size:24px;font-weight:900;color:' + color + '">' + this._fmt(v4) + '</span>' +
        '</div>' +
      '</div>';

    el.innerHTML =
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
        col('Ventas del día','🛒','var(--green)',
          '🥦 Verduras y Granos', ventaV,
          '🥩 Carnicería', ventaC,
          '📦 Base descontada (−)', -baseT,
          'Total ventas netas', netaT
        ) +
        col('Pagos Nequi','📱','#7C3AED',
          '🥦 Nequi Verduras', nqVerd,
          '🥩 Nequi Carnicería', nqCarn,
          '💳 Total Nequi', nqTotal,
          'Queda en efectivo', efecT
        ) +
        col('Efectivo esperado','💵', difOk ? 'var(--green)' : 'var(--red)',
          '💰 Efectivo neto', efecT,
          '📥 Ingresos recibidos', ingT,
          (difOk ? '✅ Sobrante' : '⚠️ Faltante'), Math.abs(difT),
          difOk ? 'Sobra' : 'Falta', Math.abs(difT)
        ) +
      '</div>' +
      '<div style="background:var(--card);border:1.5px solid var(--border);border-radius:var(--radius);padding:16px">' +
        '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:12px">📱 Registrar pagos Nequi del día</div>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' +
          '<div style="flex:1;min-width:140px">' +
            '<label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;display:block">🥦 Nequi Verduras</label>' +
            '<input type="number" id="nq-verd" value="' + nqVerd + '" min="0" step="100" placeholder="0"' +
            '  style="width:100%;padding:10px;font-size:16px;font-weight:700;font-family:var(--serif)"' +
            '  oninput="contabilidadPage._saveNequi(this.value,document.getElementById('nq-carn').value);contabilidadPage._renderCuentasDia(contabilidadPage._lastToday,contabilidadPage._lastIngresos,contabilidadPage._lastBase)" />' +
          '</div>' +
          '<div style="flex:1;min-width:140px">' +
            '<label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;display:block">🥩 Nequi Carnicería</label>' +
            '<input type="number" id="nq-carn" value="' + nqCarn + '" min="0" step="100" placeholder="0"' +
            '  style="width:100%;padding:10px;font-size:16px;font-weight:700;font-family:var(--serif)"' +
            '  oninput="contabilidadPage._saveNequi(document.getElementById('nq-verd').value,this.value);contabilidadPage._renderCuentasDia(contabilidadPage._lastToday,contabilidadPage._lastIngresos,contabilidadPage._lastBase)" />' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);padding-bottom:12px">Los valores se guardan automáticamente para hoy.</div>' +
        '</div>' +
      '</div>';
  }

  _fmt(v) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(v || 0);
  }

  _initDateBar() {
    const today = this._today;
    document.getElementById('filter-from').value = today;
    document.getElementById('filter-to').value   = today;
    initDateRangeBar('sales-drb', (from, to) => this.loadSales(from, to));
  }

  async reload() {
    await this._loadBaseHoy();
    this._renderBaseBanner();
    await Promise.all([this.loadStats(), this.loadSales()]);
  }

  async _loadBaseHoy() {
    try {
      this._base = await api.getCajaBase(this._today);
    } catch (_) {
      this._base = { registrada: false, verduras_granos: 0, carniceria: 0, general: 0, total: 0 };
    }
  }

  _renderBaseBanner() {
    const el = document.getElementById('base-banner');
    if (!el) return;
    const b = this._base;
    if (!b || !b.registrada) {
      el.innerHTML = `
        <div class="base-banner pending">
          <div class="bb-info">
            <h4>📦 Base de caja no registrada hoy</h4>
            <p>Las ventas netas se muestran sin descontar la base.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="CajaBase._inject();CajaBase.show()" style="flex-shrink:0">+ Registrar</button>
        </div>`;
    } else {
      const quien = b.registrado_por ? ` · @${b.registrado_por}` : '';
      el.innerHTML = `
        <div class="base-banner done">
          <div class="bb-info">
            <h4>✅ Base registrada${quien}</h4>
            <p>Total: ${this._fmt(b.total)}</p>
          </div>
          <div class="bb-amounts">
            <div class="base-amount-item">🥦 <span>${this._fmt(b.verduras_granos)}</span></div>
            <div class="base-amount-item">🥩 <span>${this._fmt(b.carniceria)}</span></div>
            ${b.general > 0 ? '<div class="base-amount-item">💵 <span>' + this._fmt(b.general) + '</span></div>' : ''}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="CajaBase._inject();CajaBase.show()" style="flex-shrink:0">✏️ Editar</button>
        </div>`;
    }
  }

  async loadStats() {
    const grid = document.getElementById('personas-grid');
    const res  = document.getElementById('stats-resumen');
    grid.innerHTML = '<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>';
    res.innerHTML  = '<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>';

    try {
      const [s, si] = await Promise.all([api.getSaleStats(), api.getIngresoStats()]);
      const b = this._base || { verduras_granos: 0, carniceria: 0, general: 0 };

      const makeCard = (isJose) => {
        const cls       = isJose ? 'jose' : 'claudia';
        const avatar    = isJose ? '👨' : '👩';
        const nombre    = isJose ? 'José' : 'Claudia';
        const emoji     = isJose ? '🥦' : '🥩';
        const area      = isJose ? 'Verduras y Granos' : 'Carnicería';
        const color     = isJose ? '#0369A1' : '#7E22CE';
        const ventasHoy = isJose ? (s.today.verduras_granos || 0) : (s.today.carniceria || 0);
        const ingHoy    = isJose ? (si.today.verduras_granos || 0) : (si.today.carniceria || 0);
        const base      = isJose ? (b.verduras_granos || 0) : (b.carniceria || 0);
        const neta      = Math.max(0, ventasHoy - base);
        const dif       = neta - ingHoy;
        const difOk     = dif >= 0;
        return '<div class="persona-card ' + cls + '">' +
          '<div class="persona-card-header">' +
            '<div class="avatar">' + avatar + '</div>' +
            '<div class="info"><h3>' + nombre + '</h3><p>' + emoji + ' ' + area + '</p></div>' +
          '</div>' +
          '<div class="persona-card-body">' +
            '<div class="pc-row"><span class="lbl">🛒 Ventas brutas hoy</span><span class="val">' + this._fmt(ventasHoy) + '</span></div>' +
            '<div class="pc-row" style="opacity:' + (base > 0 ? 1 : .45) + '">' +
              '<span class="lbl">📦 Base de caja (−)</span>' +
              '<span class="val" style="color:var(--red)">−' + this._fmt(base) + '</span>' +
            '</div>' +
            '<div class="pc-divider"></div>' +
            '<div class="pc-neta"><span class="lbl">Ventas netas</span><span class="val" style="color:' + color + '">' + this._fmt(neta) + '</span></div>' +
            '<div class="pc-row" style="margin-top:6px"><span class="lbl">📥 Ingresos recibidos</span><span class="val">' + this._fmt(ingHoy) + '</span></div>' +
            '<div class="pc-row"><span class="lbl">⚖️ ' + (difOk ? 'Sobrante' : 'Faltante') + '</span>' +
              '<span class="val" style="color:' + (difOk ? 'var(--green)' : 'var(--red)') + '">' + (difOk ? '+' : '−') + this._fmt(Math.abs(dif)) + '</span>' +
            '</div>' +
          '</div></div>';
      };

      grid.innerHTML = makeCard(true) + makeCard(false);

      const baseTotal = (b.verduras_granos || 0) + (b.carniceria || 0) + (b.general || 0);
      const netaTotal = Math.max(0, (s.today.total || 0) - baseTotal);
      const difTotal  = netaTotal - (si.today.total || 0);
      const difOk     = difTotal >= 0;

      const deptMini = (verd, carn) =>
        '<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">' +
          '<div style="display:flex;justify-content:space-between;font-size:12px">' +
            '<span style="color:var(--text-muted)">🥦 Verduras</span>' +
            '<span style="font-weight:700;color:#065F46">' + this._fmt(verd) + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:12px">' +
            '<span style="color:var(--text-muted)">🥩 Carnicería</span>' +
            '<span style="font-weight:700;color:#9A3412">' + this._fmt(carn) + '</span>' +
          '</div></div>';

      res.innerHTML =
        '<div class="stat-card" style="border-color:var(--gold)">' +
          '<div class="stat-label">📅 Esta semana</div>' +
          '<div class="stat-value gold">' + this._fmt(s.week.total) + '</div>' +
          '<div class="stat-sub">' + s.week.count + ' ventas (dom–sáb)</div>' +
          deptMini(s.week.verduras_granos, s.week.carniceria) +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-label">📊 Este mes</div>' +
          '<div class="stat-value">' + this._fmt(s.month.total) + '</div>' +
          '<div class="stat-sub">' + s.month.count + ' ventas en el mes</div>' +
          deptMini(s.month.verduras_granos, s.month.carniceria) +
        '</div>' +
        '<div class="stat-card" style="border-color:' + (difOk ? '#34D399' : '#FCA5A5') + '">' +
          '<div class="stat-label">⚖️ Diferencia neta hoy</div>' +
          '<div class="stat-value" style="color:' + (difOk ? 'var(--green)' : 'var(--red)') + '">' +
            (difOk ? '+' : '−') + this._fmt(Math.abs(difTotal)) +
          '</div>' +
          '<div class="stat-sub" style="color:' + (difOk ? 'var(--green)' : '#B91C1C') + '">' +
            (difOk ? '✅ Hay sobrante' : '⚠️ Faltante en caja') +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding:6px 8px;background:var(--card);border-radius:6px;line-height:1.8">' +
            'Ventas ' + this._fmt(s.today.total) + ' − Base ' + this._fmt(baseTotal) + ' − Ingresos ' + this._fmt(si.today.total) +
          '</div>' +
        '</div>';

      // Render Nequi + 3 cuentas del día
      this._lastToday    = s.today;
      this._lastIngresos = si.today;
      this._lastBase     = b;
      this._renderCuentasDia(s.today, si.today, b);

      this._renderBaseBanner();

    } catch (e) {
      grid.innerHTML = '<p style="color:var(--red);grid-column:1/-1">Error: ' + e.message + '</p>';
      res.innerHTML  = '';
    }
  }

  async loadSales(from, to) {
    if (from === undefined) from = document.getElementById('filter-from').value;
    if (to   === undefined) to   = document.getElementById('filter-to').value;

    ['sales-tbody-verduras', 'sales-tbody-carniceria'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="4"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    });

    try {
      const sales = await api.getSales(from || null, to || null);
      this._renderTable('sales-tbody-verduras',   this._filterDept(sales, false));
      this._renderTable('sales-tbody-carniceria', this._filterDept(sales, true));
    } catch (e) {
      showToast('Error cargando ventas: ' + e.message, 'error');
    }
  }

  _filterDept(sales, isCarn) {
    return sales.map(sale => {
      const items = (sale.sale_items || []).filter(i =>
        isCarn ? i.department === 'carniceria' : i.department !== 'carniceria'
      );
      if (!items.length) return null;
      return { ...sale, sale_items: items, total: items.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0) };
    }).filter(Boolean);
  }

  _renderTable(tbodyId, sales) {
    const tbody  = document.getElementById(tbodyId);
    const isCarn = tbodyId.includes('carniceria');
    const color  = isCarn ? 'var(--meat)' : 'var(--green)';
    const colorBg= isCarn ? 'var(--meat-bg)' : 'var(--green-bg)';

    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:28px">' +
        '<div class="icon" style="font-size:28px">' + (isCarn ? '🥩' : '🥦') + '</div>' +
        '<p>Sin ventas en este período</p></div></td></tr>';
      return;
    }

    const groups = {};
    sales.forEach(s => {
      const localDt = new Date(new Date(s.created_at).getTime() - 5 * 3600 * 1000);
      const key = localDt.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    let html = '';
    for (const fecha of Object.keys(groups).sort().reverse()) {
      const daySales = groups[fecha];
      const dayTotal = daySales.reduce((a, s) => a + parseFloat(s.total || 0), 0);
      const dateLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      html += '<tr style="background:' + colorBg + ';border-top:2px solid ' + color + '30">' +
        '<td colspan="3" style="padding:8px 14px;font-size:12px;font-weight:700;text-transform:uppercase;color:' + color + '">' +
          (isCarn ? '🥩' : '🥦') + ' ' + dateLabel +
        '</td>' +
        '<td style="padding:8px 14px;font-weight:900;font-size:16px;text-align:right;color:' + color + '">' +
          this._fmt(dayTotal) +
        '</td></tr>';

      daySales.forEach(sale => {
        const items   = sale.sale_items || [];
        const preview = items.slice(0, 2).map(i => i.product_name).join(', ') +
          (items.length > 2 ? ' +' + (items.length - 2) + ' más' : '');
        const localDt = new Date(new Date(sale.created_at).getTime() - 5 * 3600 * 1000);
        const timeStr = localDt.toISOString().slice(11, 16);
        const detail  = items.map(i =>
          '<div class="detail-item">' +
            '<span>' + i.product_name + ' <span style="color:var(--text-muted)">× ' + i.quantity + '</span></span>' +
            '<span>' + this._fmt(i.subtotal) + '</span>' +
          '</div>').join('');
        const uid = tbodyId + '_' + sale.id;

        html += '<tr class="sale-row" onclick="contabilidadPage.toggleDetail(\'' + uid + '\')">' +
          '<td style="font-weight:600;font-size:15px">' + timeStr + '</td>' +
          '<td style="color:var(--text-muted);font-size:13px">' + (preview || '—') + '</td>' +
          '<td><span class="price-text ' + (isCarn ? 'meat' : '') + '">' + this._fmt(sale.total) + '</span></td>' +
          '<td style="color:var(--text-muted);text-align:right">▾</td>' +
        '</tr>' +
        '<tr id="detail-' + uid + '" style="display:none">' +
          '<td colspan="4">' +
            '<div class="sale-detail" style="border-left:3px solid ' + color + '">' +
              (sale.notes ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">📝 ' + sale.notes + '</div>' : '') +
              '<div class="detail-items">' + detail + '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
      });
    }
    tbody.innerHTML = html;
  }

  toggleDetail(uid) {
    const r = document.getElementById('detail-' + uid);
    if (r) r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.contabilidadPage = new ContabilidadPage();
});
