"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { createPool } = require("./db.js");
const { getCachedAnalytics, warmupAnalytics } = require("./analytics.js");

const MAX_BODY_BYTES = 1024 * 1024;
const PAYMENT_METHODS = new Set(["Tunai", "QRIS", "Transfer", "Kartu debit"]);
const PUBLIC_FILES = new Set(["index.html", "app.html", "app.js", "styles.css"]);
const SESSION_COOKIE = "kasirku_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RECENT_TRANSACTIONS_LIMIT = 200;

const STATS_CACHE_TTL_MS = 5 * 60 * 1000;
const statsCacheByPool = new WeakMap();

function invalidateStatsCache(pool) {
  statsCacheByPool.delete(pool);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createSeedStore() {
  const products = [
    { id: "PRD-001", name: "Kopi Susu Gula Aren", category: "Minuman", price: 18000, stock: 32, emoji: "☕" },
    { id: "PRD-002", name: "Croissant Butter", category: "Makanan", price: 22000, stock: 18, emoji: "🥐" },
    { id: "PRD-003", name: "Matcha Latte", category: "Minuman", price: 24000, stock: 21, emoji: "🍵" },
    { id: "PRD-004", name: "Roti Cokelat", category: "Makanan", price: 15000, stock: 27, emoji: "🍞" },
    { id: "PRD-005", name: "Es Teh Lemon", category: "Minuman", price: 12000, stock: 3, emoji: "🍋" },
    { id: "PRD-006", name: "Cookies Cokelat", category: "Snack", price: 10000, stock: 14, emoji: "🍪" },
    { id: "PRD-007", name: "Sandwich Ayam", category: "Makanan", price: 28000, stock: 11, emoji: "🥪" },
    { id: "PRD-008", name: "Air Mineral", category: "Minuman", price: 7000, stock: 40, emoji: "💧" },
    { id: "PRD-009", name: "Donat Gula", category: "Snack", price: 9000, stock: 2, emoji: "🍩" }
  ];
  function sample(id, customer, hoursAgo, items, payment) {
    const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return {
      id,
      customer,
      date: date.toISOString(),
      items: items.map(([productId, qty]) => {
        const product = products.find((item) => item.id === productId);
        return { productId, name: product.name, price: product.price, qty };
      }),
      total: items.reduce((total, [productId, qty]) => total + products.find((item) => item.id === productId).price * qty, 0),
      payment,
      status: "Selesai"
    };
  }
  return {
    products,
    transactions: [
      sample("TRX-24110801", "Nadia Putri", 3, [["PRD-001", 2], ["PRD-002", 1]], "Tunai"),
      sample("TRX-24110802", "Rizky Ramadhan", 5, [["PRD-003", 1]], "QRIS"),
      sample("TRX-24110803", "Siti Rahma", 22, [["PRD-007", 1], ["PRD-006", 2]], "Transfer"),
      sample("TRX-24110804", "Budi Santoso", 27, [["PRD-005", 2]], "Tunai"),
      sample("TRX-24110805", "Dewi Anggraini", 49, [["PRD-004", 2], ["PRD-008", 1]], "QRIS"),
      sample("TRX-24110806", "Andi Wijaya", 70, [["PRD-001", 1]], "Tunai")
    ]
  };
}

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function formatPasswordHash(record) {
  return record.salt + ":" + record.hash;
}

function parsePasswordHash(stored) {
  if (typeof stored !== "string") return null;
  const parts = stored.split(":");
  if (parts.length !== 2) return null;
  const salt = parts[0];
  const hash = parts[1];
  if (!/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash)) return null;
  return { salt, hash };
}

