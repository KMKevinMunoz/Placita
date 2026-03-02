// public/js/venta.js — Página de Registrar Venta (POS)

class VentaPage {
  constructor() {
    if (!api.requireAuth()) return;
    this.allProducts    = [];
    this.cart           = [];
    this.currentDept    = 'verduras_granos';
    this.scaleConnected = false;
    this.lastWeight     = null;
    this._weightDigits  = '';
    this._initUI();
    this._bindEvents();
    this._connectScaleWs();
    this.loadProducts();
  }

  _initUI() {
    const user = api.getUser();
    if (user) {
      document.getElementById('user-name').textContent   = user.username;
      document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }
  }

  _bindEvents() {
    document.getElementById('search-input').addEventListener('input', () => this.filterProducts());
    document.getElementById('weight-input').addEventListener('keydown', (e) => this._handleWeightKey(e));
  }

  _handleWeightKey(e) {
    if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      this._weightDigits = this._weightDigits.slice(0, -1);
      this._displayWeight();
      this._calcWeight();
      return;
    }
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }
    e.preventDefault();
    if (this._weightDigits.length >= 6) return;
    if (this._weightDigits === '' && e.key === '0') return;
    this._weightDigits += e.key;
    this._displayWeight();
    this._calcWeight();
  }

  _displayWeight() {
    const input = document.getElementById('weight-input');
    if (!this._weightDigits) { input.value = ''; return; }
    const padded  = this._weightDigits.padStart(4, '0');
    const intPart = padded.slice(0, -3);
    const decPart = padded.slice(-3);
    input.value = `${intPart || '0'},${decPart}`;
  }

  _parseWeight() {
    if (!this._weightDigits) return NaN;
    const padded  = this._weightDigits.padStart(4, '0');
    const intPart = padded.slice(0, -3);
    const decPart = padded.slice(-3);
    return parseFloat(`${intPart || '0'}.${decPart}`);
  }

  _setWeightFromScale(value) {
    const str = value.toFixed(3).replace('.', '');
    this._weightDigits = str.replace(/^0+/, '') || '0';
    this._displayWeight();
  }

  // Convierte kg a libras colombianas — 1 libra = 500g = 0.5 kg → lb = kg * 2
  // Redondea a cuartos: 1, 1.25, 1.5, 1.75, 2...
  _kgToLbStr(kg) {
    const lb      = kg * 2;                      // 0.5 kg = 1 lb colombiana
    const rounded = Math.round(lb * 4) / 4;      // redondear al cuarto más cercano
    if (rounded % 1 === 0)    return rounded.toFixed(0) + ' lb';
    if (rounded % 0.5 === 0)  return rounded.toFixed(1) + ' lb';
    return rounded.toFixed(2) + ' lb';
  }

  _connectScaleWs() {
    try {
      const wsUrl = `ws://${location.host}/ws/scale`;
      this._ws = new WebSocket(wsUrl);
      this._ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status') { this.scaleConnected = msg.connected; this._updateScaleIndicator(); }
        if (msg.type === 'weight') {
          this.lastWeight = msg.value;
          if (document.getElementById('weight-modal').classList.contains('open')) {
            this._setWeightFromScale(msg.value);
            this._calcWeight();
            document.getElementById('wm-auto-badge').style.display = 'inline-flex';
          }
        }
      };
      this._ws.onclose = () => { this.scaleConnected = false; this._updateScaleIndicator(); setTimeout(() => this._connectScaleWs(), 3000); };
      this._ws.onerror = () => {};
    } catch(e) {}
  }

  _updateScaleIndicator() {
    const el = document.getElementById('scale-indicator');
    if (!el) return;
    el.textContent = this.scaleConnected ? '⚖️ Pesa conectada' : '⚖️ Sin pesa';
    el.className   = 'scale-indicator ' + (this.scaleConnected ? 'on' : 'off');
  }

  switchDept(dept) {
    this.currentDept = dept;
    document.querySelectorAll('.dept-tab').forEach(t => {
      t.className = 'dept-tab';
      if (t.dataset.dept === dept)
        t.classList.add(dept === 'verduras_granos' ? 'active-verduras' : 'active-carniceria');
    });
    const posProducts = document.getElementById('pos-products-area');
    posProducts.className = dept === 'carniceria' ? 'pos-products meat-theme' : 'pos-products';
    document.getElementById('search-input').value = '';
    this.filterProducts();
  }

  async loadProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>';
    try {
      this.allProducts = await api.getProducts(true);
      this.filterProducts();
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`;
    }
  }

  filterProducts() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = this.allProducts.filter(p =>
      p.department === this.currentDept &&
      (p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
    );
    this.renderProducts(filtered);
  }

  renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!products.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="icon">📦</div><h3>Sin productos</h3>
        <p>Agrega productos en la sección Productos</p></div>`;
      return;
    }
    grid.innerHTML = products.map(p => {
      const inCart   = this.cart.find(c => c.productId === p.id);
      const isMeat   = p.department === 'carniceria';
      const byWeight = ['kg','lb','g'].includes(p.unit);
      return `
        <div class="product-card ${inCart ? 'in-cart' : ''} ${isMeat ? 'meat-card' : ''}"
             id="pcard-${p.id}" onclick="ventaPage.handleProductClick('${p.id}')">
          ${byWeight ? '<span class="weight-icon">⚖️</span>' : ''}
          <span class="qty-badge" id="badge-${p.id}" ${!inCart ? 'style="display:none"' : ''}>
            ${inCart ? inCart.quantity + ' ' + p.unit : ''}
          </span>
          <div class="p-emoji">
            ${p.image_url
              ? `<img src="${p.image_url}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;display:block;margin:0 auto" onerror="this.style.display='none';this.nextSibling.style.display='block'"><span style="display:none;font-size:52px;line-height:1">${p.emoji||'📦'}</span>`
              : `<span style="font-size:52px;line-height:1">${p.emoji||'📦'}</span>`
            }
          </div>
          <div class="p-name">${p.name}</div>
          ${p.category ? `<div class="p-unit">${p.category}</div>` : ''}
          <div class="p-unit">por ${p.unit}</div>
          <div class="p-price ${isMeat ? 'meat' : ''}">${this._fmt(p.price)}</div>
        </div>`;
    }).join('');
  }

  handleProductClick(productId) {
    const product = this.allProducts.find(p => p.id === productId);
    if (!product) return;
    if (['kg','lb','g'].includes(product.unit)) this.openWeightModal(product);
    else this.addToCart(productId, 1);
  }

  openWeightModal(product) {
    this._weightProduct = product;
    this._weightDigits  = '';
    const isMeat = product.department === 'carniceria';
    document.getElementById('wm-product-name').textContent  = product.name;
    const wmEmoji = document.getElementById('wm-product-emoji');
    if (product.image_url) {
      wmEmoji.innerHTML = '<img src="' + product.image_url + '" style="width:56px;height:56px;object-fit:cover;border-radius:10px" onerror="this.style.display=\'none\'">';
    } else {
      wmEmoji.textContent = product.emoji || '⚖️';
    }
    document.getElementById('wm-unit-label').textContent    = product.unit;
    document.getElementById('wm-price-label').textContent   = `${this._fmt(product.price)} / ${product.unit}`;
    document.getElementById('wm-btn-add').disabled          = true;
    document.getElementById('wm-result-box').style.display  = 'none';
    document.getElementById('wm-header').className          = isMeat ? 'wm-header meat' : 'wm-header verduras';
    document.getElementById('wm-auto-badge').style.display  = 'none';
    document.getElementById('weight-input').value           = '';
    if (this.scaleConnected && this.lastWeight !== null) {
      this._setWeightFromScale(this.lastWeight);
      this._calcWeight();
      document.getElementById('wm-auto-badge').style.display = 'inline-flex';
    }
    document.getElementById('weight-modal').classList.add('open');
    if (!this.scaleConnected) setTimeout(() => document.getElementById('weight-input').focus(), 100);
  }

  closeWeightModal() {
    document.getElementById('weight-modal').classList.remove('open');
    this._weightProduct = null;
    this._weightDigits  = '';
  }

  _calcWeight() {
    const weight  = this._parseWeight();
    const product = this._weightProduct;
    if (!product || isNaN(weight) || weight <= 0) {
      document.getElementById('wm-result-box').style.display = 'none';
      document.getElementById('wm-btn-add').disabled = true;
      return;
    }
    const isMeat = product.department === 'carniceria';
    const total  = weight * product.price;
    const lbStr = product.unit === 'kg' ? ` (${this._kgToLbStr(weight)})` : '';
    document.getElementById('wm-weight-display').textContent = `${weight.toFixed(3)} ${product.unit}${lbStr}`;
    document.getElementById('wm-price-display').textContent  = `${this._fmt(product.price)} / ${product.unit}`;
    document.getElementById('wm-total-display').textContent  = this._fmt(total);
    document.getElementById('wm-total-display').className    = 'wm-total-amount' + (isMeat ? ' meat' : '');
    document.getElementById('wm-result-box').style.display   = 'flex';
    document.getElementById('wm-btn-add').disabled           = false;
  }

  confirmWeight() {
    const weight  = this._parseWeight();
    const product = this._weightProduct;
    if (!product || isNaN(weight) || weight <= 0) return;
    this.addToCart(product.id, weight);
    this.closeWeightModal();
  }

  addToCart(productId, quantity) {
    const product = this.allProducts.find(p => p.id === productId);
    if (!product) return;
    const existing = this.cart.find(c => c.productId === productId);
    // If custom total given, calculate effective unit price
    const effectivePrice = product.price;
    if (existing) {
      existing.quantity = parseFloat((existing.quantity + quantity).toFixed(3));
    } else {
      this.cart.push({ productId: product.id, name: product.name, unit: product.unit,
        price: product.price, quantity: parseFloat(quantity.toFixed(3)),
        department: product.department, emoji: product.emoji || '📦' });
    }
    this._updateCartUI();
    showToast(`🛒 ${product.name} agregado`);
  }

  removeFromCart(productId) { this.cart = this.cart.filter(c => c.productId !== productId); this._updateCartUI(); }

  // Editar precio de un ítem en carrito
  startPriceEdit(productId) {
    const item = this.cart.find(c => c.productId === productId);
    if (!item) return;
    const el = document.getElementById('price-edit-' + productId);
    if (!el) return;
    // Usamos type="text" para que el punto sea separador de miles (ej: 1.800 = 1800)
    el.innerHTML = `<div style="display:flex;gap:4px;align-items:center;margin-top:4px">
      <input type="text" inputmode="numeric" id="pi-cart-${productId}" value="${item.price}" min="0"
        placeholder="Ej: 1.800 o 2000"
        style="width:100px;padding:5px 7px;font-size:15px;font-weight:700;letter-spacing:1px"
        onkeydown="if(event.key==='Enter')ventaPage.savePriceEdit('${productId}')" />
      <button class="btn btn-primary btn-sm" onclick="ventaPage.savePriceEdit('${productId}')">✓</button>
      <button class="btn btn-secondary btn-sm" onclick="ventaPage._updateCartUI()">✕</button>
    </div>`;
    setTimeout(() => {
      const inp = document.getElementById('pi-cart-' + productId);
      if (inp) { inp.select(); }
    }, 50);
  }

  savePriceEdit(productId) {
    const item = this.cart.find(c => c.productId === productId);
    const input = document.getElementById('pi-cart-' + productId);
    if (!item || !input) return;
    // Quitar puntos de miles (1.800 → 1800) y comas decimales (1,5 → 1.5)
    const raw = input.value.replace(/\./g, '').replace(',', '.');
    const p = parseFloat(raw);
    if (isNaN(p) || p < 0) return showToast('Precio inválido', 'error');
    item.price = p;
    this._updateCartUI();
    showToast('💰 Precio actualizado: ' + this._fmt(p));
  }

  updateQty(productId, value) {
    const qty  = parseFloat(value);
    const item = this.cart.find(c => c.productId === productId);
    if (!item) return;
    if (isNaN(qty) || qty <= 0) { this.removeFromCart(productId); return; }
    item.quantity = qty;
    this._updateTotal();
    this._updateBadges();
  }

  clearCart() { this.cart = []; this._updateCartUI(); }

  _getDeptSubtotals() {
    const verduras   = this.cart.filter(i => i.department !== 'carniceria').reduce((s, i) => s + i.price * i.quantity, 0);
    const carniceria = this.cart.filter(i => i.department === 'carniceria').reduce((s, i) => s + i.price * i.quantity, 0);
    return { verduras, carniceria };
  }

  _updateCartUI() {
    const container = document.getElementById('cart-items');
    document.getElementById('cart-count').textContent = this.cart.length;
    if (!this.cart.length) {
      container.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div><p>Toca un producto para agregar</p></div>`;
      document.getElementById('btn-complete-sale').disabled = true;
      this._renderSubtotals(0, 0, 0);
      this._updateBadges();
      return;
    }
    container.innerHTML = this.cart.map(item => {
      const isMeat   = item.department === 'carniceria';
      const byWeight = ['kg','lb','g'].includes(item.unit);
      const lbDisplay = item.unit === 'kg' ? ` (${this._kgToLbStr(item.quantity)})` : '';
      return `
        <div class="cart-item ${isMeat ? 'cart-item-meat' : ''}">
          <div class="cart-item-top">
            <span class="cart-item-name">${item.emoji || ''} ${item.name}</span>
            <button class="cart-remove" onclick="ventaPage.removeFromCart('${item.productId}')">✕</button>
          </div>
          <div class="cart-item-row" style="align-items:flex-end;gap:10px">
            <div style="flex:1">
              <label>${byWeight ? 'Peso' : 'Cantidad'} (${item.unit})</label>
              <input type="number" class="qty-input" value="${item.quantity}"
                min="0.001" step="${byWeight ? '0.001' : '1'}"
                onchange="ventaPage.updateQty('${item.productId}', this.value)" />
            </div>
            <div style="flex:1">
              <label style="font-size:10px;color:var(--text-muted)">Precio unitario</label>
              <div id="price-edit-${item.productId}">
                <button onclick="ventaPage.startPriceEdit('${item.productId}')"
                  style="width:100%;background:${isMeat ? 'var(--meat-bg)' : 'var(--green-bg)'};border:1.5px dashed ${isMeat ? 'var(--meat)' : 'var(--green)'};border-radius:var(--radius-sm);padding:6px 10px;cursor:pointer;text-align:right;font-family:var(--serif);font-size:16px;font-weight:700;color:${isMeat ? 'var(--meat)' : 'var(--green-dim)'}">
                  ${this._fmt(item.price)}
                </button>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding-top:5px;border-top:1px solid var(--border)">
            <span style="font-size:11px;color:var(--text-muted)">${item.quantity} ${item.unit}<span style="color:var(--green-dim);font-weight:700">${lbDisplay}</span> × ${this._fmt(item.price)}</span>
            <span class="cart-subtotal ${isMeat ? 'meat' : ''}">${this._fmt(item.price * item.quantity)}</span>
          </div>
        </div>`;
    }).join('');
    document.getElementById('btn-complete-sale').disabled = false;
    this._updateTotal();
    this._updateBadges();
  }

  _updateTotal() {
    const { verduras, carniceria } = this._getDeptSubtotals();
    this._renderSubtotals(verduras, carniceria, verduras + carniceria);
  }

  _renderSubtotals(verduras, carniceria, total) {
    const showV = verduras > 0;
    const showC = carniceria > 0;
    const subtotalEl = document.getElementById('cart-subtotals');
    if (!showV && !showC) { subtotalEl.innerHTML = ''; }
    else {
      subtotalEl.innerHTML = `
        ${showV ? `<div class="subtotal-row verduras"><span>🥦 Verduras y Granos</span><span>${this._fmt(verduras)}</span></div>` : ''}
        ${showC ? `<div class="subtotal-row carniceria"><span>🥩 Carnicería</span><span>${this._fmt(carniceria)}</span></div>` : ''}
        <div class="subtotal-divider"></div>`;
    }
    document.getElementById('cart-total').textContent = this._fmt(total);
  }

  _updateBadges() {
    document.querySelectorAll('.product-card').forEach(c => {
      c.classList.remove('in-cart');
      const b = c.querySelector('.qty-badge');
      if (b) b.style.display = 'none';
    });
    this.cart.forEach(item => {
      const card  = document.getElementById('pcard-' + item.productId);
      const badge = document.getElementById('badge-' + item.productId);
      if (card)  card.classList.add('in-cart');
      if (badge) { badge.style.display = 'block'; badge.textContent = item.quantity + ' ' + item.unit; }
    });
  }

  completeSale() {
    if (!this.cart.length) return;
    const total = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    this._saleTotal = parseFloat(total.toFixed(2));
    document.getElementById('pay-total-display').textContent = this._fmt(this._saleTotal);
    document.getElementById('pay-billete').value = '';
    document.getElementById('pay-vuelto').textContent = '—';
    document.getElementById('pay-vuelto').style.color = '';
    document.getElementById('pay-vuelto-row').style.opacity = '0.4';
    document.getElementById('pay-modal-error').classList.remove('show');
    document.getElementById('pay-receipt-wrap').style.display = 'none';
    document.getElementById('pay-billete-section').style.display = 'block';
    document.getElementById('btn-confirmar-pago').disabled = false;
    document.getElementById('btn-confirmar-pago').textContent = '✓ Confirmar venta';
    this._buildTicketPreview();
    document.getElementById('pay-modal').classList.add('open');
    setTimeout(() => document.getElementById('pay-billete').focus(), 120);
  }

  _buildTicketPreview() {
    const now       = new Date(Date.now() - 5*3600*1000);
    const fecha     = now.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
    const hora      = now.toISOString().slice(11,16);
    const verdItems = this.cart.filter(i => i.department !== 'carniceria');
    const carnItems = this.cart.filter(i => i.department === 'carniceria');

    const lineItem = i => {
      const byWeight = ['kg','lb','g'].includes(i.unit);
      const qStr     = byWeight ? this._kgToLbStr(i.quantity) : `× ${i.quantity} ${i.unit}`;
      return `<div class="ticket-line">
        <span class="tl-name">${i.name}</span>
        <span class="tl-qty">${qStr}</span>
        <span class="tl-sub">${this._fmt(i.price * i.quantity)}</span>
      </div>`;
    };

    const verdSec = verdItems.length ? `<div class="ticket-dept-label verd">🥦 Verduras y Granos</div>${verdItems.map(lineItem).join('')}` : '';
    const carnSec = carnItems.length ? `<div class="ticket-dept-label carn">🥩 Carnicería</div>${carnItems.map(lineItem).join('')}` : '';
    document.getElementById('ticket-fecha').textContent     = `${fecha} · ${hora}`;
    document.getElementById('ticket-items').innerHTML       = verdSec + carnSec;
    document.getElementById('ticket-total-val').textContent = this._fmt(this._saleTotal);
    document.getElementById('ticket-billete-row').style.display = 'none';
    document.getElementById('ticket-vuelto-row').style.display  = 'none';
  }

  calcVuelto() {
    const raw    = document.getElementById('pay-billete').value;
    const digits = raw.replace(/\D/g, '');
    document.getElementById('pay-billete').value = digits ? parseInt(digits, 10).toLocaleString('es-CO') : '';
    const billete  = parseInt(digits || '0', 10);
    const vueltoEl = document.getElementById('pay-vuelto');
    const rowEl    = document.getElementById('pay-vuelto-row');
    if (!billete) { vueltoEl.textContent = '—'; rowEl.style.opacity = '0.4'; return; }
    const vuelto = billete - this._saleTotal;
    if (vuelto < 0) {
      vueltoEl.textContent = `⚠️ Faltan ${this._fmt(Math.abs(vuelto))}`;
      vueltoEl.style.color = 'var(--red)';
    } else {
      vueltoEl.textContent = this._fmt(vuelto);
      vueltoEl.style.color = 'var(--green)';
    }
    rowEl.style.opacity = '1';
  }

  async confirmarPago() {
    const raw     = (document.getElementById('pay-billete').value || '').replace(/\D/g,'');
    const billete = parseInt(raw || '0', 10);
    const errEl   = document.getElementById('pay-modal-error');
    errEl.classList.remove('show');
    if (billete > 0 && billete < this._saleTotal) {
      errEl.textContent = `El billete (${this._fmt(billete)}) no alcanza para el total (${this._fmt(this._saleTotal)}).`;
      errEl.classList.add('show'); return;
    }
    const btn = document.getElementById('btn-confirmar-pago');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const notes    = document.getElementById('cart-notes').value.trim();
      const vuelto   = billete > 0 ? billete - this._saleTotal : null;
      const extra    = billete > 0 ? `Billete: ${this._fmt(billete)} · Vuelto: ${this._fmt(vuelto)}` : '';
      const notaFinal = [notes, extra].filter(Boolean).join(' | ');
      await api.createSale(this.cart, this._saleTotal, notaFinal || null);
      if (billete > 0) {
        document.getElementById('ticket-billete-row').style.display = 'flex';
        document.getElementById('ticket-billete-val').textContent   = this._fmt(billete);
        document.getElementById('ticket-vuelto-row').style.display  = 'flex';
        document.getElementById('ticket-vuelto-val').textContent    = this._fmt(Math.max(0, vuelto));
      }
      document.getElementById('pay-receipt-wrap').style.display    = 'block';
      document.getElementById('pay-billete-section').style.display = 'none';
      btn.textContent = '✅ Venta registrada';
      showToast(`✅ Venta de ${this._fmt(this._saleTotal)} registrada`);
      this.clearCart();
      document.getElementById('cart-notes').value = '';
    } catch(e) {
      errEl.textContent = e.message; errEl.classList.add('show');
      btn.disabled = false; btn.textContent = '✓ Confirmar venta';
    }
  }

  closePayModal() {
    document.getElementById('pay-modal').classList.remove('open');
    document.getElementById('pay-billete-section').style.display = 'block';
  }

  imprimirTicket() {
    const ticketHtml = document.getElementById('pay-ticket').innerHTML;
    const pa = document.getElementById('print-area');
    pa.innerHTML = `<div style="max-width:250px;margin:0 auto;font-family:monospace">${ticketHtml}</div>`;
    pa.style.display = 'block'; window.print(); pa.style.display = 'none';
  }

  _fmt(a) {
    return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(a);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  InactivityTimer.start();
  window.ventaPage = new VentaPage();

  document.getElementById('weight-modal').addEventListener('click', function(e) {
    if (e.target === this) ventaPage.closeWeightModal();
  });
  document.getElementById('pay-modal').addEventListener('click', function(e) {
    if (e.target === this) ventaPage.closePayModal();
  });
  document.getElementById('pay-billete').addEventListener('input', () => ventaPage.calcVuelto());
  document.getElementById('pay-billete').addEventListener('keydown', e => {
    if (e.key === 'Enter') ventaPage.confirmarPago();
  });
  document.getElementById('weight-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') ventaPage.confirmWeight();
  });
});
