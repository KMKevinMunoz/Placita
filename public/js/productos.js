// ─── Emojis sugeridos ──────────────────────────────────────
const EMOJI_SUGGESTIONS = [
  '🥦','🥬','🧅','🧄','🥕','🌽','🍅','🍆','🫑','🌶️','🥒','🥑',
  '🍠','🥔','🧇','🌿','🌱','🫛','🫚',
  '🍎','🍊','🍋','🍌','🍇','🍓','🍒','🍑','🥭','🍍','🍈','🍐',
  '🥩','🍗','🍖','🥚','🧀','🥓','🌭','🫀',
  '🌾','🍚','🫘','🥜','🌰','🧆','🫙','📦','🛒','⚖️'
];

class ProductosPage {
  constructor() {
    if (!api.requireAuth()) return;
    this._currentEditId = null;
    this._selectedEmoji = '📦';
    this._imageData = null;   // base64 o URL de la foto
    this._activePhotoTab = 'device';
    this._initUI();
    this._buildEmojiGrid();
    this.loadProducts();
    this._setupGlobalPaste();
  }

  _initUI() {
    const user = api.getUser();
    if (user) {
      document.getElementById('user-name').textContent   = user.username;
      document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }
  }

  _buildEmojiGrid() {
    const grid = document.getElementById('emoji-grid');
    grid.innerHTML = EMOJI_SUGGESTIONS.map(e =>
      `<div class="emoji-opt" onclick="productosPage.selectEmoji('${e}', this)">${e}</div>`
    ).join('');
  }

  selectEmoji(emoji, el) {
    this._selectedEmoji = emoji;
    document.getElementById('modal-emoji').value = emoji;
    document.getElementById('emoji-preview-big').textContent = emoji;
    document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
    if (el) el.classList.add('selected');
  }

  onEmojiInput(value) {
    const emoji = value.trim() || '📦';
    this._selectedEmoji = emoji;
    document.getElementById('emoji-preview-big').textContent = emoji;
    document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  }

