"use strict";

// Modul agregasi analisis Grace Shop — SATU sumber hitungan untuk:
//   - endpoint GET /api/analytics (dashboard)
//   - skrip ekspor CSV (exports/)
// Semua angka memakai transaksi status "Selesai" sebagai pendapatan.
// Jendela waktu relatif terhadap tanggal transaksi terakhir di data
// (bukan hari ini), supaya angka konsisten dengan data contoh 12 bulan.
// Modul ini HANYA membaca database (SELECT); tidak mengubah data.

const ANALYTICS_TTL_MS = 10 * 60 * 1000;

let cachedAnalytics = null;
let cachedAt = 0;
let warmingUp = null;

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function growthPct(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

async function query(pool, sql, params) {
  const [rows] = await pool.query(sql, params || []);
  return rows;
}

function buildWindow(rows, key) {
  const row = rows.find((item) => item.p === key) || {};
  return {
    transactions: num(row.n),
    revenue: num(row.rev),
    avgBasket: num(row.avgBasket),
  };
}

const WEEKDAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

async function getAnalytics(pool) {
  const rangeRows = await query(pool, `
    SELECT COUNT(*) AS nAll,
      SUM(status = 'Selesai') AS nDone,
      SUM(status = 'Dibatalkan') AS nCancel,
      MIN(date) AS firstTx,
      MAX(date) AS lastTx,
      COALESCE(SUM(CASE WHEN status = 'Selesai' THEN total END), 0) AS revDone,
      COALESCE(SUM(total), 0) AS revAll
    FROM transactions
  `);
  const range = rangeRows[0] || {};
  const lastTx = range.lastTx ? new Date(range.lastTx) : null;
  const lastDate = lastTx ? toDateOnly(lastTx) : formatDate(new Date());
  const firstDate = range.firstTx ? toDateOnly(range.firstTx) : null;
  const d30Start = lastTx ? formatDate(addDays(lastTx, -29)) : lastDate;
  const d7Start = lastTx ? formatDate(addDays(lastTx, -6)) : lastDate;
  const d30PrevStart = lastTx ? formatDate(addDays(lastTx, -59)) : lastDate;
  const d30PrevEnd = d30Start; // batas akhir eksklusif = awal jendela berjalan
  const d7PrevStart = lastTx ? formatDate(addDays(lastTx, -13)) : lastDate;
  const d7PrevEnd = d7Start; // batas akhir eksklusif = awal jendela berjalan
  const d90Start = lastTx ? formatDate(addDays(lastTx, -89)) : lastDate;

  const [
    windowRows,
    itemWindowRows,
    topByQtyRows,
    topByRevenueRows,
    categoryRows,
    monthlyRows,
    hourlyRows,
    weekdayRows,
    stockRows,
    unsoldRows,
    slowestRows,
  ] = await Promise.all([
    query(pool, `
      SELECT 'all' AS p, COUNT(*) AS n, COALESCE(SUM(total), 0) AS rev,
          COALESCE(AVG(total), 0) AS avgBasket
        FROM transactions WHERE status = 'Selesai'
      UNION ALL
      SELECT 'd30', COUNT(*), COALESCE(SUM(total), 0), COALESCE(AVG(total), 0)
        FROM transactions WHERE status = 'Selesai' AND date >= ?
      UNION ALL
      SELECT 'd7', COUNT(*), COALESCE(SUM(total), 0), COALESCE(AVG(total), 0)
        FROM transactions WHERE status = 'Selesai' AND date >= ?
      UNION ALL
      SELECT 'd30prev', COUNT(*), COALESCE(SUM(total), 0), COALESCE(AVG(total), 0)
        FROM transactions WHERE status = 'Selesai' AND date >= ? AND date < ?
      UNION ALL
      SELECT 'd7prev', COUNT(*), COALESCE(SUM(total), 0), COALESCE(AVG(total), 0)
        FROM transactions WHERE status = 'Selesai' AND date >= ? AND date < ?
    `, [d30Start, d7Start, d30PrevStart, d30PrevEnd, d7PrevStart, d7PrevEnd]),
    query(pool, `
      SELECT 'all' AS p, COALESCE(SUM(ti.qty), 0) AS items
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'Selesai'
      UNION ALL
      SELECT 'd30', COALESCE(SUM(ti.qty), 0)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'Selesai' AND t.date >= ?
      UNION ALL
      SELECT 'd7', COALESCE(SUM(ti.qty), 0)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'Selesai' AND t.date >= ?
    `, [d30Start, d7Start]),
    query(pool, `
      SELECT p.id AS sku, p.name, p.category, p.price,
          SUM(ti.qty) AS sold, SUM(ti.qty * ti.price) AS revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN products p ON p.id = ti.product_id
        WHERE t.status = 'Selesai'
        GROUP BY p.id, p.name, p.category, p.price
        ORDER BY sold DESC
        LIMIT 10
    `),
    query(pool, `
      SELECT p.id AS sku, p.name, p.category, p.price,
          SUM(ti.qty) AS sold, SUM(ti.qty * ti.price) AS revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN products p ON p.id = ti.product_id
        WHERE t.status = 'Selesai'
        GROUP BY p.id, p.name, p.category, p.price
        ORDER BY revenue DESC
        LIMIT 10
    `),
    query(pool, `
      SELECT p.category, COUNT(*) AS itemRows, COALESCE(SUM(ti.qty), 0) AS items,
          COALESCE(SUM(ti.qty * ti.price), 0) AS revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN products p ON p.id = ti.product_id
        WHERE t.status = 'Selesai'
        GROUP BY p.category
        ORDER BY revenue DESC
    `),
    query(pool, `
      SELECT DATE_FORMAT(date, '%Y-%m') AS month, COUNT(*) AS n,
          COALESCE(SUM(total), 0) AS revenue
        FROM transactions WHERE status = 'Selesai'
        GROUP BY month ORDER BY month
    `),
    query(pool, `
      SELECT HOUR(date) AS hour, COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue
        FROM transactions WHERE status = 'Selesai'
        GROUP BY hour ORDER BY hour
    `),
    query(pool, `
      SELECT DAYOFWEEK(date) AS day, COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue
        FROM transactions WHERE status = 'Selesai'
        GROUP BY day ORDER BY day
    `),
    query(pool, `
      SELECT COUNT(*) AS products, COALESCE(SUM(stock), 0) AS totalStock,
          COALESCE(SUM(price * stock), 0) AS inventoryValue,
          SUM(stock = 0) AS outOfStock,
          SUM(stock > 0 AND stock <= 5) AS low5,
          SUM(stock > 0 AND stock <= 10) AS low10
        FROM products
    `),
    query(pool, `
      SELECT 'd30' AS p, COUNT(*) AS n FROM products p WHERE NOT EXISTS (
        SELECT 1 FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.product_id = p.id AND t.status = 'Selesai' AND t.date >= ?
      )
      UNION ALL
      SELECT 'd90', COUNT(*) FROM products p WHERE NOT EXISTS (
        SELECT 1 FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.product_id = p.id AND t.status = 'Selesai' AND t.date >= ?
      )
    `, [d30Start, d90Start]),
    query(pool, `
      SELECT p.id AS sku, p.name, p.category, p.price, p.stock,
          COALESCE(s.sold30, 0) AS sold30, s.lastSold AS lastSold
        FROM products p
        LEFT JOIN (
          SELECT ti.product_id AS pid, SUM(ti.qty) AS sold30, MAX(t.date) AS lastSold
            FROM transaction_items ti
            JOIN transactions t ON t.id = ti.transaction_id
            WHERE t.status = 'Selesai' AND t.date >= ?
            GROUP BY ti.product_id
        ) s ON s.pid = p.id
        ORDER BY sold30 ASC, p.id ASC
        LIMIT 10
    `, [d30Start]),
  ]);

  const windows = {
    all: { ...buildWindow(windowRows, "all"), items: 0 },
    d30: { ...buildWindow(windowRows, "d30"), items: 0 },
    d7: { ...buildWindow(windowRows, "d7"), items: 0 },
    d30prev: buildWindow(windowRows, "d30prev"),
    d7prev: buildWindow(windowRows, "d7prev"),
  };
  for (const row of itemWindowRows) {
    if (windows[row.p]) windows[row.p].items = num(row.items);
  }
  for (const key of ["all", "d30", "d7"]) {
    const w = windows[key];
    w.avgItems = w.transactions ? w.items / w.transactions : 0;
  }

  const revenueDone = num(range.revDone);
  const categories = categoryRows.map((row) => ({
    category: row.category,
    itemRows: num(row.itemRows),
    items: num(row.items),
    revenue: num(row.revenue),
    share: revenueDone ? (num(row.revenue) / revenueDone) * 100 : 0,
  }));

  const stock = stockRows[0] || {};
  const unsold = {};
  for (const row of unsoldRows) unsold[row.p] = num(row.n);

  const monthly = monthlyRows.map((row) => ({
    month: row.month,
    transactions: num(row.n),
    revenue: num(row.revenue),
    avgBasket: num(row.n) ? num(row.revenue) / num(row.n) : 0,
  }));
  // Bulan pertama dan terakhir data bersifat parsial (data mulai 15 Nov 2025
  // dan berakhir 14 Nov 2026); bulan penuh adalah bulan di antaranya.
  const fullMonths = monthly.length > 2 ? monthly.slice(1, -1) : monthly;
  const bestMonth = fullMonths.reduce(
    (best, row) => (row.revenue > (best ? best.revenue : -1) ? row : best), null);
  const worstMonth = fullMonths.reduce(
    (worst, row) => (row.revenue < (worst ? worst.revenue : Infinity) ? row : worst), null);
  const lastFull = fullMonths.length ? fullMonths[fullMonths.length - 1] : null;
  const prevFull = fullMonths.length > 1 ? fullMonths[fullMonths.length - 2] : null;

  const hourlyByHour = new Map(hourlyRows.map((row) => [num(row.hour), row]));
  const hourly = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const row = hourlyByHour.get(hour);
    hourly.push({
      hour,
      transactions: row ? num(row.n) : 0,
      revenue: row ? num(row.revenue) : 0,
    });
  }
  const peakHourByTx = hourly.reduce(
    (best, row) => (row.transactions > (best ? best.transactions : -1) ? row : best), null);
  const peakHourByRevenue = hourly.reduce(
    (best, row) => (row.revenue > (best ? best.revenue : -1) ? row : best), null);

  const weekdayByDay = new Map(weekdayRows.map((row) => [num(row.day), row]));
  const weekday = [];
  for (let day = 1; day <= 7; day += 1) {
    const row = weekdayByDay.get(day);
    weekday.push({
      day,
      name: WEEKDAY_NAMES[day - 1],
      transactions: row ? num(row.n) : 0,
      revenue: row ? num(row.revenue) : 0,
    });
  }
  const peakDay = weekday.reduce(
    (best, row) => (row.transactions > (best ? best.transactions : -1) ? row : best), null);

  const mapTop = (rows) => rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: num(row.price),
    sold: num(row.sold),
    revenue: num(row.revenue),
  }));

  const slowest30 = slowestRows.map((row) => ({
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: num(row.price),
    stock: num(row.stock),
    sold30: num(row.sold30),
    lastSold: row.lastSold ? toDateOnly(row.lastSold) : null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    range: {
      firstTx: firstDate,
      lastTx: lastDate,
      days: firstDate && lastDate
        ? Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000) + 1
        : 0,
    },
    totals: {
      transactions: num(range.nAll),
      done: num(range.nDone),
      cancelled: num(range.nCancel),
      revenueDone,
      revenueAll: num(range.revAll),
      avgBasketDone: windows.all.avgBasket,
      itemsDone: windows.all.items,
      avgItemsDone: windows.all.avgItems,
    },
    windows,
    growth: {
      revenue30: growthPct(windows.d30.revenue, windows.d30prev.revenue),
      transactions30: growthPct(windows.d30.transactions, windows.d30prev.transactions),
      revenue7: growthPct(windows.d7.revenue, windows.d7prev.revenue),
      transactions7: growthPct(windows.d7.transactions, windows.d7prev.transactions),
      revenueLastFullMonth: lastFull && prevFull
        ? growthPct(lastFull.revenue, prevFull.revenue) : null,
    },
    topByQty: mapTop(topByQtyRows),
    topByRevenue: mapTop(topByRevenueRows),
    categories,
    monthly,
    hourly,
    weekday,
    stock: {
      products: num(stock.products),
      totalStock: num(stock.totalStock),
      inventoryValue: num(stock.inventoryValue),
      outOfStock: num(stock.outOfStock),
      low5: num(stock.low5),
      low10: num(stock.low10),
    },
    unsold: { d30: unsold.d30 || 0, d90: unsold.d90 || 0 },
    slowest30,
    peak: {
      hourByTransactions: peakHourByTx ? peakHourByTx.hour : null,
      hourByRevenue: peakHourByRevenue ? peakHourByRevenue.hour : null,
      dayByTransactions: peakDay ? peakDay.day : null,
      bestMonth: bestMonth ? bestMonth.month : null,
      worstMonth: worstMonth ? worstMonth.month : null,
    },
    cashier: null,
    notes: [
      "Data contoh (seed) 12 bulan, bukan penjualan toko sungguhan.",
      "Pendapatan hanya menghitung transaksi berstatus Selesai.",
    ],
  };
}