function verifyPassword(password, storedHash) {
  const record = parsePasswordHash(storedHash);
  if (!record) return false;
  const expected = Buffer.from(record.hash, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(record.salt, "hex"), 64, { N: 16384, r: 8, p: 1 });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function toMysqlDatetime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function rowToProduct(row) {
  return { id: row.id, name: row.name, category: row.category, emoji: row.emoji, price: row.price, stock: row.stock };
}

function rowToTransaction(row, itemsByTransaction) {
  const items = itemsByTransaction.get(row.id) || [];
  return {
    id: row.id,
    customer: row.customer,
    date: row.date instanceof Date ? row.date.toISOString() : new Date(row.date).toISOString(),
    items: items.map((item) => ({ productId: item.product_id, name: item.name, price: item.price, qty: item.qty })),
    total: row.total,
    payment: row.payment,
    status: row.status
  };
}

async function ensureSchema(pool) {
  const schemaPath = path.join(__dirname, "grace_shop_schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  const withoutComments = schemaSql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  const statements = withoutComments.split(";").map((statement) => statement.trim()).filter((statement) => statement.length > 0);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function listProducts(pool) {
  const rows = await pool.query("SELECT id, name, category, emoji, price, stock FROM products ORDER BY created_at DESC, id DESC");
  return rows[0].map(rowToProduct);
}

async function listRecentTransactions(pool, limit) {
  const rows = await pool.query("SELECT id, customer, date, total, payment, status FROM transactions ORDER BY date DESC, id DESC LIMIT ?", [limit]);
  const transactions = rows[0];
  if (transactions.length === 0) return [];
  const ids = transactions.map((row) => row.id);
  const itemRows = await pool.query("SELECT transaction_id, product_id, name, price, qty FROM transaction_items WHERE transaction_id IN (?) ORDER BY id", [ids]);
  const itemsByTransaction = new Map();
  for (const item of itemRows[0]) {
    if (!itemsByTransaction.has(item.transaction_id)) itemsByTransaction.set(item.transaction_id, []);
    itemsByTransaction.get(item.transaction_id).push(item);
  }
  return transactions.map((row) => rowToTransaction(row, itemsByTransaction));
}

async function computeStats(pool) {
  const totalProducts = await pool.query("SELECT COUNT(*) AS total FROM products");
  const totalTransactions = await pool.query("SELECT COUNT(*) AS total FROM transactions");
  const revenue = await pool.query("SELECT COALESCE(SUM(total), 0) AS total FROM transactions WHERE status = ?", ["Selesai"]);
  const today = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM transactions WHERE status = ? AND date >= CURDATE() AND date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)", ["Selesai"]);
  const lowStock = await pool.query("SELECT COUNT(*) AS total FROM products WHERE stock <= 5");
  const healthyStock = await pool.query("SELECT COUNT(*) AS total FROM products WHERE stock >= 5");
  const inventory = await pool.query("SELECT COALESCE(SUM(price * stock), 0) AS total FROM products");
  const todayItems = await pool.query("SELECT COALESCE(SUM(ti.qty), 0) AS total FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id WHERE t.status = ? AND t.date >= CURDATE() AND t.date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)", ["Selesai"]);
  const salesByDay = await pool.query("SELECT DATE(date) AS day, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM transactions WHERE status = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY DATE(date) ORDER BY day", ["Selesai"]);
  return {
    totalProducts: totalProducts[0][0].total,
    totalTransactions: totalTransactions[0][0].total,
    totalRevenue: revenue[0][0].total,
    transactionsToday: today[0][0].count,
    revenueToday: today[0][0].total,
    lowStockCount: lowStock[0][0].total,
    healthyStockCount: healthyStock[0][0].total,
    inventoryValue: inventory[0][0].total,
    itemsToday: todayItems[0][0].total,
    salesByDay: salesByDay[0].map((row) => ({ date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10), count: row.count, total: row.total }))
  };
}

async function getStats(pool) {
  const cached = statsCacheByPool.get(pool);
  if (cached && cached.stats && Date.now() - cached.at < STATS_CACHE_TTL_MS) return cached.stats;
  if (cached && cached.promise) return cached.promise;
  const promise = computeStats(pool).then((stats) => {
    statsCacheByPool.set(pool, { stats, at: Date.now(), promise: null });
    return stats;
  }).catch((error) => {
    statsCacheByPool.delete(pool);
    throw error;
  });
  statsCacheByPool.set(pool, { stats: null, at: 0, promise });
  return promise;
}

async function buildState(pool, session) {
  const products = await listProducts(pool);
  const transactions = await listRecentTransactions(pool, RECENT_TRANSACTIONS_LIMIT);
  const stats = await getStats(pool);
  return { products, transactions, stats, user: { username: session.username, role: session.role } };
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Isi permintaan terlalu besar."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) return resolve({});
      const contentType = request.headers["content-type"] || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(text);
        const body = {};
        for (const [key, value] of params) body[key] = value;
        return resolve(body);
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new HttpError(400, "Isi permintaan bukan JSON yang valid."));
      }
    });
    request.on("error", () => reject(new HttpError(400, "Permintaan tidak dapat dibaca.")));
  });
}

function productValues(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  const price = body.price;
  const stock = body.stock;
  if (!name) throw new HttpError(400, "Nama produk wajib diisi.");
  if (name.length > 60) throw new HttpError(400, "Nama produk maksimal 60 karakter.");
  if (!category) throw new HttpError(400, "Kategori produk wajib diisi.");
  if (category.length > 40) throw new HttpError(400, "Kategori produk maksimal 40 karakter.");
  if (!emoji) throw new HttpError(400, "Emoji produk wajib diisi.");
  if (emoji.length > 12) throw new HttpError(400, "Emoji produk maksimal 12 karakter.");
  if (!Number.isSafeInteger(price) || price <= 0) throw new HttpError(400, "Harga produk harus bilangan bulat lebih dari 0.");
  if (!Number.isSafeInteger(stock) || stock < 0) throw new HttpError(400, "Stok produk harus bilangan bulat 0 atau lebih.");
  return { name, category, emoji, price, stock };
}

