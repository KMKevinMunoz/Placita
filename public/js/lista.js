// public/js/lista.js
// La lista se guarda en localStorage del navegador — no necesita backend

class ListaPage {
  constructor() {
    if (!api.requireAuth()) return;
    this._initUI();
    this._loadProducts();
    this.render('falta');
    this.render('pedido');
    this._renderResumen();
  }

  _initUI() {
    const user = api.getUser();
    if (user) {
      document.getElementById('user-name').textContent = user.username;
      document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }

    // Enter en inputs
    document.getElementById('input-falta').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.add('falta');
    });
    document.getElementById('input-pedido').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.add('pedido');
    });
  }

  async _loadProducts() {
    try {
      const products = await api.getProducts();
      this._renderHints('hints-falta',  products, 'falta');
      this._renderHints('hints-pedido', products, 'pedido');
    } catch(e) { /* hints son opcionales */ }
  }

  _renderHints(containerId, products, tipo) {
    const container = document.getElementById(containerId);
    if (!products?.length) { container.innerHTML = ''; return; }
    container.innerHTML = products.slice(0, 12).map(p => `
      <span class="product-hint" onclick="listaPage.addFromProduct('${p.name.replace(/'/g,"\\'")}', '${tipo}')">
        ${p.emoji || '📦'} ${p.name}
      </span>`).join('');
  }

  _getList(tipo) {
    try { return JSON.parse(localStorage.getItem(`placita_lista_${tipo}`) || '[]'); }
    catch { return []; }
  }

  _saveList(tipo, items) {
    localStorage.setItem(`placita_lista_${tipo}`, JSON.stringify(items));
  }

  add(tipo) {
    const input = document.getElementById(`input-${tipo}`);
    const text  = (input.value || '').trim();
    if (!text) { input.focus(); return; }
    const items = this._getList(tipo);
    items.unshift({ id: Date.now(), text, done: false, ts: new Date().toISOString() });
    this._saveList(tipo, items);
    input.value = '';
    this.render(tipo);
    this._renderResumen();
    showToast(`✅ "${text}" agregado`);
  }

  addFromProduct(name, tipo) {
    const items = this._getList(tipo);
    if (items.find(i => i.text.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" ya está en la lista`, 'error');
      return;
    }
    items.unshift({ id: Date.now(), text: name, done: false, ts: new Date().toISOString() });
    this._saveList(tipo, items);
    this.render(tipo);
    this._renderResumen();
    showToast(`✅ "${name}" agregado`);
  }

  toggle(tipo, id) {
    const items = this._getList(tipo).map(i =>
      i.id === id ? { ...i, done: !i.done } : i
    );
    this._saveList(tipo, items);
    this.render(tipo);
    this._renderResumen();
  }

  del(tipo, id) {
    const items = this._getList(tipo).filter(i => i.id !== id);
    this._saveList(tipo, items);
    this.render(tipo);
    this._renderResumen();
  }

  clearDone(tipo) {
    const items = this._getList(tipo).filter(i => !i.done);
    this._saveList(tipo, items);
    this.render(tipo);
    this._renderResumen();
    showToast('🧹 Completados eliminados');
  }

  clearAll(tipo) {
    if (!confirm('¿Limpiar toda la lista?')) return;
    this._saveList(tipo, []);
    this.render(tipo);
    this._renderResumen();
    showToast('🗑️ Lista limpiada');
  }

  render(tipo) {
    const container = document.getElementById(`list-${tipo}`);
    const items     = this._getList(tipo);
    const countEl   = document.getElementById(`count-${tipo}`);
    const pending   = items.filter(i => !i.done).length;
    if (countEl) countEl.textContent = pending;

    if (!items.length) {
      container.innerHTML = `<div class="empty-lista">${tipo === 'falta' ? '✅ Sin productos pendientes' : '😊 Sin pedidos de clientes'}</div>`;
      return;
    }

    const tagClass = tipo === 'falta'  ? 'tag-falta'  : 'tag-pedido';
    const tagLabel = tipo === 'falta'  ? '⚠️ Falta'   : '💬 Pedido';

    container.innerHTML = items.map(item => `
      <div class="lista-item${item.done ? ' done' : ''}" id="litem-${item.id}">
        <input type="checkbox" class="item-check" ${item.done ? 'checked' : ''}
          onchange="listaPage.toggle('${tipo}', ${item.id})" />
        <span class="item-text">${this._esc(item.text)}</span>
        <span class="item-tag ${tagClass}">${tagLabel}</span>
        <button class="item-del" onclick="listaPage.del('${tipo}', ${item.id})" title="Eliminar">✕</button>
      </div>`).join('');
  }

  _renderResumen() {
    const el     = document.getElementById('resumen-dia');
    const falta  = this._getList('falta');
    const pedido = this._getList('pedido');
    const pendFalta  = falta.filter(i => !i.done);
    const pendPedido = pedido.filter(i => !i.done);

    if (!pendFalta.length && !pendPedido.length) {
      el.innerHTML = '<span style="color:var(--green)">✅ Todo al día — sin pendientes en ninguna lista</span>';
      return;
    }

    let html = '';
    if (pendFalta.length) {
      html += `<strong style="color:#92400E">⚠️ Faltan ${pendFalta.length} producto${pendFalta.length!==1?'s':''}:</strong> `;
      html += pendFalta.map(i => `<em>${i.text}</em>`).join(', ');
      html += '<br>';
    }
    if (pendPedido.length) {
      html += `<strong style="color:#5B21B6">💬 ${pendPedido.length} pedido${pendPedido.length!==1?'s':''}:</strong> `;
      html += pendPedido.map(i => `<em>${i.text}</em>`).join(', ');
    }
    el.innerHTML = html;
  }

  exportar() {
    const falta  = this._getList('falta').filter(i => !i.done);
    const pedido = this._getList('pedido').filter(i => !i.done);
    let txt = '📝 LISTA PLACITA\n';
    if (falta.length)  txt += `\n🚨 PRODUCTOS QUE FALTAN:\n${falta.map(i => `  • ${i.text}`).join('\n')}`;
    if (pedido.length) txt += `\n\n💬 CLIENTES PIDIENDO:\n${pedido.map(i => `  • ${i.text}`).join('\n')}`;
    if (!falta.length && !pedido.length) { showToast('La lista está vacía', 'error'); return; }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => showToast('📋 Lista copiada al portapapeles'));
    } else {
      prompt('Copia esta lista:', txt);
    }
  }

  _esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}

document.addEventListener('DOMContentLoaded', () => { window.listaPage = new ListaPage(); });
