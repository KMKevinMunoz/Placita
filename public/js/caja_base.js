// public/js/caja_base.js
// ═══════════════════════════════════════════════════════════════════
//  1. FORMATO DE MILES en todos los inputs numéricos del sitio
//     → 15.000 / 1.250.000  mientras escribe
//  2. BASE DEL DÍA — splash en TODAS las páginas
//     → Solo después de las 7:00 AM Colombia (UTC-5)
//     → Una sola vez al día por localStorage
//     → Si ya está en el servidor, no molesta
// ═══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────
//  FORMATO DE MILES
// ──────────────────────────────────────────────────────────────────

/** Formatea número como string con puntos de miles: 1250000 → "1.250.000" */
window.fmtMiles = (n) => n == null ? '' : Math.round(n).toLocaleString('es-CO');

/** Lee el valor numérico de un input formateado: "1.250.000" → 1250000 */
window.parseMiles = (el) => {
  const v = typeof el === 'string' ? el : (el?.value || '');
  return parseInt(v.replace(/\D/g, '') || '0', 10);
};

/** Adjunta formato de miles a un input */
window.attachMiles = function (input) {
  if (!input || input._miles) return;
  input._miles = true;

  // Convertir type=number → text para poder insertar puntos
  if (input.type === 'number') {
    const v = input.value;
    input.type = 'text';
    input.inputMode = 'numeric';
    if (v) input.value = fmtMiles(parseInt(v));
  }

  input.addEventListener('focus', function () {
    // Mostrar solo dígitos al enfocar y seleccionar todo
    this.value = this.value.replace(/\D/g, '');
    this.select();
  });

  input.addEventListener('input', function () {
    const raw = this.value.replace(/\D/g, '');
    if (!raw) { this.value = ''; return; }
    const num = parseInt(raw, 10);
    const fmt = num.toLocaleString('es-CO');
    // Calcular cuántos dígitos había antes del cursor
    const before = this.selectionStart;
    const digitsBeforeCursor = this.value.slice(0, before).replace(/\D/g, '').length;
    this.value = fmt;
    // Restaurar cursor después de los mismos dígitos
    let pos = 0, cnt = 0;
    for (let i = 0; i < fmt.length; i++) {
      if (/\d/.test(fmt[i])) cnt++;
      if (cnt === digitsBeforeCursor) { pos = i + 1; break; }
    }
    try { this.setSelectionRange(pos || fmt.length, pos || fmt.length); } catch (_) {}
  });

  input.addEventListener('blur', function () {
    const raw = this.value.replace(/\D/g, '');
    this.value = raw ? parseInt(raw).toLocaleString('es-CO') : '';
  });
};