async function getCachedAnalytics(pool) {
  const now = Date.now();
  if (cachedAnalytics && now - cachedAt < ANALYTICS_TTL_MS) return cachedAnalytics;
  if (warmingUp) return warmingUp;
  warmingUp = getAnalytics(pool).then((data) => {
    cachedAnalytics = data;
    cachedAt = Date.now();
    warmingUp = null;
    return data;
  }).catch((error) => {
    warmingUp = null;
    throw error;
  });
  return warmingUp;
}

function warmupAnalytics(pool) {
  getCachedAnalytics(pool).catch(() => {});
}

function clearAnalyticsCache() {
  cachedAnalytics = null;
  cachedAt = 0;
}

// ---- Agregasi untuk ekspor CSV (memakai definisi yang sama) ----

async function getDailySales(pool) {
  const [txRows, itemRows] = await Promise.all([
    query(pool, `
      SELECT DATE_FORMAT(date, '%Y-%m-%d') AS d, COUNT(*) AS n,
          COALESCE(SUM(total), 0) AS revenue
        FROM transactions WHERE status = 'Selesai'
        GROUP BY d ORDER BY d
    `),
    query(pool, `
      SELECT DATE_FORMAT(t.date, '%Y-%m-%d') AS d, COALESCE(SUM(ti.qty), 0) AS items
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'Selesai'
        GROUP BY d ORDER BY d
    `),
  ]);
  const itemsByDate = new Map(itemRows.map((row) => [row.d, num(row.items)]));
  return txRows.map((row) => ({
    date: row.d,
    transactions: num(row.n),
    revenue: num(row.revenue),
    items: itemsByDate.get(row.d) || 0,
  }));
}

