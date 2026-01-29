const ADMIN_KEY = 'gift_store_admin';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => el.querySelectorAll(sel);

let isLoggedIn = sessionStorage.getItem(ADMIN_KEY) === 'true';
let currentOrderId = null;

function showPanel() {
  $('#loginScreen').classList.add('hidden');
  $('#adminPanel').classList.remove('hidden');
  loadProducts();
  loadOrders();
  loadSettings();
}

function showLogin() {
  sessionStorage.removeItem(ADMIN_KEY);
  isLoggedIn = false;
  $('#loginScreen').classList.remove('hidden');
  $('#adminPanel').classList.add('hidden');
}

function showToast(msg) {
  const el = $('#adminToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function api(url, options = {}) {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  }).then(r => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json().catch(() => ({}));
  });
}

$('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#adminPassword').value.trim();
  try {
    const res = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (res.success) {
      sessionStorage.setItem(ADMIN_KEY, 'true');
      isLoggedIn = true;
      showPanel();
      showToast('تم الدخول بنجاح');
    } else {
      showToast(res.message || 'كلمة المرور غير صحيحة');
    }
  } catch (err) {
    showToast('حدث خطأ. تحقق من تشغيل السيرفر.');
  }
});

$('#logoutBtn')?.addEventListener('click', showLogin);

if (isLoggedIn) showPanel();

// Tabs
$$('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    $$('.admin-tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const content = $('#tab-' + id);
    if (content) content.classList.add('active');
  });
});

// Products
async function loadProducts() {
  const tbody = $('#productsTableBody');
  if (!tbody) return;
  try {
    const list = await api('/api/admin/products');
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">لا توجد منتجات. أضف منتجاً من الزر أعلاه.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(p => `
      <tr>
        <td>${p.image ? `<img src="${p.image.startsWith('http') ? p.image : p.image}" alt="">` : '—'}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || 'عطور')}</td>
        <td>${Number(p.price).toLocaleString('ar-SA')}</td>
        <td>${p.active !== false ? 'ظاهر' : 'مخفي'}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary edit-product" data-id="${p.id}">تعديل</button>
          <button type="button" class="btn btn-sm btn-danger delete-product" data-id="${p.id}">حذف</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-product').forEach(btn => {
      btn.addEventListener('click', () => openProductModal(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete-product').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">فشل تحميل المنتجات. تحقق من السيرفر.</td></tr>';
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openProductModal(id) {
  $('#productModalTitle').textContent = id ? 'تعديل المنتج' : 'إضافة منتج';
  $('#productForm').reset();
  $('#productId').value = id || '';
  $('#productActive').checked = true;
  $('#currentImageWrap').style.display = 'none';
  $('#productImageInput').value = '';

  if (id) {
    api('/api/admin/products').then(list => {
      const p = list.find(x => x.id === id);
      if (p) {
        $('#productName').value = p.name || '';
        $('#productNameEn').value = p.nameEn || '';
        $('#productCategory').value = p.category || 'عطور';
        $('#productPrice').value = p.price ?? '';
        $('#productDescription').value = p.description || '';
        $('#productActive').checked = p.active !== false;
        if (p.image) {
          $('#currentImage').src = p.image.startsWith('http') ? p.image : p.image;
          $('#currentImageWrap').style.display = 'block';
        }
      }
    });
  }
  $('#productModal').classList.add('open');
}

function closeProductModal() {
  $('#productModal').classList.remove('open');
}

$('#addProductBtn')?.addEventListener('click', () => openProductModal(null));
$('#closeProductModal')?.addEventListener('click', closeProductModal);
$('#cancelProductBtn')?.addEventListener('click', closeProductModal);

$('#productForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#productId').value.trim();
  const name = $('#productName').value.trim();
  const nameEn = $('#productNameEn').value.trim();
  const category = $('#productCategory').value;
  const price = $('#productPrice').value;
  const description = $('#productDescription').value.trim();
  const active = $('#productActive').checked ? 'true' : 'false';
  const file = $('#productImageInput').files[0];

  const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
  const method = id ? 'PUT' : 'POST';

  try {
    let opts = { method };
    if (file) {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('nameEn', nameEn);
      formData.append('category', category);
      formData.append('price', price);
      formData.append('description', description);
      formData.append('active', active);
      formData.append('image', file);
      opts.body = formData;
    } else {
      let imageUrl = '';
      if (id) {
        const list = await api('/api/admin/products');
        imageUrl = list.find(p => p.id === id)?.image || '';
      }
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify({
        name,
        nameEn,
        category,
        price,
        description,
        active,
        imageUrl
      });
    }
    await fetch(url, opts).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    showToast(id ? 'تم تحديث المنتج' : 'تم إضافة المنتج');
    closeProductModal();
    loadProducts();
  } catch (err) {
    showToast('حدث خطأ. تأكد من صورة بحجم معقول أو أعد المحاولة.');
  }
});

