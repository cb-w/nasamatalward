const CART_KEY = 'gift_store_cart';

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let products = [];

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => el.querySelectorAll(sel);

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + (i.quantity || 1), 0);
  const countEl = $('#cartCount');
  if (countEl) countEl.textContent = count;
}

function addToCart(product, quantity = 1) {
  const existing = cart.find(p => p.id === product.id);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity
    });
  }
  saveCart();
  showToast('تمت إضافة المنتج إلى السلة');
}

function removeFromCart(id) {
  cart = cart.filter(p => p.id !== id);
  saveCart();
}

function getCartTotal() {
  return cart.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
}

function renderProducts(list) {
  const grid = $('#productsGrid');
  if (!grid) return;
  grid.classList.remove('loading');
  grid.innerHTML = '';

  if (!list || list.length === 0) {
    grid.innerHTML = '<p class="loading">لا توجد منتجات حالياً. تواصل معنا لمعرفة العروض.</p>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = p.category || 'عطور';
    const imgSrc = p.image ? (p.image.startsWith('http') ? p.image : p.image) : '';
    card.innerHTML = `
      <div class="product-image">
        ${imgSrc ? `<img src="${imgSrc}" alt="${p.name}" loading="lazy">` : '<span class="placeholder">🌸</span>'}
      </div>
      <div class="product-info">
        <span class="product-category">${escapeHtml(p.category || 'عطور')}</span>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-price">${formatPrice(p.price)} ر.س</div>
        <button type="button" class="btn btn-primary add-to-cart" data-id="${p.id}">أضف إلى السلة</button>
      </div>
    `;
    card.querySelector('.add-to-cart').addEventListener('click', () => addToCart(p));
    grid.appendChild(card);
  });
}

function renderCart() {
  const container = $('#cartItems');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">السلة فارغة. تصفح المنتجات وأضف ما يعجبك.</p>';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img class="cart-item-image" src="${item.image || ''}" alt="" onerror="this.style.display='none'">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-qty">الكمية: ${item.quantity || 1}</div>
        <div class="cart-item-price">${formatPrice((item.price || 0) * (item.quantity || 1))} ر.س</div>
      </div>
      <button type="button" class="cart-item-remove" aria-label="حذف">✕</button>
    </div>
  `).join('');

  $$('.cart-item-remove', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.cart-item').dataset.id;
      removeFromCart(id);
      renderCart();
    });
  });

  const totalEl = $('#cartTotal');
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

function openCart() {
  renderCart();
  $('#cartDrawer').classList.add('open');
  $('#cartOverlay').classList.add('open');
}

function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartOverlay').classList.remove('open');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatPrice(n) {
  return Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function loadProducts() {
  const loading = $('#productsLoading');
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts(products);
    setupFilters();
  } catch (e) {
    if (loading) loading.textContent = 'حدث خطأ في تحميل المنتجات. تحقق من الاتصال.';
  }
}

function setupFilters() {
  const grid = $('#productsGrid');
  $$('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category;
      const list = cat === 'all' ? products : products.filter(p => (p.category || 'عطور') === cat);
      renderProducts(list);
    });
  });
}

function openCheckout() {
  if (cart.length === 0) {
    showToast('أضف منتجات إلى السلة أولاً');
    return;
  }
  closeCart();
  $('#checkoutModal').classList.add('open');
}

function closeCheckout() {
  $('#checkoutModal').classList.remove('open');
}

$('#checkoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const payload = {
    customerName: data.get('customerName'),
    phone: data.get('phone'),
    email: data.get('email') || '',
    address: data.get('address'),
    notes: data.get('notes') || '',
    items: cart,
    total: getCartTotal()
  };

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'جاري الإرسال...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      cart = [];
      saveCart();
      form.reset();
      closeCheckout();
      showToast('تم إرسال طلبك بنجاح. رقم الطلب: ' + result.orderId);
    } else {
      showToast(result.message || 'حدث خطأ. حاول مرة أخرى.');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال. حاول مرة أخرى.');
  }
  btn.disabled = false;
  btn.textContent = 'تأكيد الطلب';
});

$('#cartBtn')?.addEventListener('click', openCart);
$('#closeCart')?.addEventListener('click', closeCart);
$('#cartOverlay')?.addEventListener('click', closeCart);
$('#checkoutBtn')?.addEventListener('click', openCheckout);
$('#closeCheckout')?.addEventListener('click', closeCheckout);

updateCartUI();
loadProducts();
