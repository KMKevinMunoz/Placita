// public/js/recibos.js — Página de Recibos / Historial de ventas

document.addEventListener('DOMContentLoaded', () => {
  if (!api.requireAuth()) return;

  // Mostrar usuario
  const user = api.getUser();
  if (user) {
    const av = document.getElementById('user-avatar');
    const nm = document.getElementById('user-name');
    if (av) av.textContent = (user.username || '?')[0].toUpperCase();
    if (nm) nm.textContent = user.username || '';
  }

  InactivityTimer.start();
  recibosPage.init();
});

const recibosPage = (() => {
  let allSales   = [];   // ventas cargadas del servidor
  let currentFrom = '';
  let currentTo   = '';

  // ── Formato ──────────────────────────────────────────────────
  function fmt(n) {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }

  function localDate(isoString) {
    // Convertir UTC a Colombia (UTC-5)
    const d = new Date(new Date(isoString).getTime() - 5 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  }

  function formatTime(isoString) {
    const d = new Date(new Date(isoString).getTime() - 5 * 3600 * 1000);
    return d.toISOString().split('T')[1].slice(0, 5);
  }

  function formatDateLabel(dateStr) {
    const [y, m, day] = dateStr.split('-');
    const d = new Date(Date.UTC(+y, +m - 1, +day));
    return d.toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ── Cargar ventas y stats ─────────────────────────────────────
  async function load() {
    const listEl = document.getElementById('recibos-list');
    listEl.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

    try {
      const [sales, stats] = await Promise.all([
        api.getSales(currentFrom || null, currentTo || null),
        api.getSaleStats()
      ]);
      allSales = sales || [];
      renderStats(stats);
      filterLocal();
    } catch (e) {
      listEl.innerHTML = `<p class="msg-error">Error cargando recibos: ${e.message}</p>`;
    }
  }

  // ── Stats mini ────────────────────────────────────────────────
  function renderStats(stats) {
    const el = document.getElementById('stat-mini');
    if (!el || !stats) return;
    el.innerHTML = `
      <div class="stat-mini-card">
        <div class="label">📅 Hoy</div>
        <div class="value green">${fmt(stats.today?.total || 0)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${stats.today?.count || 0} ventas</div>
      </div>
      <div class="stat-mini-card">
        <div class="label">📆 Esta semana</div>
        <div class="value gold">${fmt(stats.week?.total || 0)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${stats.week?.count || 0} ventas</div>
      </div>
      <div class="stat-mini-card">
        <div class="label">🗓️ Este mes</div>
        <div class="value">${fmt(stats.month?.total || 0)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${stats.month?.count || 0} ventas</div>
      </div>`;
  }

  // ── Filtro local (departamento y búsqueda de texto) ───────────
  function filterLocal() {
    const dept   = document.getElementById('filter-dept')?.value || '';
    const search = (document.getElementById('filter-search')?.value || '').toLowerCase();

    let filtered = allSales;

    if (dept || search) {
      filtered = allSales.map(sale => {
        // Filtrar items internos
        let items = sale.sale_items || [];
        if (dept)   items = items.filter(i => dept === 'carniceria' ? i.department === 'carniceria' : i.department !== 'carniceria');
        if (search) items = items.filter(i => (i.product_name || '').toLowerCase().includes(search));
        if (!items.length && (dept || search)) return null;
        return { ...sale, sale_items: items };
      }).filter(Boolean);
    }

    renderList(filtered);
  }

  // ── Renderizar lista agrupada por día ─────────────────────────
  function renderList(sales) {
    const listEl = document.getElementById('recibos-list');
    if (!sales.length) {
      listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Sin ventas en este período</p>';
      return;
    }

    // Agrupar por fecha local
    const groups = {};
    sales.forEach(s => {
      const day = localDate(s.created_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(s);
    });

    const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    listEl.innerHTML = sortedDays.map(day => {
      const daySales = groups[day];
      const dayTotal = daySales.reduce((a, s) => a + parseFloat(s.total || 0), 0);

      const cards = daySales.map((sale, i) => {
        const num   = String(i + 1).padStart(3, '0');
        const time  = formatTime(sale.created_at);
        const items = sale.sale_items || [];

        const verdItems = items.filter(it => it.department !== 'carniceria');
        const carnItems = items.filter(it => it.department === 'carniceria');

        let ticketHtml = `
          <div class="recibo-ticket">
            <div class="ticket-header">
              <h4>🌿 Frutos de Mi Campo</h4>
              <p>${formatDateLabel(day)} · ${time}</p>
            </div>
            <hr class="ticket-divider"/>`;

        if (verdItems.length) {
          ticketHtml += `<div><span class="ticket-dept verd">🥦 Verduras y Granos</span></div>`;
          verdItems.forEach(it => {
            const qty = it.quantity % 1 === 0 ? `x${it.quantity}` : `${String(parseFloat(it.quantity).toFixed(3)).replace('.',',')} kg`;
            ticketHtml += `<div class="ticket-item"><span class="name">${it.product_name}</span><span class="qty">${qty}</span><span class="sub">${fmt(it.subtotal)}</span></div>`;
          });
        }
        if (carnItems.length) {
          ticketHtml += `<div><span class="ticket-dept carn">🥩 Carnicería</span></div>`;
          carnItems.forEach(it => {
            const qty = it.quantity % 1 === 0 ? `x${it.quantity}` : `${String(parseFloat(it.quantity).toFixed(3)).replace('.',',')} kg`;
            ticketHtml += `<div class="ticket-item"><span class="name">${it.product_name}</span><span class="qty">${qty}</span><span class="sub">${fmt(it.subtotal)}</span></div>`;
          });
        }

        ticketHtml += `
            <hr class="ticket-divider"/>
            <div class="ticket-total-row"><span>TOTAL</span><span style="color:var(--green)">${fmt(sale.total)}</span></div>
            ${sale.notes ? `<p style="font-size:10px;color:var(--text-muted);margin-top:6px">📝 ${sale.notes}</p>` : ''}
            <div class="ticket-footer">¡Gracias por su compra! · La Placita</div>
          </div>
          <div class="recibo-actions">
            <button class="btn btn-secondary btn-sm" onclick="recibosPage.imprimirRecibo('${sale.id}')">🖨️ Imprimir</button>
          </div>`;

        return `
          <div class="recibo-card" id="recibo-${sale.id}">
            <div class="recibo-header" onclick="recibosPage.toggleRecibo('${sale.id}')">
              <div class="recibo-header-left">
                <span class="recibo-num">#${num}</span>
                <div>
                  <div style="font-weight:600;font-size:14px">${time}</div>
                  <div class="recibo-cajero">${sale.users?.username || ''} · ${items.length} producto${items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="recibo-total">${fmt(sale.total)}</span>
                <span class="recibo-chevron">▾</span>
              </div>
            </div>
            <div class="recibo-body">
              ${ticketHtml}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="day-group">
          <div class="day-label">
            <h4>${formatDateLabel(day)}</h4>
            <span class="day-sum">${daySales.length} venta${daySales.length !== 1 ? 's' : ''} · ${fmt(dayTotal)}</span>
          </div>
          ${cards}
        </div>`;
    }).join('');

    // Guardar referencia a ventas para imprimir
    window._reciboSalesMap = {};
    sales.forEach(s => { window._reciboSalesMap[s.id] = s; });
  }

  // ── Toggle detalle ────────────────────────────────────────────
  function toggleRecibo(id) {
    const card = document.getElementById(`recibo-${id}`);
    if (!card) return;
    card.classList.toggle('open');
  }

  // ── Imprimir recibo individual ────────────────────────────────
  function imprimirRecibo(id) {
    const sale = window._reciboSalesMap?.[id];
    if (!sale) return;
    const body = document.querySelector(`#recibo-${id} .recibo-body`);
    if (!body) return;
    document.getElementById('print-area').innerHTML = body.innerHTML;
    window.print();
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    // Inicializar date range bar — Hoy por defecto
    const drb = initDateRangeBar('recibos-drb', (from, to) => {
      currentFrom = from;
      currentTo   = to;
      load();
    });

    // Activar "Hoy" por defecto
    if (drb) {
      const today = drb.getToday();
      const fromInput = document.getElementById('filter-from');
      const toInput   = document.getElementById('filter-to');
      if (fromInput) fromInput.value = today;
      if (toInput)   toInput.value   = today;
      currentFrom = today;
      currentTo   = today;
      // Marcar botón activo
      const todayBtn = document.querySelector('.drb[data-range="today"]');
      if (todayBtn) todayBtn.classList.add('active');
    }

    load();
  }

  return { init, load, filterLocal, toggleRecibo, imprimirRecibo };
})();