async function getMonthlySales(pool) {
  const [txRows, itemRows] = await Promise.all([
    query(pool, `
      SELECT DATE_FORMAT(date, '%Y-%m') AS m, COUNT(*) AS n,
          COALESCE(SUM(total), 0) AS revenue
        FROM transactions WHERE status = 'Selesai'
        GROUP BY m ORDER BY m
    `),
    query(pool, `
      SELECT DATE_FORMAT(t.date, '%Y-%m') AS m, COALESCE(SUM(ti.qty), 0) AS items
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'Selesai'
        GROUP BY m ORDER BY m
    `),
  ]);
  const itemsByMonth = new Map(itemRows.map((row) => [row.m, num(row.items)]));
  return txRows.map((row) => ({
    month: row.m,
    transactions: num(row.n),
    revenue: num(row.revenue),
    items: itemsByMonth.get(row.m) || 0,
    avgBasket: num(row.n) ? num(row.revenue) / num(row.n) : 0,
  }));
}

async function getProductPerformance(pool) {
  const rows = await query(pool, `
    SELECT p.id AS sku, p.name, p.category, p.price, p.stock,
        COALESCE(s.sold, 0) AS sold, COALESCE(s.revenue, 0) AS revenue
      FROM products p
      LEFT JOIN (
        SELECT ti.product_id AS pid, SUM(ti.qty) AS sold, SUM(ti.qty * ti.price) AS revenue
          FROM transaction_items ti
          JOIN transactions t ON t.id = ti.transaction_id
          WHERE t.status = 'Selesai'
          GROUP BY ti.product_id
      ) s ON s.pid = p.id
      ORDER BY sold DESC, p.id ASC
  `);
  return rows.map((row) => ({
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: num(row.price),
    stock: num(row.stock),
    sold: num(row.sold),
    revenue: num(row.revenue),
  }));
}

