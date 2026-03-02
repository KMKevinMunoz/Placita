// public/js/ui.js — Utilidades de UI compartidas
// Incluir DESPUÉS de ApiClient.js y lock.js en todas las páginas

// ── Hamburger / sidebar móvil ──────────────────────────────────
function initMobileMenu() {
  const toggle   = document.getElementById('menu-toggle');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const closeBtn = document.getElementById('sidebar-close');
  if (!toggle || !sidebar) return;

  function openMenu()  { sidebar.classList.add('open');    overlay.classList.add('visible');    document.body.style.overflow = 'hidden'; }
  function closeMenu() { sidebar.classList.remove('open'); overlay.classList.remove('visible'); document.body.style.overflow = ''; }

  toggle.addEventListener('click', openMenu);
  if (overlay)  overlay.addEventListener('click', closeMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Cerrar al navegar (en móvil los links recargan igual pero por si acaso)
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', () => { if (window.innerWidth <= 768) closeMenu(); });
  });
}

// ── Date range bar ──────────────────────────────────────────────
// Uso: initDateRangeBar('drb-container-id', onChangeFn)
// onChangeFn(from, to) donde from/to son 'YYYY-MM-DD'
function initDateRangeBar(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Calcular rangos
  function getToday() {
    // Hora local Colombia (UTC-5)
    const d = new Date(Date.now() - 5 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  }
  function getWeekRange() {
    const d = new Date(Date.now() - 5 * 3600 * 1000);
    const dow = d.getUTCDay(); // 0=domingo
    const sun = new Date(d); sun.setUTCDate(d.getUTCDate() - dow); sun.setUTCHours(0,0,0,0);
    const sat = new Date(sun); sat.setUTCDate(sun.getUTCDate() + 6);
    return { from: sun.toISOString().split('T')[0], to: sat.toISOString().split('T')[0] };
  }
  function getMonthRange() {
    const today = getToday();
    const from  = today.slice(0, 7) + '-01';
    // Último día del mes
    const d = new Date(today.slice(0,4), parseInt(today.slice(5,7)), 0);
    const to = d.toISOString().split('T')[0];
    return { from, to };
  }

  const fromInput = container.querySelector('.drb-from');
  const toInput   = container.querySelector('.drb-to');
  const btns      = container.querySelectorAll('.drb[data-range]');

  function fireChange() {
    // Desactivar todos los botones activos
    btns.forEach(b => b.classList.remove('active'));
    if (onChange) onChange(fromInput.value, toInput.value);
  }

  fromInput.addEventListener('change', fireChange);
  toInput.addEventListener('change', fireChange);

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.dataset.range;
      if (range === 'today') {
        const t = getToday();
        fromInput.value = t; toInput.value = t;
      } else if (range === 'week') {
        const w = getWeekRange();
        fromInput.value = w.from; toInput.value = w.to;
      } else if (range === 'month') {
        const m = getMonthRange();
        fromInput.value = m.from; toInput.value = m.to;
      }
      if (onChange) onChange(fromInput.value, toInput.value);
    });
  });

  // Preset inicial: activar botón si coincide
  function syncActiveBtn() {
    const today = getToday();
    const week  = getWeekRange();
    const month = getMonthRange();
    btns.forEach(btn => {
      btn.classList.remove('active');
      const r = btn.dataset.range;
      if (r === 'today' && fromInput.value === today && toInput.value === today) btn.classList.add('active');
      if (r === 'week'  && fromInput.value === week.from  && toInput.value === week.to)  btn.classList.add('active');
      if (r === 'month' && fromInput.value === month.from && toInput.value === month.to) btn.classList.add('active');
    });
  }
  syncActiveBtn();

  return { getToday, getWeekRange, getMonthRange, syncActiveBtn };
}

// Iniciar menú móvil cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initMobileMenu);