  // ─── Foto: pestañas ────────────────────────────────────
  switchPhotoTab(tab, btn) {
    this._activePhotoTab = tab;
    document.querySelectorAll('.photo-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.photo-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
    if (tab === 'paste') setTimeout(() => this.focusPasteZone(), 100);
  }

  focusPasteZone() {
    document.getElementById('paste-zone').focus();
  }

  // ─── Drag & drop sobre la zona de subida ───────────────
  onDragOver(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); }
  onDragLeave(e) { document.getElementById('drop-zone').classList.remove('drag-over'); }
  onDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) this._readFile(file);
  }

  // ─── Input de archivo ──────────────────────────────────
  onFileSelected(e) {
    const file = e.target.files[0];
    if (file) this._readFile(file);
  }

  _readFile(file) {
    // Comprimir si es muy grande
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      // Comprimir con canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        this._setPhoto(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ─── Pegar desde portapapeles ──────────────────────────
  onPaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        this._readFile(item.getAsFile());
        return;
      }
    }
    // Si no hay imagen, intentar leer texto como URL
    const text = e.clipboardData.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault();
      this._loadUrl(text.trim());
    }
  }

  // ─── Escuchar paste global cuando el modal está abierto ─
  _setupGlobalPaste() {
    document.addEventListener('paste', (e) => {
      if (!document.getElementById('product-modal').classList.contains('open')) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT' &&
          document.activeElement.type !== 'url') return; // no interceptar texto
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          this._readFile(item.getAsFile());
          showToast('📷 Imagen pegada desde portapapeles');
          return;
        }
      }
    });
  }

  // ─── URL ───────────────────────────────────────────────
  onUrlInput(val) { /* live no forzamos, esperamos "Cargar" */ }

  loadImageFromUrl() {
    const url = document.getElementById('modal-image-url').value.trim();
    if (!url) return showToast('Escribe una URL primero', 'error');
    this._loadUrl(url);
  }

  _loadUrl(url) {
    // Mostrar la URL directamente como src (CORS puede bloquear en base64)
    // Para URLs externas guardamos la URL tal cual
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Intentar convertir a base64 (funciona si el servidor permite CORS)
      try {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width || 400, h = img.height || 400;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        this._setPhoto(canvas.toDataURL('image/jpeg', 0.82));
        showToast('✅ Imagen cargada');
      } catch {
        // Si CORS bloquea, usar URL directa
        this._setPhoto(url);
        showToast('✅ Imagen cargada (URL directa)');
      }
    };
    img.onerror = () => {
      // Intentar con URL directa de todos modos
      this._setPhoto(url);
      showToast('⚠️ Imagen cargada — si no se ve, la URL puede tener restricciones');
    };
    img.src = url;
  }

  _setPhoto(dataOrUrl) {
    this._imageData = dataOrUrl;
    const wrap = document.getElementById('photo-preview-wrap');
    const previewImg = document.getElementById('photo-preview-img');
    previewImg.src = dataOrUrl;
    wrap.classList.add('has-photo');
  }

  removePhoto() {
    this._imageData = null;
    const wrap = document.getElementById('photo-preview-wrap');
    const previewImg = document.getElementById('photo-preview-img');
    previewImg.src = '';
    wrap.classList.remove('has-photo');
    document.getElementById('file-input').value = '';
    document.getElementById('modal-image-url').value = '';
  }

  // ─── Cargar tabla ──────────────────────────────────────
  async loadProducts() {
    ['tbody-verduras','tbody-carniceria'].forEach(id => {
      document.getElementById(id).innerHTML =
        `<tr><td colspan="7"><div class="loading-center"><div class="spinner"></div></div></td></tr>`;
    });
    try {
      const products = await api.getProducts();
      this.renderTable(products);
    } catch (e) {
      document.getElementById('tbody-verduras').innerHTML =
        `<tr><td colspan="7" style="color:var(--red);padding:20px">${e.message}</td></tr>`;
    }
  }

  renderTable(products) {
    this._renderGroup('tbody-verduras',   products.filter(p => p.department === 'verduras_granos'));
    this._renderGroup('tbody-carniceria', products.filter(p => p.department === 'carniceria'));
  }

  _thumbHTML(p) {
    if (p.image_url) {
      return `<img class="product-thumb" src="${p.image_url}" alt="${p.name}"
               onerror="this.style.display='none';this.nextSibling.style.display='block'">
              <span class="product-thumb-emoji" style="display:none">${p.emoji || '📦'}</span>`;
    }
    return `<span class="product-thumb-emoji">${p.emoji || '📦'}</span>`;
  }

  _renderGroup(tbodyId, products) {
    const tbody = document.getElementById(tbodyId);
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state" style="padding:30px">
          <div class="icon" style="font-size:32px">📦</div>
          <p>Sin productos. Crea uno con el botón de arriba.</p>
        </div></td></tr>`;
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr id="tr-${p.id}" draggable="true"
          ondragstart="productosPage.dragStart(event,'${p.id}')"
          ondragover="productosPage.dragOver(event)"
          ondrop="productosPage.drop(event,'${p.id}')">
        <td><span class="drag-handle" title="Arrastra para ordenar">⠿</span></td>
        <td style="text-align:center;padding:8px 12px">${this._thumbHTML(p)}</td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-muted">${p.category || '—'}</span></td>
        <td>${p.unit}${p.sold_by_weight ? ' <span title="Vende por peso">⚖️</span>' : ''}</td>
        <td id="price-cell-${p.id}">
          <span class="price-text ${p.department === 'carniceria' ? 'meat' : ''}"
                style="cursor:pointer" title="Clic para editar precio"
                onclick="productosPage.startPriceEdit('${p.id}',${p.price})">
            ${this._fmt(p.price)} <small style="font-size:9px;opacity:.4">✏️</small>
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="badge ${p.active ? 'badge-green' : 'badge-muted'}">${p.active ? 'Activo' : 'Inactivo'}</span>
            <button class="btn btn-secondary btn-sm" onclick="productosPage.openModal('${p.id}')">Editar</button>
            <button class="btn btn-danger btn-sm"    onclick="productosPage.deleteProduct('${p.id}','${p.name.replace(/'/g,"\\'") }')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  // ─── Drag & drop tabla ─────────────────────────────────
  dragStart(e, id) {
    e.dataTransfer.setData('text/plain', id);
    document.getElementById('tr-' + id).classList.add('dragging');
  }
  dragOver(e) { e.preventDefault(); }
  async drop(e, targetId) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    document.querySelectorAll('tr').forEach(r => r.classList.remove('dragging'));
    if (draggedId === targetId) return;
    const rows = [...document.querySelectorAll('[id^="tr-"]')].map((r, i) => ({ id: r.id.replace('tr-',''), order: i }));
    const di = rows.findIndex(r => r.id === draggedId);
    const ti = rows.findIndex(r => r.id === targetId);
    if (di === -1 || ti === -1) return;
    rows.splice(ti, 0, rows.splice(di, 1)[0]);
    try {
      await Promise.all(rows.map((r, i) => api.updateOrder(r.id, i)));
      this.loadProducts();
    } catch (e) { showToast('Error al ordenar', 'error'); }
  }

  // ─── Edición rápida de precio ──────────────────────────
  startPriceEdit(id, current) {
    const cell = document.getElementById('price-cell-' + id);
    cell.innerHTML = `<div style="display:flex;gap:6px;align-items:center">
      <input type="number" id="pi-${id}" value="${current}" min="0" step="0.01"
             style="width:100px;padding:6px 8px;font-family:var(--serif);font-weight:700" />
      <button class="btn btn-primary btn-sm" onclick="productosPage.savePriceEdit('${id}')">✓</button>
      <button class="btn btn-secondary btn-sm" onclick="productosPage.loadProducts()">✕</button>
    </div>`;
    document.getElementById('pi-' + id).focus();
  }

  async savePriceEdit(id) {
    const p = parseFloat(document.getElementById('pi-' + id).value);
    if (isNaN(p) || p < 0) return showToast('Precio inválido', 'error');
    try { await api.updatePrice(id, p); showToast('💰 Precio actualizado'); this.loadProducts(); }
    catch (e) { showToast('Error: ' + e.message, 'error'); }
  }

  // ─── Modal ─────────────────────────────────────────────
  async openModal(productId = null) {
    this._currentEditId = productId;
    document.getElementById('modal-title').textContent = productId ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('modal-error').classList.remove('show');

    // Reset form
    ['modal-name','modal-price','modal-category','modal-image-url'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modal-unit').value   = 'kg';
    document.getElementById('modal-active').value = 'true';
    document.getElementById('modal-dept').value   = 'verduras_granos';
    document.getElementById('modal-sold-by-weight').checked = false;
    this.selectEmoji('📦', null);
    this.removePhoto();

    // Reset photo tabs
    document.querySelectorAll('.photo-tab').forEach((b,i) => b.classList.toggle('active', i===0));
    document.querySelectorAll('.photo-panel').forEach((p,i) => p.classList.toggle('active', i===0));
    this._activePhotoTab = 'device';

    if (productId) {
      try {
        const products = await api.getProducts();
        const p = products.find(x => x.id === productId);
        if (p) {
          document.getElementById('modal-name').value     = p.name;
          document.getElementById('modal-price').value    = p.price;
          document.getElementById('modal-unit').value     = p.unit;
          document.getElementById('modal-category').value = p.category || '';
          document.getElementById('modal-active').value   = String(p.active);
          document.getElementById('modal-dept').value     = p.department;
          document.getElementById('modal-sold-by-weight').checked = !!p.sold_by_weight;
          this.selectEmoji(p.emoji || '📦', null);
          if (p.image_url) this._setPhoto(p.image_url);
        }
      } catch(e) { showToast('Error cargando', 'error'); }
    }
    document.getElementById('product-modal').classList.add('open');
  }

  closeModal() { document.getElementById('product-modal').classList.remove('open'); }

  async saveProduct() {
    const name     = document.getElementById('modal-name').value.trim();
    const price    = parseFloat(document.getElementById('modal-price').value);
    const unit     = document.getElementById('modal-unit').value;
    const category = document.getElementById('modal-category').value.trim();
    const active   = document.getElementById('modal-active').value === 'true';
    const dept     = document.getElementById('modal-dept').value;
    const emoji    = this._selectedEmoji || '📦';
    const errEl    = document.getElementById('modal-error');
    errEl.classList.remove('show');

    if (!name)               { errEl.textContent = 'El nombre es obligatorio.'; errEl.classList.add('show'); return; }
    if (isNaN(price)||price<0) { errEl.textContent = 'Precio inválido.';         errEl.classList.add('show'); return; }

    const payload = {
      name, price, unit,
      category: category || null,
      active, department: dept, emoji,
      sold_by_weight: document.getElementById('modal-sold-by-weight').checked,
      image_url: this._imageData || null
    };

    const btn = document.getElementById('btn-save-product');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      if (this._currentEditId) { await api.updateProduct(this._currentEditId, payload); showToast('✅ Producto actualizado'); }
      else                     { await api.createProduct(payload); showToast('✅ Producto creado'); }
      this.closeModal(); this.loadProducts();
    } catch(e) { errEl.textContent = e.message; errEl.classList.add('show'); }
    finally { btn.disabled = false; btn.textContent = 'Guardar'; }
  }

  async deleteProduct(id, name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try { await api.deleteProduct(id); showToast(`🗑 "${name}" eliminado`); this.loadProducts(); }
    catch(e) { showToast('Error: ' + e.message, 'error'); }
  }

  _fmt(a) { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(a); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.productosPage = new ProductosPage();
  document.getElementById('product-modal').addEventListener('click', function(e) {
    if (e.target === this) productosPage.closeModal();
  });
});