async function getCategoryStats(pool) {
  const rows = await query(pool, `
    SELECT p.category, COUNT(DISTINCT t.id) AS nTx, COALESCE(SUM(ti.qty), 0) AS items,
        COALESCE(SUM(ti.qty * ti.price), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      JOIN products p ON p.id = ti.product_id
      WHERE t.status = 'Selesai'
      GROUP BY p.category
      ORDER BY revenue DESC
  `);
  const total = rows.reduce((sum, row) => sum + num(row.revenue), 0);
  return rows.map((row) => ({
    category: row.category,
    transactions: num(row.nTx),
    revenue: num(row.revenue),
    share: total ? (num(row.revenue) / total) * 100 : 0,
  }));
}

async function getHourlySales(pool) {
  const rows = await query(pool, `
    SELECT HOUR(date) AS hour, COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue
      FROM transactions WHERE status = 'Selesai'
      GROUP BY hour ORDER BY hour
  `);
  const byHour = new Map(rows.map((row) => [num(row.hour), row]));
  const out = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const row = byHour.get(hour);
    out.push({
      hour,
      transactions: row ? num(row.n) : 0,
      revenue: row ? num(row.revenue) : 0,
    });
  }
  return out;
}

async function getProductList(pool) {
  const rows = await query(pool, `
    SELECT id AS sku, name, category, price, stock FROM products ORDER BY id
  `);
  return rows.map((row) => ({
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: num(row.price),
    stock: num(row.stock),
  }));
}

async function getSampleTransactions(pool, limit) {
  const rows = await query(pool, `
    SELECT DATE_FORMAT(t.date, '%Y-%m-%d %H:%i:%s') AS date,
        (SELECT SUM(qty) FROM transaction_items WHERE transaction_id = t.id) AS items,
        t.total AS total
      FROM transactions t
      WHERE t.status = 'Selesai' AND MOD(CRC32(t.id), 100) = 0
      ORDER BY t.date
      LIMIT ?
  `, [limit || 10000]);
  return rows.map((row) => ({
    date: row.date,
    items: num(row.items),
    total: num(row.total),
  }));
}

module.exports = {
  getAnalytics,
  getCachedAnalytics,
  warmupAnalytics,
  clearAnalyticsCache,
  getDailySales,
  getMonthlySales,
  getProductPerformance,
  getCategoryStats,
  getHourlySales,
  getProductList,
  getSampleTransactions,
  ANALYTICS_TTL_MS,
};
