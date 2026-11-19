'use strict';

/**
 * Agentic QA demo shop API.
 * Deliberately simple: in-memory state, no persistence, no real auth.
 * Seeded bugs are OFF by default. They activate per request through the
 * `seeded_bugs` cookie or the SEEDED_BUGS env var. See docs/seeded-bugs.private.json.
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const PORT = Number(process.env.PORT || 3100);
const SEEDED_ENV = String(process.env.SEEDED_BUGS || '').trim();

const ALL_BUGS = Array.from({ length: 15 }, (_, i) => `BUG-${String(i + 1).padStart(2, '0')}`);

const TAX_RATE = 0.08;
const DISCOUNT_CODE = 'SAVE10';

// Prices in cents.
const PRODUCTS = [
  { id: 'p1', name: 'Aurora Laptop', price: 129900, category: 'laptops', stock: 5 },
  { id: 'p2', name: 'Trailback Backpack', price: 8900, category: 'accessories', stock: 12 },
  { id: 'p3', name: 'Lumen Desk Lamp', price: 4500, category: 'home', stock: 20 },
  { id: 'p4', name: 'Pebble Speaker', price: 1999, category: 'audio', stock: 8 },
  { id: 'p5', name: 'Nomad Mug', price: 1500, category: 'home', stock: 40 },
  { id: 'p6', name: 'Vertex Monitor', price: 34950, category: 'monitors', stock: 0 },
];

const USERS = new Map([
  ['demo@shop.test', { email: 'demo@shop.test', password: 'demo1234', name: 'Demo User' }],
  ['second@shop.test', { email: 'second@shop.test', password: 'second1234', name: 'Second User' }],
]);

const sessions = new Map(); // token -> email
const carts = new Map(); // token -> { items: Map<productId, qty>, staleTotal: number|null }
const orders = []; // { id, email, items, subtotal, tax, discount, total, createdAt }
let productListCalls = 0;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

/* ------------------------------ bugs ------------------------------ */

function activeBugs(req) {
  const active = new Set();
  const cookie = String(req.headers.cookie || '');
  const match = /(?:^|;\s*)seeded_bugs=([^;]+)/.exec(cookie);
  if (match) {
    decodeURIComponent(match[1])
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => active.add(id));
  }
  if (SEEDED_ENV) {
    (SEEDED_ENV === 'all' ? ALL_BUGS : SEEDED_ENV.split(',')).forEach((id) => active.add(id.trim()));
  }
  return active;
}

function has(req, id) {
  return activeBugs(req).has(id);
}

/* ----------------------------- helpers ---------------------------- */

function cartFor(token) {
  if (!carts.has(token)) carts.set(token, { items: new Map(), staleTotal: null });
  return carts.get(token);
}

function priceOf(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  return product ? product.price : 0;
}

function money(cents) {
  return Math.round(cents) / 100;
}

function snapshotCart(cart, bugs) {
  const items = [];
  let subtotal = 0;
  for (const [productId, qty] of cart.items.entries()) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) continue;
    subtotal += product.price * qty;
    items.push({ productId, name: product.name, price: money(product.price), qty });
  }
  const tax = Math.round(subtotal * TAX_RATE);
  let total = subtotal + tax;
  if (cart.staleTotal !== null) total = cart.staleTotal;
  return {
    items,
    subtotal: money(subtotal),
    tax: money(tax),
    total: money(total),
  };
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const email = sessions.get(token);
  if (!email) return res.status(401).json({ error: 'unauthorized' });
  req.userEmail = email;
  req.token = token;
  return next();
}

function publicProduct(product) {
  return { ...product, price: money(product.price) };
}

/* ------------------------------ bugs api -------------------------- */

app.get('/api/__bugs', (req, res) => {
  const ids = String(req.query.ids || '').trim();
  if (ids) {
    const list = (ids === 'all' ? ALL_BUGS : ids.split(',')).map((s) => s.trim()).filter(Boolean);
    res.setHeader('Set-Cookie', `seeded_bugs=${encodeURIComponent(list.join(','))}; Path=/; SameSite=Lax`);
    return res.json({ active: list });
  }
  return res.json({ active: [...activeBugs(req)] });
});

app.post('/api/__reset', (req, res) => {
  carts.clear();
  orders.length = 0;
  sessions.clear();
  productListCalls = 0;
  return res.json({ ok: true });
});

/* ------------------------------- auth ----------------------------- */

app.post('/api/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};

  // BUG-02: empty password accepted.
  if (has(req, 'BUG-02') && String(password) === '') {
    const user = USERS.get(String(email).trim());
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const token = crypto.randomUUID();
    sessions.set(token, user.email);
    return res.json({ token, user: { name: user.name, email: user.email } });
  }

  const user = USERS.get(String(email).trim());
  if (!user || user.password !== password) {
    if (has(req, 'BUG-14')) {
      // BUG-14: leaks internal detail in the error payload.
      return res.status(401).json({
        error: 'invalid credentials',
        detail: 'TypeError: Cannot read properties of undefined (reading password)\n    at /app/server.js:142:18',
      });
    }
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = crypto.randomUUID();
  sessions.set(token, user.email);
  return res.json({ token, user: { name: user.name, email: user.email } });
});

/* ----------------------------- products --------------------------- */

