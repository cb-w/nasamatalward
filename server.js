const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'image').replace(/\s/g, '-'))
});
const upload = multer({ storage });

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return file === PRODUCTS_FILE ? [] : file === ORDERS_FILE ? [] : {};
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== واجهة المتجر (للزوار) ==========
app.get('/api/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  res.json(products.filter(p => p.active !== false));
});

app.get('/api/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const p = products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'منتج غير موجود' });
  res.json(p);
});

// إرسال طلب جديد
app.post('/api/orders', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const order = {
    id: 'ORD-' + Date.now(),
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'جديد'
  };
  orders.unshift(order);
  writeJSON(ORDERS_FILE, orders);
  res.json({ success: true, orderId: order.id });
});

// ========== لوحة التحكم (تحتاج كلمة مرور) ==========
app.post('/api/admin/login', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  if (req.body.password === config.adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
  }
});

app.get('/api/admin/products', (req, res) => {
  res.json(readJSON(PRODUCTS_FILE));
});

app.post('/api/admin/products', upload.single('image'), (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const id = 'p' + Date.now();
  const imageUrl = req.file ? '/uploads/' + req.file.filename : (req.body.imageUrl || '');
  const product = {
    id,
    name: req.body.name,
    nameEn: req.body.nameEn || req.body.name,
    description: req.body.description || '',
    price: parseFloat(req.body.price) || 0,
    category: req.body.category || 'عطور',
    image: imageUrl,
    active: req.body.active !== 'false',
    createdAt: new Date().toISOString()
  };
  products.push(product);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, product });
});

app.put('/api/admin/products/:id', upload.single('image'), (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'منتج غير موجود' });
  const imageUrl = req.file ? '/uploads/' + req.file.filename : (products[idx].image || '');
  products[idx] = {
    ...products[idx],
    name: req.body.name ?? products[idx].name,
    nameEn: req.body.nameEn ?? products[idx].nameEn,
    description: req.body.description ?? products[idx].description,
    price: parseFloat(req.body.price) ?? products[idx].price,
    category: req.body.category ?? products[idx].category,
    image: req.file ? imageUrl : (req.body.imageUrl || products[idx].image),
    active: req.body.active !== 'false'
  };
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, product: products[idx] });
});

app.delete('/api/admin/products/:id', (req, res) => {
  let products = readJSON(PRODUCTS_FILE);
  products = products.filter(p => p.id !== req.params.id);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.get('/api/admin/orders', (req, res) => {
  res.json(readJSON(ORDERS_FILE));
});

app.put('/api/admin/orders/:id/status', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const o = orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'طلب غير موجود' });
  o.status = req.body.status || o.status;
  writeJSON(ORDERS_FILE, orders);
  res.json({ success: true, order: o });
});

app.get('/api/admin/config', (req, res) => {
  res.json(readJSON(CONFIG_FILE));
});

app.put('/api/admin/config', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  if (req.body.adminPassword) config.adminPassword = req.body.adminPassword;
  if (req.body.storeName) config.storeName = req.body.storeName;
  writeJSON(CONFIG_FILE, config);
  res.json({ success: true, config });
});

// صفحة المتجر
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).end();
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log('');
  console.log('  متجر الهدايا والعطور يعمل الآن!');
  console.log('  المتجر:    ' + url);
  console.log('  لوحة التحكم: ' + url + '/admin');
  console.log('  كلمة مرور المدير الافتراضية: admin123');
  console.log('');
});