async function deleteProduct(id) {
  if (!confirm('هل تريد حذف هذا المنتج؟')) return;
  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    showToast('تم حذف المنتج');
    loadProducts();
  } catch (e) {
    showToast('فشل الحذف');
  }
}

// Orders
async function loadOrders() {
  const tbody = $('#ordersTableBody');
  if (!tbody) return;
  try {
    const list = await api('/api/admin/orders');
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">لا توجد طلبات بعد.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(o => `
      <tr>
        <td>${escapeHtml(o.id)}</td>
        <td>${escapeHtml(o.customerName)}</td>
        <td>${escapeHtml(o.phone)}</td>
        <td>${Number(o.total || 0).toLocaleString('ar-SA')} ر.س</td>
        <td>${new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
        <td>${escapeHtml(o.status)}</td>
        <td><button type="button" class="btn btn-sm btn-primary view-order" data-id="${o.id}">عرض</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.view-order').forEach(btn => {
      btn.addEventListener('click', () => openOrderDetail(btn.dataset.id));
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted">فشل تحميل الطلبات.</td></tr>';
  }
}

function openOrderDetail(id) {
  currentOrderId = id;
  api('/api/admin/orders').then(orders => {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    $('#orderDetailId').textContent = o.id;
    const items = (o.items || []).map(i => `${i.name} × ${i.quantity || 1} = ${Number((i.price || 0) * (i.quantity || 1)).toLocaleString('ar-SA')} ر.س`).join('<br>');
    $('#orderDetailContent').innerHTML = `
      <p><strong>العميل:</strong> ${escapeHtml(o.customerName)}</p>
      <p><strong>الجوال:</strong> ${escapeHtml(o.phone)}</p>
      <p><strong>البريد:</strong> ${escapeHtml(o.email || '—')}</p>
      <p><strong>العنوان:</strong> ${escapeHtml(o.address)}</p>
      <p><strong>ملاحظات:</strong> ${escapeHtml(o.notes || '—')}</p>
      <p><strong>المنتجات:</strong><br>${items}</p>
      <p><strong>المجموع:</strong> ${Number(o.total || 0).toLocaleString('ar-SA')} ر.س</p>
      <p><strong>الحالة:</strong> ${escapeHtml(o.status)}</p>
    `;
    $('#orderStatusSelect').value = o.status || 'جديد';
    $('#orderDetailModal').classList.add('open');
  });
}

$('#closeOrderDetail')?.addEventListener('click', () => {
  $('#orderDetailModal').classList.remove('open');
  currentOrderId = null;
});

$('#updateOrderStatusBtn')?.addEventListener('click', async () => {
  if (!currentOrderId) return;
  const status = $('#orderStatusSelect').value;
  try {
    await api(`/api/admin/orders/${currentOrderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast('تم تحديث الحالة');
    loadOrders();
    const content = $('#orderDetailContent');
    const p = content.querySelector('p:last-of-type');
    if (p) p.innerHTML = '<strong>الحالة:</strong> ' + escapeHtml(status);
  } catch (e) {
    showToast('فشل التحديث');
  }
});

// Settings
async function loadSettings() {
  try {
    const config = await api('/api/admin/config');
    $('#storeName').value = config.storeName || '';
    $('#newPassword').value = '';
  } catch (e) {}
}

$('#settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const storeName = $('#storeName').value.trim();
  const newPassword = $('#newPassword').value.trim();
  const body = {};
  if (storeName) body.storeName = storeName;
  if (newPassword) body.adminPassword = newPassword;
  if (Object.keys(body).length === 0) {
    showToast('لم يتم تغيير أي إعداد');
    return;
  }
  try {
    await api('/api/admin/config', { method: 'PUT', body: JSON.stringify(body) });
    showToast('تم حفظ الإعدادات');
    if (newPassword) showToast('تم تغيير كلمة المرور. سجّل الدخول بها في المرة القادمة.');
  } catch (e) {
    showToast('فشل الحفظ');
  }
});