app.get('/api/products', (req, res) => {
  productListCalls += 1;
  // BUG-04: every third call fails.
  if (has(req, 'BUG-04') && productListCalls % 3 === 0) {
    return res.status(500).json({ error: 'internal error' });
  }

  const q = String(req.query.q || '').trim();
  let items = PRODUCTS;
  if (q) {
    // BUG-08: search becomes case-sensitive.
    if (has(req, 'BUG-08')) {
      items = PRODUCTS.filter((p) => p.name.includes(q));
    } else {
      items = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    }
  }
  return res.json({ items: items.map(publicProduct) });
});

app.get('/api/products/:id', (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'not found' });
  return res.json(publicProduct(product));
});

/* ------------------------------- cart ----------------------------- */

app.get('/api/cart', requireAuth, (req, res) => {
  return res.json(snapshotCart(cartFor(req.token), activeBugs(req)));
});

app.post('/api/cart', requireAuth, (req, res) => {
  const { productId, qty = 1 } = req.body || {};
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'product not found' });

  // BUG-03: negative quantities accepted.
  if (Number(qty) <= 0 && !has(req, 'BUG-03')) {
    return res.status(400).json({ error: 'quantity must be positive' });
  }
  // BUG-09: out-of-stock products can be added.
  if (product.stock <= 0 && !has(req, 'BUG-09')) {
    return res.status(400).json({ error: 'out of stock' });
  }

  const cart = cartFor(req.token);
  const next = (cart.items.get(productId) || 0) + Number(qty);
  cart.items.set(productId, next);
  cart.staleTotal = null;
  return res.json(snapshotCart(cart, activeBugs(req)));
});

app.patch('/api/cart/:productId', requireAuth, (req, res) => {
  const { productId } = req.params;
  const qty = Number((req.body || {}).qty);
  const cart = cartFor(req.token);
  if (!cart.items.has(productId)) return res.status(404).json({ error: 'not in cart' });

  // BUG-03: negative quantities accepted.
  if (!Number.isInteger(qty) || (qty < 0 && !has(req, 'BUG-03'))) {
    return res.status(400).json({ error: 'invalid quantity' });
  }

  if (qty === 0) {
    const before = snapshotCart({ ...cart, staleTotal: null }, activeBugs(req));
    cart.items.delete(productId);
    // BUG-11: total is not recomputed after the last item is removed.
    cart.staleTotal = has(req, 'BUG-11') ? Math.round(before.total * 100) : null;
    return res.json(snapshotCart(cart, activeBugs(req)));
  }

  cart.items.set(productId, qty);
  cart.staleTotal = null;
  return res.json(snapshotCart(cart, activeBugs(req)));
});

app.delete('/api/cart/:productId', requireAuth, (req, res) => {
  const { productId } = req.params;
  const cart = cartFor(req.token);
  if (!cart.items.has(productId)) return res.status(404).json({ error: 'not in cart' });
  const before = snapshotCart({ ...cart, staleTotal: null }, activeBugs(req));
  cart.items.delete(productId);
  // BUG-12: removing an item leaves the old total in place.
  cart.staleTotal = has(req, 'BUG-12') ? Math.round(before.total * 100) : null;
  return res.json(snapshotCart(cart, activeBugs(req)));
});

/* ----------------------------- checkout --------------------------- */

app.post('/api/checkout', requireAuth, (req, res) => {
  const cart = cartFor(req.token);
  const bugs = activeBugs(req);

  // BUG-13: empty cart checkout allowed.
  if (cart.items.size === 0 && !has(req, 'BUG-13')) {
    return res.status(400).json({ error: 'cart empty' });
  }

  const { items } = snapshotCart(cart, bugs);
  let subtotal = 0;
  for (const [productId, qty] of cart.items.entries()) subtotal += priceOf(productId) * qty;

  const tax = Math.round(subtotal * TAX_RATE);

  let discount = 0;
  const code = String((req.body || {}).discountCode || '').trim().toUpperCase();
  if (code === DISCOUNT_CODE) {
    // BUG-07: flat $10 instead of 10 percent.
    discount = has(req, 'BUG-07') ? 1000 : Math.min(Math.round(subtotal * 0.1), subtotal);
  }

  let total = subtotal + tax - discount;

  // BUG-01: tax counted twice in the total.
  if (has(req, 'BUG-01')) total = subtotal + tax + tax - discount;

  // BUG-15: three-decimal rounding leaks into the total.
  if (has(req, 'BUG-15')) total = Number(((subtotal * 1.08 - discount) / 100).toFixed(3)) * 100;

  const order = {
    id: `ORD-${String(orders.length + 1).padStart(4, '0')}`,
    email: req.userEmail,
    items,
    subtotal: money(subtotal),
    tax: money(tax),
    discount: money(discount),
    total: money(total),
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  cart.items.clear();
  cart.staleTotal = null;

  return res.status(201).json({ order });
});

app.get('/api/orders', requireAuth, (req, res) => {
  // BUG-10: returns every user's orders.
  const mine = has(req, 'BUG-10') ? orders : orders.filter((o) => o.email === req.userEmail);
  return res.json({ items: [...mine].reverse() });
});

/* ------------------------------- spa ------------------------------ */

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`agentic-qa shop listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = app;