/** Escanea el DOM y adjunta formato a todos los inputs numéricos */
function milesAttachAll() {
  document.querySelectorAll('input[type="number"], input[inputmode="numeric"], input[data-miles]').forEach(el => {
    // Excluir: fechas, pesos/cantidades con decimales, buscadores
    const id = (el.id || '').toLowerCase();
    if (['filter-from','filter-to','weight-input'].some(s => id.includes(s))) return;
    if (el.step && parseFloat(el.step) % 1 !== 0) return; // decimales
    if (el.type === 'date' || el.type === 'time') return;
    attachMiles(el);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(milesAttachAll, 100);
  // Observer para inputs que aparezcan en modales dinámicamente
  new MutationObserver(milesAttachAll).observe(document.body, { childList: true, subtree: true });
});


// ──────────────────────────────────────────────────────────────────
//  CAJA BASE — SPLASH
// ──────────────────────────────────────────────────────────────────
window.CajaBase = {
  _TZ:    5,   // Colombia = UTC-5 (sin horario de verano)
  _HORA:  7,   // 7:00 AM = hora de apertura

  // Fecha local Colombia "YYYY-MM-DD"
  hoy() {
    return new Date(Date.now() - this._TZ * 3_600_000).toISOString().split('T')[0];
  },

  // Hora local Colombia (0-23)
  horaLocal() {
    return new Date(Date.now() - this._TZ * 3_600_000).getUTCHours();
  },

  // Keys de localStorage (se vencen solos porque incluyen la fecha)
  _keyOk()   { return 'cb_ok_'   + this.hoy(); },
  _keySk()   { return 'cb_skip_' + this.hoy(); },
  _yaHecho() { return !!(localStorage.getItem(this._keyOk()) || localStorage.getItem(this._keySk())); },

  _fmt(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO'); },

  // ── Inyectar HTML del splash en el body ────────────────────────
  _inject() {
    if (document.getElementById('_cb')) return; // ya existe

    document.head.insertAdjacentHTML('beforeend', `<style id="_cb_css">
      #_cb{display:none;position:fixed;inset:0;z-index:9900;
        background:rgba(8,18,8,.78);backdrop-filter:blur(8px);
        align-items:center;justify-content:center;padding:16px;
        font-family:var(--sans,'Plus Jakarta Sans',system-ui,sans-serif)}
      #_cb.on{display:flex}
      #_cb_card{background:var(--surface,#fff);border-radius:22px;
        padding:30px 26px;width:100%;max-width:480px;
        box-shadow:0 28px 72px rgba(0,0,0,.35);
        animation:_cbIn .35s cubic-bezier(.34,1.4,.64,1)}
      @keyframes _cbIn{from{opacity:0;transform:translateY(28px) scale(.95)}to{opacity:1;transform:none}}
      ._cb_ttl{text-align:center;margin-bottom:22px}
      ._cb_ttl .ico{font-size:50px;display:block;margin-bottom:10px}
      ._cb_ttl h2{font-family:var(--serif,'Fraunces',Georgia,serif);
        font-size:26px;font-weight:900;margin:0 0 6px;color:var(--text,#1A2E18)}
      ._cb_ttl p{font-size:13px;color:var(--text-muted,#6B8A65);margin:0;line-height:1.55}
      ._cb_grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:11px}
      ._cb_box{border-radius:13px;padding:14px;border-width:2px;border-style:solid}
      ._cb_box.v{background:#EAF5E7;border-color:#A3D9A0}
      ._cb_box.c{background:#FDF0E8;border-color:#F0C4A8}
      ._cb_box h4{margin:0 0 2px;font-size:13px;font-weight:800}
      ._cb_box.v h4{color:#3A7A30} ._cb_box.c h4{color:#C0622A}
      ._cb_box .who{font-size:11px;color:#6B8A65;margin-bottom:9px}
      ._cb_lbl{font-size:10px;font-weight:700;text-transform:uppercase;
        letter-spacing:.5px;color:#6B8A65;display:block;margin-bottom:5px}
      ._cb_inp{width:100%;padding:10px 12px;border-width:1.5px;
        border-style:solid;border-radius:8px;font-size:20px;font-weight:700;
        color:var(--text,#1A2E18);background:#fff;font-family:inherit;
        box-sizing:border-box;outline:none;transition:border-color .15s,box-shadow .15s}
      ._cb_box.v ._cb_inp{border-color:#A3D9A0}
      ._cb_box.v ._cb_inp:focus{border-color:#4A9B3F;box-shadow:0 0 0 3px rgba(74,155,63,.13)}
      ._cb_box.c ._cb_inp{border-color:#F0C4A8}
      ._cb_box.c ._cb_inp:focus{border-color:#C0622A;box-shadow:0 0 0 3px rgba(192,98,42,.13)}
      ._cb_gen{background:#F5F7F4;border:1.5px solid #D4E4CF;
        border-radius:13px;padding:14px;margin-bottom:11px}
      ._cb_gen h4{font-size:13px;font-weight:700;margin:0 0 2px;color:#1A2E18}
      ._cb_gen p{font-size:11px;color:#6B8A65;margin:0 0 9px}
      ._cb_gen ._cb_inp{border-color:#D4E4CF}
      ._cb_gen ._cb_inp:focus{border-color:#4A9B3F;box-shadow:0 0 0 3px rgba(74,155,63,.13)}
      ._cb_total{display:flex;justify-content:space-between;align-items:center;
        background:#EAF5E7;border:1.5px solid #A3D9A0;border-radius:10px;
        padding:12px 16px;margin-bottom:12px}
      ._cb_total span:first-child{font-size:13px;font-weight:600;color:#3A7A30}
      #_cb_tval{font-family:var(--serif,'Fraunces',Georgia,serif);
        font-size:26px;font-weight:900;color:#4A9B3F}
      #_cb_err{display:none;background:#FDEAEA;border:1px solid #F0C0C0;
        color:#C94040;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:11px}
      #_cb_save{width:100%;padding:16px;border:none;border-radius:12px;
        background:#4A9B3F;color:#fff;font-size:17px;font-weight:700;
        cursor:pointer;font-family:inherit;margin-bottom:8px;
        transition:background .15s,opacity .15s}
      #_cb_save:hover:not(:disabled){background:#3A7A30}
      #_cb_save:disabled{opacity:.6;cursor:not-allowed}
      #_cb_skip{width:100%;padding:9px;border:none;background:transparent;
        color:#6B8A65;font-size:13px;cursor:pointer;font-family:inherit}
      #_cb_skip:hover{color:#1A2E18;text-decoration:underline}
      @media(max-width:480px){._cb_grid{grid-template-columns:1fr}
        #_cb_card{padding:22px 16px;border-radius:18px}}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="_cb">
      <div id="_cb_card">
        <div class="_cb_ttl">
          <span class="ico">📦</span>
          <h2>Base del día</h2>
          <p>Ingresa el dinero inicial en cada caja al abrir.<br>Se usará para calcular las ventas netas del día.</p>
        </div>

        <div class="_cb_grid">
          <div class="_cb_box v">
            <h4>🥦 Verduras</h4>
            <div class="who">👨 Caja de José</div>
            <label class="_cb_lbl">Base en caja</label>
            <input id="_cb_v" class="_cb_inp" type="text" inputmode="numeric" placeholder="0"/>
          </div>
          <div class="_cb_box c">
            <h4>🥩 Carnicería</h4>
            <div class="who">👩 Caja de Claudia</div>
            <label class="_cb_lbl">Base en caja</label>
            <input id="_cb_c" class="_cb_inp" type="text" inputmode="numeric" placeholder="0"/>
          </div>
        </div>

        <div class="_cb_gen">
          <h4>💵 Base general</h4>
          <p>Dinero en caja sin especificar área</p>
          <label class="_cb_lbl">Monto</label>
          <input id="_cb_g" class="_cb_inp" type="text" inputmode="numeric" placeholder="0"/>
        </div>

        <div class="_cb_total">
          <span>💰 Total base de caja</span>
          <span id="_cb_tval">$0</span>
        </div>

        <div id="_cb_err"></div>

        <button id="_cb_save" onclick="CajaBase.guardar()">✅ Registrar base y continuar</button>
        <button id="_cb_skip" onclick="CajaBase.saltar()">Saltar por ahora (la base quedará en $0)</button>
      </div>
    </div>`);

    // Formato de miles + total en tiempo real
    ['_cb_v','_cb_c','_cb_g'].forEach(id => {
      const el = document.getElementById(id);
      attachMiles(el);
      el.addEventListener('input', () => this._updateTotal());
      el.addEventListener('blur',  () => this._updateTotal());
    });

    // Enter navega entre campos y al final guarda
    document.getElementById('_cb_v').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('_cb_c').focus(); });
    document.getElementById('_cb_c').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('_cb_g').focus(); });
    document.getElementById('_cb_g').addEventListener('keydown', e => { if (e.key==='Enter') this.guardar(); });
  },

  _updateTotal() {
    const t = parseMiles(document.getElementById('_cb_v'))
            + parseMiles(document.getElementById('_cb_c'))
            + parseMiles(document.getElementById('_cb_g'));
    const el = document.getElementById('_cb_tval');
    if (el) el.textContent = this._fmt(t);
  },

  // ── Show / hide ────────────────────────────────────────────────
  show() {
    document.getElementById('_cb')?.classList.add('on');
    setTimeout(() => document.getElementById('_cb_v')?.focus(), 300);
  },
  hide() { document.getElementById('_cb')?.classList.remove('on'); },

  // ── Guardar ────────────────────────────────────────────────────
  async guardar() {
    const btn  = document.getElementById('_cb_save');
    const err  = document.getElementById('_cb_err');
    const v = parseMiles(document.getElementById('_cb_v'));
    const c = parseMiles(document.getElementById('_cb_c'));
    const g = parseMiles(document.getElementById('_cb_g'));

    err.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await api.saveCajaBase(this.hoy(), v, c, g);
      localStorage.setItem(this._keyOk(), '1');
      this.hide();
      if (typeof showToast === 'function') showToast('✅ Base registrada: ' + this._fmt(v+c+g), 'success');
      // Recargar contabilidad si está abierta
      if (window.contabilidadPage?.reload) contabilidadPage.reload();
    } catch(e) {
      err.textContent = '⚠️ ' + e.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '✅ Registrar base y continuar';
    }
  },

  // ── Saltar ─────────────────────────────────────────────────────
  saltar() {
    localStorage.setItem(this._keySk(), '1');
    this.hide();
  },

  // ── Punto de entrada: llamar desde DOMContentLoaded ────────────
  async check() {
    if (typeof api === 'undefined' || !api.isAuthenticated()) return;

    // Solo a partir de las 7 AM Colombia
    if (this.horaLocal() < this._HORA) return;

    // ¿Ya se registró/saltó hoy localmente?
    if (this._yaHecho()) return;

    // Verificar con el servidor si ya está guardado (otro dispositivo)
    try {
      const base = await api.getCajaBase(this.hoy());
      if (base?.registrada) { localStorage.setItem(this._keyOk(), '1'); return; }
    } catch(_) {
      // Si falla (tabla no existe aún), igual mostrar splash para avisar
    }

    this._inject();
    this.show();
  },
};