async function serveStatic(response, publicRoot, file) {
  if (!PUBLIC_FILES.has(file)) throw new HttpError(404, "Halaman tidak ditemukan.");
  const filePath = path.join(publicRoot, file);
  const content = await fs.readFile(filePath);
  const contentType = file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
  response.writeHead(200, { "Content-Type": contentType, "Content-Length": content.length });
  response.end(content);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function authPage(mode, errorMessage) {
  const isSetup = mode === "setup";
  const title = isSetup ? "Buat akun admin - Grace Shop" : "Masuk - Grace Shop";
  const heading = isSetup ? "Buat akun admin" : "Masuk ke Grace Shop";
  const description = isSetup ? "Buat akun admin pertama untuk mengelola toko." : "Masuk dengan akun admin atau kasir Anda.";
  const action = isSetup ? "/setup" : "/login";
  const button = isSetup ? "Buat akun admin" : "Masuk";
  const error = errorMessage ? `<p class="auth-error">${escapeHtml(errorMessage)}</p>` : "";
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#f6f7fb" />
<title>${title}</title>
<script>try{var t=localStorage.getItem("grace-shop-theme");if(!t||(t!=="light"&&t!=="dark"&&t!=="oled")){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",t==="oled"?"#000000":t==="dark"?"#14161f":"#f6f7fb");}}catch(e){}</script>
<style>:root{--auth-bg:#f5f6fa;--auth-surface:#ffffff;--auth-ink:#202335;--auth-muted:#8d92a5;--auth-purple:#6658e8;--auth-purple-soft:#f0efff;--auth-line:#e7e9f0;--auth-input:#ffffff;--auth-ring:0 0 0 3px rgba(102,88,232,.28);--auth-glow:0}html[data-theme="dark"]{--auth-bg:#14161f;--auth-surface:#1d202c;--auth-ink:#e9eaf2;--auth-muted:#9aa0b6;--auth-purple:#a89df7;--auth-purple-soft:#2b2750;--auth-line:#2c3040;--auth-input:#242836;--auth-ring:0 0 0 3px rgba(168,157,247,.35);--auth-glow:.45}html[data-theme="oled"]{--auth-bg:#000000;--auth-surface:#0a0a0f;--auth-ink:#f5f6fa;--auth-muted:#9a9fb2;--auth-purple:#a89df7;--auth-purple-soft:#1d1938;--auth-line:#1e1e28;--auth-input:#121218;--auth-ring:0 0 0 3px rgba(168,157,247,.35);--auth-glow:1}*{box-sizing:border-box}html{color-scheme:light}html[data-theme="dark"],html[data-theme="oled"]{color-scheme:dark}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--auth-bg);color:var(--auth-ink);margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;position:relative}body::before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(520px 340px at 50% 16%,rgba(102,88,232,.30),transparent 70%),radial-gradient(420px 300px at 50% 96%,rgba(102,88,232,.16),transparent 70%);opacity:var(--auth-glow);transition:opacity .3s ease}.auth-card{position:relative;background:var(--auth-surface);border:1px solid var(--auth-line);border-radius:20px;padding:32px 30px 26px;width:min(420px,94vw);box-shadow:0 18px 50px rgba(0,0,0,.18)}html[data-theme="oled"] .auth-card{box-shadow:0 0 0 1px rgba(168,157,247,.14),0 24px 70px rgba(0,0,0,.8)}.auth-brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}.auth-logo{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6658e8,#8b7ff5);color:#fff;font-size:22px;font-weight:800;box-shadow:0 6px 18px rgba(102,88,232,.45)}.auth-brand-name{font-size:26px;font-weight:800;letter-spacing:-.02em}h1{margin:0 0 6px;font-size:21px;line-height:1.3}.auth-sub{margin:0 0 4px;color:var(--auth-muted);font-size:14px;line-height:1.5}.auth-error{background:#fdecec;color:#b3261e;border:1px solid #f5c6c6;border-radius:8px;padding:10px 12px;margin:14px 0 0;font-size:14px}html[data-theme="dark"] .auth-error,html[data-theme="oled"] .auth-error{background:#3a2226;color:#ffb4b4;border-color:#5c3436}.auth-field{margin-top:16px}label{display:block;margin:0 0 6px;font-weight:600;font-size:14px}input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--auth-line);border-radius:10px;font-size:15px;background:var(--auth-input);color:var(--auth-ink);outline:none}input:focus{border-color:var(--auth-purple);box-shadow:var(--auth-ring)}.auth-password{position:relative}.auth-password input{padding-right:104px}.auth-show{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--auth-purple);font-size:13px;font-weight:700;cursor:pointer;padding:6px 8px;border-radius:8px}.auth-show:hover{background:var(--auth-purple-soft)}.auth-submit{margin-top:20px;width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#6658e8,#7c6ff0);color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(102,88,232,.35)}.auth-submit:hover{filter:brightness(1.06)}.auth-submit:focus-visible{outline:none;box-shadow:var(--auth-ring)}.auth-help{margin:18px 0 0;text-align:center;color:var(--auth-muted);font-size:12.5px;line-height:1.5}</style>
</head>
<body>
<main class="auth-card">
<div class="auth-brand"><span class="auth-logo" aria-hidden="true">G</span><span class="auth-brand-name">Grace Shop</span></div>
<h1>${heading}</h1>
<p class="auth-sub">${description}</p>
${error}
<form method="post" action="${action}">
<div class="auth-field"><label for="username">Nama pengguna</label><input id="username" name="username" autocomplete="username" required maxlength="64" /></div>
<div class="auth-field"><label for="password">Kata sandi</label><div class="auth-password"><input id="password" type="password" name="password" autocomplete="current-password" required maxlength="256" /><button type="button" class="auth-show" id="togglePassword" aria-label="Tampilkan kata sandi">Lihat</button></div></div>
<button type="submit" class="auth-submit">${button}</button>
</form>
<p class="auth-help">Admin mengelola toko &amp; pengguna &middot; Kasir melayani penjualan di POS</p>
</main>
<script>(function(){var b=document.getElementById("togglePassword"),i=document.getElementById("password");if(!b||!i){return;}b.addEventListener("click",function(){var show=i.type==="password";i.type=show?"text":"password";b.textContent=show?"Sembunyikan":"Lihat";b.setAttribute("aria-label",show?"Sembunyikan kata sandi":"Tampilkan kata sandi");i.focus();});})();</script>
</body>
</html>`;
}

function createAppServer(options = {}) {
  const publicRoot = path.resolve(options.publicRoot || __dirname);
  const pool = options.pool || createPool(options.dbName);
  const shouldSeed = options.seed !== false;
  const sessions = new Map();

  async function init() {
    await ensureSchema(pool);
    if (!shouldSeed) return;
    const count = await pool.query("SELECT COUNT(*) AS total FROM products");
    if (count[0][0].total > 0) return;
    const seed = createSeedStore();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const product of seed.products) {
        await connection.query("INSERT INTO products (id, name, category, emoji, price, stock) VALUES (?, ?, ?, ?, ?, ?)", [product.id, product.name, product.category, product.emoji, product.price, product.stock]);
      }
      for (const transaction of seed.transactions) {
        await connection.query("INSERT INTO transactions (id, customer, date, total, payment, status) VALUES (?, ?, ?, ?, ?, ?)", [transaction.id, transaction.customer, toMysqlDatetime(transaction.date), transaction.total, transaction.payment, transaction.status]);
        const itemValues = transaction.items.map((item) => [transaction.id, item.productId, item.name, item.price, item.qty]);
        await connection.query("INSERT INTO transaction_items (transaction_id, product_id, name, price, qty) VALUES ?", [itemValues]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  function getSession(request) {
    const cookie = request.headers.cookie || "";
    const match = cookie.match(/kasirku_session=([^;]+)/);
    if (!match) return null;
    const session = sessions.get(match[1]);
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(match[1]);
      return null;
    }
    return { token: match[1], username: session.username, role: session.role };
  }

  function createSession(response, username, role) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { username, role, createdAt: Date.now() });
    response.setHeader("Set-Cookie", SESSION_COOKIE + "=" + token + "; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=86400");
    return token;
  }

  function destroySession(request, response) {
    const session = getSession(request);
    if (session) sessions.delete(session.token);
    response.setHeader("Set-Cookie", SESSION_COOKIE + "=; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=0");
  }

  function wantsJson(request) {
    const accept = request.headers.accept || "";
    const contentType = request.headers["content-type"] || "";
    return accept.includes("application/json") || contentType.includes("application/json");
  }

  function redirect(response, location) {
    response.writeHead(302, { Location: location });
    response.end();
  }

  async function getUserByUsername(username) {
    const rows = await pool.query("SELECT id, username, password_hash, role, created_at FROM users WHERE username = ? LIMIT 1", [username]);
    return rows[0][0] || null;
  }

  async function adminExists() {
    const rows = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = ?", ["admin"]);
    return rows[0][0].total > 0;
  }

  async function requireSession(request, response) {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { error: "Login diperlukan." });
      return null;
    }
    return session;
  }

  function requireRole(session, response, roles) {
    if (!roles.includes(session.role)) {
      sendJson(response, 403, { error: "Akses ditolak. Peran Anda tidak memiliki izin untuk tindakan ini." });
      return false;
    }
    return true;
  }

  async function doCheckout(body) {
    const customer = typeof body.customer === "string" && body.customer.trim() ? body.customer.trim().slice(0, 100) : "Pelanggan umum";
    const payment = body.payment;
    if (!PAYMENT_METHODS.has(payment)) throw new HttpError(400, "Metode pembayaran tidak valid.");
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) throw new HttpError(400, "Daftar item transaksi tidak valid.");
    const merged = new Map();
    for (const item of body.items) {
      if (!item || typeof item.productId !== "string") throw new HttpError(400, "Item transaksi tidak valid.");
      const qty = item.qty;
      if (!Number.isSafeInteger(qty) || qty <= 0) throw new HttpError(400, "Jumlah item harus bilangan bulat lebih dari 0.");
      merged.set(item.productId, (merged.get(item.productId) || 0) + qty);
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const ids = [...merged.keys()];
      const rows = await connection.query("SELECT id, name, price, stock FROM products WHERE id IN (?) FOR UPDATE", [ids]);
      const byId = new Map(rows[0].map((product) => [product.id, product]));
      for (const id of ids) {
        if (!byId.has(id)) throw new HttpError(404, "Salah satu produk tidak ditemukan.");
      }
      for (const [id, qty] of merged) {
        if (byId.get(id).stock < qty) throw new HttpError(409, "Stok " + byId.get(id).name + " tidak mencukupi.");
      }
      const total = [...merged].reduce((sum, [id, qty]) => sum + byId.get(id).price * qty, 0);
      if (!Number.isSafeInteger(total) || total <= 0) throw new HttpError(400, "Total transaksi tidak valid.");
      const transactionId = "TRX-" + Date.now().toString().slice(-8) + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
      const date = new Date();
      await connection.query("INSERT INTO transactions (id, customer, date, total, payment, status) VALUES (?, ?, ?, ?, ?, ?)", [transactionId, customer, toMysqlDatetime(date), total, payment, "Selesai"]);
      const itemValues = [...merged].map(([id, qty]) => [transactionId, id, byId.get(id).name, byId.get(id).price, qty]);
      await connection.query("INSERT INTO transaction_items (transaction_id, product_id, name, price, qty) VALUES ?", [itemValues]);
      for (const [id, qty] of merged) {
        await connection.query("UPDATE products SET stock = stock - ? WHERE id = ?", [qty, id]);
      }
      await connection.commit();
      return {
        id: transactionId,
        customer,
        date: date.toISOString(),
        items: itemValues.map(([, productId, name, price, qty]) => ({ productId, name, price, qty })),
        total,
        payment,
        status: "Selesai"
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function doCancel(transactionId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const rows = await connection.query("SELECT id, customer, date, total, payment, status FROM transactions WHERE id = ? FOR UPDATE", [transactionId]);
      if (rows[0].length === 0) throw new HttpError(404, "Transaksi tidak ditemukan.");
      const transaction = rows[0][0];
      if (transaction.status === "Dibatalkan") throw new HttpError(409, "Transaksi sudah dibatalkan.");
      const items = await connection.query("SELECT product_id, name, price, qty FROM transaction_items WHERE transaction_id = ?", [transactionId]);
      await connection.query("UPDATE transactions SET status = ? WHERE id = ?", ["Dibatalkan", transactionId]);
      for (const item of items[0]) {
        await connection.query("UPDATE products SET stock = stock + ? WHERE id = ?", [item.qty, item.product_id]);
      }
      await connection.commit();
      const itemsByTransaction = new Map([[transactionId, items[0]]]);
      return rowToTransaction({ ...transaction, status: "Dibatalkan" }, itemsByTransaction);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  const server = http.createServer(async (request, response) => {
  const pagesOrigin = "https://vikysimboh.github.io";
  if (request.headers.origin === pagesOrigin) {
    response.setHeader("Access-Control-Allow-Origin", pagesOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }
  if (request.method === "OPTIONS" && request.headers.origin === pagesOrigin) {
    response.writeHead(204);
    response.end();
    return;
  }
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = url.pathname;
      const method = request.method;
      const session = getSession(request);

      if (pathname === "/api/health") {
        return sendJson(response, 200, { status: "ok" });
      }

      if (pathname === "/setup") {
        if (method === "GET") {
          if (session) return redirect(response, "/app.html");
          if (await adminExists()) return redirect(response, "/login");
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(authPage("setup", null));
          return;
        }
        if (method === "POST") {
          if (await adminExists()) throw new HttpError(409, "Akun admin sudah ada.");
          const body = await readBody(request);
          const username = typeof body.username === "string" ? body.username.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";
          if (!username || username.length > 64 || !password || password.length > 256) {
            if (wantsJson(request)) throw new HttpError(400, "Nama pengguna dan kata sandi wajib diisi.");
            return redirect(response, "/setup");
          }
          const existing = await getUserByUsername(username);
          if (existing) throw new HttpError(409, "Nama pengguna sudah dipakai.");
          const passwordHash = formatPasswordHash(hashPassword(password));
          await pool.query("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", [username, passwordHash, "admin", toMysqlDatetime(new Date())]);
          createSession(response, username, "admin");
          if (wantsJson(request)) return sendJson(response, 201, { ok: true, username, role: "admin" });
          return redirect(response, "/app.html");
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }

      if (pathname === "/login") {
        if (method === "GET") {
          if (session) return redirect(response, "/app.html");
          const error = url.searchParams.get("error");
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(authPage("login", error === "salah" ? "Nama pengguna atau kata sandi salah." : null));
          return;
        }
        if (method === "POST") {
          const body = await readBody(request);
          const username = typeof body.username === "string" ? body.username.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";
          const user = username ? await getUserByUsername(username) : null;
          if (!user || !verifyPassword(password, user.password_hash)) {
            if (wantsJson(request)) throw new HttpError(401, "Nama pengguna atau kata sandi salah.");
            return redirect(response, "/login?error=salah");
          }
          createSession(response, user.username, user.role);
          if (wantsJson(request)) return sendJson(response, 200, { ok: true, username: user.username, role: user.role });
          return redirect(response, "/app.html");
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }

      if (pathname === "/logout") {
        if (method !== "GET" && method !== "POST") throw new HttpError(405, "Metode tidak diizinkan.");
        destroySession(request, response);
        if (method === "POST") return sendJson(response, 200, { ok: true });
        return redirect(response, "/login");
      }

      if (pathname === "/" || pathname === "/index.html") {
        return serveStatic(response, publicRoot, "index.html");
      }

      if (!session) {
        if (pathname.startsWith("/api/")) return sendJson(response, 401, { error: "Login diperlukan." });
        if (await adminExists()) return redirect(response, "/login");
        return redirect(response, "/setup");
      }

      if (method !== "GET" && (pathname === "/api/checkout" || pathname.startsWith("/api/products") || pathname.startsWith("/api/transactions/"))) {
        invalidateStatsCache(pool);
      }

      if (pathname === "/app.html") {
        return serveStatic(response, publicRoot, "app.html");
      }
      if (pathname === "/app.js" || pathname === "/styles.css") {
        return serveStatic(response, publicRoot, pathname.slice(1));
      }

      if (pathname === "/api/state") {
        if (method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.");
        if (url.searchParams.get("summary") === "1") {
          const stats = await getStats(pool);
          return sendJson(response, 200, { stats, user: { username: session.username, role: session.role } });
        }
        const state = await buildState(pool, session);
        return sendJson(response, 200, state);
  }

  if (pathname === "/api/analytics") {
    if (method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.");
    if (!requireRole(session, response, ["admin"])) return;
    const data = await getCachedAnalytics(pool);
    return sendJson(response, 200, data);
      }

      if (pathname === "/api/me") {
        if (method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.");
        return sendJson(response, 200, { username: session.username, role: session.role });
      }

      if (pathname === "/api/products") {
        if (method === "GET") {
          const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
          const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 1000);
          const search = (url.searchParams.get("search") || "").trim();
          const category = (url.searchParams.get("category") || "").trim();
          const maxStockRaw = url.searchParams.get("maxStock");
          const maxStock = maxStockRaw === null || maxStockRaw === "" ? null : Number(maxStockRaw);
          const where = [];
          const params = [];
          if (search) {
            where.push("(name LIKE ? OR id LIKE ? OR category LIKE ?)");
            params.push("%" + search + "%", "%" + search + "%", "%" + search + "%");
          }
          if (category && category !== "Semua") {
            where.push("category = ?");
            params.push(category);
          }
          if (maxStock !== null && !Number.isNaN(maxStock)) {
            where.push("stock <= ?");
            params.push(maxStock);
          }
          const whereSql = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
          const totalRows = await pool.query("SELECT COUNT(*) AS total FROM products" + whereSql, params);
          const total = totalRows[0][0].total;
          const totalPages = Math.max(Math.ceil(total / limit), 1);
          const safePage = Math.min(page, totalPages);
          const offset = (safePage - 1) * limit;
          const rows = await pool.query("SELECT id, name, category, emoji, price, stock FROM products" + whereSql + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", [...params, limit, offset]);
          return sendJson(response, 200, { products: rows[0].map(rowToProduct), total, page: safePage, limit, totalPages });
        }
        if (method === "POST") {
          if (!requireRole(session, response, ["admin"])) return;
          const values = productValues(await readBody(request));
          const id = "PRD-" + crypto.randomBytes(4).toString("hex").toUpperCase();
          await pool.query("INSERT INTO products (id, name, category, emoji, price, stock) VALUES (?, ?, ?, ?, ?, ?)", [id, values.name, values.category, values.emoji, values.price, values.stock]);
          const productRows = await pool.query("SELECT id, name, category, emoji, price, stock FROM products WHERE id = ?", [id]);
          const product = rowToProduct(productRows[0][0]);
          const state = await buildState(pool, session);
          return sendJson(response, 201, { product, state });
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }

      const productParts = pathname.split("/");
      const isProductPath = productParts.length === 4 && productParts[1] === "api" && productParts[2] === "products" && productParts[3] !== "";
      if (isProductPath) {
        let productId;
        try {
          productId = decodeURIComponent(productParts[3]);
        } catch (error) {
          throw new HttpError(400, "ID produk tidak valid.");
        }
        if (method === "PUT") {
          if (!requireRole(session, response, ["admin"])) return;
          const values = productValues(await readBody(request));
          const found = await pool.query("SELECT id FROM products WHERE id = ?", [productId]);
          if (found[0].length === 0) throw new HttpError(404, "Produk tidak ditemukan.");
          await pool.query("UPDATE products SET name = ?, category = ?, emoji = ?, price = ?, stock = ? WHERE id = ?", [values.name, values.category, values.emoji, values.price, values.stock, productId]);
          const productRows = await pool.query("SELECT id, name, category, emoji, price, stock FROM products WHERE id = ?", [productId]);
          const product = rowToProduct(productRows[0][0]);
          const state = await buildState(pool, session);
          return sendJson(response, 200, { product, state });
        }
        if (method === "DELETE") {
          if (!requireRole(session, response, ["admin"])) return;
          const found = await pool.query("SELECT id FROM products WHERE id = ?", [productId]);
          if (found[0].length === 0) throw new HttpError(404, "Produk tidak ditemukan.");
          const used = await pool.query("SELECT COUNT(*) AS total FROM transaction_items WHERE product_id = ?", [productId]);
          if (used[0][0].total > 0) throw new HttpError(409, "Produk yang pernah masuk transaksi tidak dapat dihapus.");
          await pool.query("DELETE FROM products WHERE id = ?", [productId]);
          const state = await buildState(pool, session);
          return sendJson(response, 200, { state });
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }

      if (pathname === "/api/checkout") {
        if (method !== "POST") throw new HttpError(405, "Metode tidak diizinkan.");
        const body = await readBody(request);
        const transaction = await doCheckout(body);
        const state = await buildState(pool, session);
        return sendJson(response, 201, { transaction, state });
      }

      const cancelParts = pathname.split("/");
      const isCancelPath = cancelParts.length === 5 && cancelParts[1] === "api" && cancelParts[2] === "transactions" && cancelParts[4] === "cancel" && cancelParts[3] !== "";
      if (isCancelPath) {
        if (method !== "POST") throw new HttpError(405, "Metode tidak diizinkan.");
        if (!requireRole(session, response, ["admin"])) return;
        let transactionId;
        try {
          transactionId = decodeURIComponent(cancelParts[3]);
        } catch (error) {
          throw new HttpError(400, "ID transaksi tidak valid.");
        }
        const transaction = await doCancel(transactionId);
        const state = await buildState(pool, session);
        return sendJson(response, 200, { transaction, state });
      }

      if (pathname === "/api/transactions") {
        if (method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.");
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
        const search = (url.searchParams.get("search") || "").trim();
        const status = (url.searchParams.get("status") || "").trim();
        const where = [];
        const params = [];
        if (search) {
          where.push("(id LIKE ? OR customer LIKE ?)");
          params.push("%" + search + "%", "%" + search + "%");
        }
        if (status && status !== "Semua status") {
          where.push("status = ?");
          params.push(status);
        }
        const whereSql = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
        const totalRows = await pool.query("SELECT COUNT(*) AS total FROM transactions" + whereSql, params);
        const rows = await pool.query("SELECT id, customer, date, total, payment, status FROM transactions" + whereSql + " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?", [...params, limit, offset]);
        const transactions = rows[0];
        const itemsByTransaction = new Map();
        if (transactions.length > 0) {
          const ids = transactions.map((row) => row.id);
          const itemRows = await pool.query("SELECT transaction_id, product_id, name, price, qty FROM transaction_items WHERE transaction_id IN (?) ORDER BY id", [ids]);
          for (const item of itemRows[0]) {
            if (!itemsByTransaction.has(item.transaction_id)) itemsByTransaction.set(item.transaction_id, []);
            itemsByTransaction.get(item.transaction_id).push(item);
          }
        }
        return sendJson(response, 200, { transactions: transactions.map((row) => rowToTransaction(row, itemsByTransaction)), total: totalRows[0][0].total, limit, offset });
      }

      if (pathname === "/api/report") {
        if (method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.");
        if (!requireRole(session, response, ["admin"])) return;
        const days = Math.min(Math.max(parseInt(url.searchParams.get("period") || "30", 10) || 30, 1), 365);
        const summary = await pool.query("SELECT COUNT(*) AS transactionCount, COALESCE(SUM(total), 0) AS revenue, COALESCE(AVG(total), 0) AS average FROM transactions WHERE status = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", ["Selesai", days]);
        const daily = await pool.query("SELECT DATE(date) AS day, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM transactions WHERE status = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(date) ORDER BY day", ["Selesai", days]);
        const payments = await pool.query("SELECT payment AS method, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM transactions WHERE status = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY payment ORDER BY total DESC", ["Selesai", days]);
        const best = await pool.query("SELECT ti.product_id AS productId, ti.name AS name, p.category AS category, p.emoji AS emoji, SUM(ti.qty) AS qty, SUM(ti.price * ti.qty) AS revenue FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id JOIN products p ON p.id = ti.product_id WHERE t.status = ? AND t.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY ti.product_id, ti.name, p.category, p.emoji ORDER BY qty DESC LIMIT 10", ["Selesai", days]);
        return sendJson(response, 200, {
          period: days,
          revenue: summary[0][0].revenue,
          transactionCount: summary[0][0].transactionCount,
          average: summary[0][0].average,
          dailySales: daily[0].map((row) => ({ date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10), count: row.count, total: row.total })),
          paymentSummary: payments[0],
          bestProducts: best[0]
        });
      }

      if (pathname === "/api/users") {
        if (!requireRole(session, response, ["admin"])) return;
        if (method === "GET") {
          const rows = await pool.query("SELECT id, username, role, created_at FROM users ORDER BY id");
          const users = rows[0].map((row) => ({ id: row.id, username: row.username, role: row.role, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) }));
          return sendJson(response, 200, { users });
        }
        if (method === "POST") {
          const body = await readBody(request);
          const username = typeof body.username === "string" ? body.username.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";
          const role = body.role === "admin" ? "admin" : body.role === "kasir" ? "kasir" : null;
          if (!username || username.length > 64 || !password || password.length > 256 || !role) throw new HttpError(400, "Nama pengguna, kata sandi, dan peran wajib diisi dengan benar.");
          const existing = await getUserByUsername(username);
          if (existing) throw new HttpError(409, "Nama pengguna sudah dipakai.");
          const passwordHash = formatPasswordHash(hashPassword(password));
          const result = await pool.query("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", [username, passwordHash, role, toMysqlDatetime(new Date())]);
          return sendJson(response, 201, { user: { id: result[0].insertId, username, role } });
        }
        throw new HttpError(405, "Metode tidak diizinkan.");
      }

      if (pathname.startsWith("/api/")) {
        throw new HttpError(404, "Endpoint API tidak ditemukan.");
      }

      throw new HttpError(404, "Halaman tidak ditemukan.");
    } catch (error) {
      if (error instanceof HttpError) {
        console.error("Kesalahan backend:", error.message);
        if (!response.headersSent) return sendJson(response, error.status, { error: error.message });
        return response.end();
      }
      console.error("Kesalahan backend:", error);
      if (!response.headersSent) return sendJson(response, 500, { error: "Terjadi kesalahan internal pada backend." });
      response.end();
    }
  });

  server.ready = init();

  const originalClose = server.close.bind(server);
  server.close = function (callback) {
    return originalClose(async (error) => {
      try {
        await pool.end();
      } catch (closeError) {
        console.error("Gagal menutup pool MySQL:", closeError);
      }
      if (typeof callback === "function") callback(error);
    });
  };

  server.pool = pool;
  return server;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || "127.0.0.1";
  const server = createAppServer();
  server.ready.then(() => {
    warmupAnalytics(server.pool);
    server.listen(PORT, HOST, () => {
      console.log("Grace Shop berjalan di http://" + HOST + ":" + PORT);
    });
  }).catch((error) => {
    console.error("Backend gagal dimulai:", error);
    process.exit(1);
  });
}

module.exports = { createAppServer };
