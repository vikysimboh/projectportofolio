let state = { products: [], transactions: [], stats: null, user: null };
let users = [];
let reportData = null;
let activePage = "dashboard";
let cart = [];
let posCategory = "Semua";
let productFilter = "";
let transactionFilter = "";
let selectedPeriod = "7";
let reportStart = "";
let reportEnd = "";
let productCategoryFilter = "Semua";
let navToken = 0;
let refreshPromise = null;
let listToken = 0;
let dashboardLowStock = null;
let dashboardRecent = null;
let productsPage = { page: 1, limit: 20, total: 0, totalPages: 1 };
let transactionsPage = { page: 1, limit: 20, total: 0, totalPages: 1 };
let transactionStatusFilter = "Semua status";
let reportPeriod = "30";

function isAdmin() {
  return Boolean(state.user && state.user.role === "admin");
}
function dashboardDailyData() {
  const stats = state.stats || { salesByDay: [] };
  return stats.salesByDay.map((day) => ({ date: `${day.date}T12:00:00`, total: Number(day.total || 0) }));
}

function reportDailyData() {
  const daily = (reportData && reportData.dailySales) || [];
  return daily.map((day) => ({ date: `${day.date}T12:00:00`, total: Number(day.total || 0) }));
}
function applyRoleVisibility() {
  const admin = isAdmin();
  document.querySelectorAll(".nav-link").forEach((link) => {
    const page = link.dataset.page;
    if (page === "pengguna" || page === "dashboard" || page === "produk" || page === "laporan") link.style.display = admin ? "" : "none";
    else link.style.display = "";
  });
  const name = document.querySelector("#profileName");
  const role = document.querySelector("#profileRole");
  const avatar = document.querySelector("#profileAvatar");
  if (name) name.textContent = state.user ? state.user.username : "Admin TokoPintar";
  if (role) role.textContent = state.user ? (state.user.role === "admin" ? "Administrator" : "Kasir") : "Administrator";
  if (avatar) avatar.textContent = state.user ? state.user.username.slice(0, 2).toUpperCase() : "AK";
}

const content = document.querySelector("#pageContent");
const modalLayer = document.querySelector("#modalLayer");
const money = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const dateFormat = (value, options = { day: "2-digit", month: "short", year: "numeric" }) => new Intl.DateTimeFormat("id-ID", options).format(new Date(value));
const shortDate = (value) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(value);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const API_BASE = (window.location.hostname.endsWith("github.io") || window.location.hostname === "vikysimbohportofolio.my.id") ? "https://projectportofolio-production.up.railway.app" : "";
async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      credentials: "include",
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
  } catch (error) {
    throw new Error("Backend tidak dapat dihubungi. Pastikan server TokoPintar sedang berjalan.");
  }
  const result = await response.json().catch(() => ({}));
  // Sesi habis: kembali ke halaman landing (form login ada di sana).
  if (response.status === 401) window.location.assign(window.location.origin + window.location.pathname.replace(/app\.html$/, ""));
  if (!response.ok) throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  return result;
}

// Logout lintas situs: tombol "Keluar" (#logoutButton) memanggil logout ke
// backend lewat API_BASE, lalu kembali ke halaman landing (form login ada
// di landing, bukan di halaman login terpisah).
const landingUrl = () => window.location.origin + window.location.pathname.replace(/app\.html$/, "");
const logoutButton = document.querySelector("#logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await fetch(API_BASE + "/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      // Tetap arahkan ke halaman landing walau panggilan logout gagal.
    }
    window.location.assign(landingUrl());
  });
}

async function refreshState() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = apiRequest("/api/state?summary=1").then((summary) => {
    state = { ...state, stats: summary.stats, user: summary.user || state.user };
    return state;
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function productParams(page) {
  const params = new URLSearchParams({ page: String(page), limit: String(productsPage.limit) });
  if (productFilter) params.set("search", productFilter);
  if (productCategoryFilter && productCategoryFilter !== "Semua") params.set("category", productCategoryFilter);
  return params;
}

async function loadProductsPage(page) {
  const token = ++listToken;
  const data = await apiRequest("/api/products?" + productParams(page).toString());
  if (token !== listToken) return null;
  const pageProducts = Array.isArray(data.products) ? data.products : []; const pageTotal = Number(data.total) || pageProducts.length; const pageLimit = Number(data.limit) || productsPage.limit || 20; const pageTotalPages = Number(data.totalPages) || Math.max(Math.ceil(pageTotal / pageLimit), 1); productsPage = { page: Math.min(Number(data.page) || 1, pageTotalPages), limit: pageLimit, total: pageTotal, totalPages: pageTotalPages };
  state = { ...state, products: pageProducts };
  return data;
}

async function loadTransactionsPage(page) {
  const token = ++listToken;
  const params = new URLSearchParams({ limit: String(transactionsPage.limit), offset: String((page - 1) * transactionsPage.limit) });
  if (transactionFilter) params.set("search", transactionFilter);
  if (transactionStatusFilter && transactionStatusFilter !== "Semua status") params.set("status", transactionStatusFilter);
  const data = await apiRequest("/api/transactions?" + params.toString());
  if (token !== listToken) return null;
  const totalPages = Math.max(Math.ceil(data.total / data.limit), 1);
  if (page > totalPages) return loadTransactionsPage(totalPages);
  transactionsPage = { page, limit: data.limit, total: data.total, totalPages };
  state = { ...state, transactions: data.transactions };
  return data;
}

async function loadPosProducts() {
  const token = ++listToken;
  const params = new URLSearchParams({ limit: "120" });
  if (posCategory && posCategory !== "Semua") params.set("category", posCategory);
  if (productFilter) params.set("search", productFilter);
  const data = await apiRequest("/api/products?" + params.toString());
  if (token !== listToken) return null;
  state = { ...state, products: data.products };
  return data;
}

async function loadDashboardLists() {
  const [lowStockData, recentData] = await Promise.all([
    apiRequest("/api/products?maxStock=5&limit=200"),
    apiRequest("/api/transactions?limit=8&offset=0")
  ]);
  dashboardLowStock = lowStockData.products;
  dashboardRecent = recentData.transactions;
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.querySelector("#toastRegion").append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">TokoPintar / ${escapeHTML(title)}</div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function transactionsForDays(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(days) - 1));
  return state.transactions.filter((transaction) => transaction.status === "Selesai" && new Date(transaction.date) >= start);
}

function renderDashboard() {
      const stats = state.stats || { totalProducts: 0, totalTransactions: 0, totalRevenue: 0, transactionsToday: 0, revenueToday: 0, lowStockCount: 0, salesByDay: [] };
    const days = Number(selectedPeriod);
    const periodStart = new Date();
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (days - 1));
    const priorStart = new Date(periodStart);
    priorStart.setDate(priorStart.getDate() - days);
    const dayDate = (day) => new Date(`${day.date}T00:00:00`);
    const periodDays = stats.salesByDay.filter((day) => dayDate(day) >= periodStart);
    const priorDays = stats.salesByDay.filter((day) => dayDate(day) >= priorStart && dayDate(day) < periodStart);
    const periodRevenue = periodDays.reduce((sum, day) => sum + Number(day.total || 0), 0);
    const periodCount = periodDays.reduce((sum, day) => sum + Number(day.count || 0), 0);
    const priorRevenue = priorDays.reduce((sum, day) => sum + Number(day.total || 0), 0);
    const growth = priorRevenue ? Math.round((periodRevenue - priorRevenue) / priorRevenue * 100) : (periodRevenue ? 100 : 0);
    const todayRevenue = Number(stats.revenueToday || 0);
    const todayCount = Number(stats.transactionsToday || 0);
    const todayTransactions = transactionsForDays(1);
    const todayItems = typeof stats.itemsToday === "number" ? stats.itemsToday : todayTransactions.reduce((sum, item) => sum + item.items.reduce((qty, line) => qty + line.qty, 0), 0);
    const inventoryValue = typeof stats.inventoryValue === "number" ? stats.inventoryValue : state.products.reduce((sum, product) => sum + product.price * product.stock, 0);
    const lowStock = dashboardLowStock !== null ? dashboardLowStock : state.products.filter((product) => product.stock <= 5);
    const recent = (dashboardRecent !== null ? dashboardRecent : [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date))).slice(0, 5);
  const options = `<select class="select-control" id="dashboardPeriod" aria-label="Periode dashboard"><option value="7" ${selectedPeriod === "7" ? "selected" : ""}>7 hari terakhir</option><option value="30" ${selectedPeriod === "30" ? "selected" : ""}>30 hari terakhir</option></select><button class="button primary" data-action="go-pos"><svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Transaksi baru</button>`;
  content.innerHTML = `${heading("Dashboard", "Pantau performa tokomu hari ini.", options)}
    <section class="stats-grid">
      ${statCard("Total penjualan", money(periodRevenue), `${growth >= 0 ? "↗" : "↘"} ${Math.abs(growth)}%`, `vs. ${selectedPeriod} hari sebelumnya`, "purple", chartLine([4, 8, 6, 12, 9, 17, 15]))}
      ${statCard("Total transaksi", periodCount, `${todayCount} transaksi`, "terjadi hari ini", "blue", chartLine([5, 6, 4, 9, 8, 13, 16]))}
      ${statCard("Rata-rata transaksi", money(periodCount ? periodRevenue / periodCount : 0), "Per transaksi", "dalam periode ini", "orange", chartLine([7, 5, 11, 8, 12, 10, 16]))}
      ${statCard("Nilai persediaan", money(inventoryValue), `${stats.totalProducts || state.products.length} produk`, "tersedia di tokomu", "green", chartLine([5, 11, 8, 13, 10, 15, 17]))}
    </section>
    <section class="panel analytics-panel" id="analyticsSection">
      <div class="panel-heading"><div><h2>Analisis & Insight</h2><p>Agregasi penjualan 12 bulan terakhir - data contoh (seed), bukan penjualan nyata.</p></div></div>
      <div class="analytics-loading">Memuat analisis...</div>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="panel-heading"><div><h2>Ringkasan penjualan</h2><p>Performa penjualan dalam ${selectedPeriod} hari terakhir</p></div><div class="chart-legend"><span class="legend-dot"></span>Penjualan</div></div>
        <div class="chart-wrap"><canvas id="salesChart" role="img" aria-label="Grafik penjualan harian"></canvas></div>
      </div>
      <div class="panel summary-panel">
        <div class="panel-heading"><div><h2>Ringkasan hari ini</h2><p>${dateFormat(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><span class="stat-icon purple"><svg viewBox="0 0 24 24"><path d="M4 20V10m5 10V4m6 16v-7m5 7V7"/></svg></span></div>
        <p class="summary-caption">Total penjualan</p><p class="summary-total">${money(todayRevenue)}</p>
        <div class="summary-list"><div class="summary-row"><span>Transaksi selesai</span><strong>${todayCount} transaksi</strong></div><div class="summary-row"><span>Stok menipis</span><strong class="${lowStock.length ? "" : "good"}">${lowStock.length} produk</strong></div><div class="summary-row"><span>Produk terjual</span><strong>${todayItems} item</strong></div></div>
        <div class="progress-track" aria-label="Persediaan sehat"><span style="width:${state.products.length ? Math.max(4, Math.round((state.products.filter((item) => item.stock >= 5).length / state.products.length) * 100)) : 0}%"></span></div>
      </div>
    </section>
    <section class="panel table-panel">
      <div class="panel-heading table-head"><div class="table-title-wrap"><h2>Transaksi terbaru</h2><span class="count-pill">${stats.totalTransactions} transaksi</span></div><button class="text-link" data-action="navigate" data-page="transaksi">Lihat semua →</button></div>
      ${renderTransactionTable(recent, false)}
    </section>
    ${lowStock.length ? `<section class="panel table-panel" style="margin-top:17px"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>Perlu restock</h2><span class="count-pill">${lowStock.length} produk</span></div><button class="text-link" data-action="navigate" data-page="produk">Kelola produk →</button></div><div class="table-scroll"><table><thead><tr><th>PRODUK</th><th>KATEGORI</th><th>STOK TERSISA</th><th>HARGA</th></tr></thead><tbody>${lowStock.map((item) => `<tr><td><strong>${escapeHTML(item.emoji)} &nbsp;${escapeHTML(item.name)}</strong></td><td>${escapeHTML(item.category)}</td><td><span class="status pending">${item.stock} tersisa</span></td><td><strong>${money(item.price)}</strong></td></tr>`).join("")}</tbody></table></div></section>` : ""}`;
  drawSalesChart(dashboardDailyData(), Number(selectedPeriod));
    loadAnalytics();
}

let analyticsCache = null;
let analyticsCacheAt = 0;
let chartJsPromise = null;
let analyticsCharts = [];

function ensureChartJs() {
  if (window.Chart) return Promise.resolve(true);
  if (chartJsPromise) return chartJsPromise;
  chartJsPromise = new Promise(function (resolve) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    script.onload = function () { resolve(!!window.Chart); };
    script.onerror = function () { resolve(false); };
    document.head.appendChild(script);
  });
  return chartJsPromise;
}

function analyticsPct(value) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2).replace(".", ",") + "%";
}

function analyticsNum(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function analyticsArrow(value) {
  if (value === null || value === undefined) return "—";
  const arrow = value >= 0 ? "▲ " : "▼ ";
  return arrow + Math.abs(value).toFixed(2).replace(".", ",") + "%";
}

async function loadAnalytics() {
  const token = navToken;
  const section = document.getElementById("analyticsSection");
  if (!section || !isAdmin()) return;
  const now = Date.now();
  if (analyticsCache && now - analyticsCacheAt < 5 * 60 * 1000) {
    renderAnalytics(section, analyticsCache);
    return;
  }
  try {
    const data = await apiRequest("/api/analytics");
    if (token !== navToken) return;
    analyticsCache = data;
    analyticsCacheAt = now;
    renderAnalytics(section, data);
  } catch (error) {
    if (token !== navToken) return;
    section.innerHTML = '<div class="panel-heading"><div><h2>Analisis & Insight</h2><p>Agregasi penjualan 12 bulan terakhir - data contoh (seed), bukan penjualan nyata.</p></div></div>' +
      '<div class="analytics-error">Gagal memuat analisis. Silakan muat ulang halaman.</div>';
  }
}

function renderAnalytics(section, data) {
  const t = data.totals || {};
  const w = data.windows || {};
  const d30 = w.d30 || {};
  const g = data.growth || {};
  const stock = data.stock || {};
  const unsold = data.unsold || {};
  const topByQty = data.topByQty || [];
  const slowest30 = data.slowest30 || [];
  const range = data.range || {};
  const firstTx = String(range.firstTx || "").slice(0, 10);
  const lastTx = String(range.lastTx || "").slice(0, 10);
  const avgItems = t.avgItemsDone ? Number(t.avgItemsDone).toFixed(2).replace(".", ",") : "0,00";
  const avgItems30 = d30.avgItems ? Number(d30.avgItems).toFixed(2).replace(".", ",") : "0,00";
  const kpi = '<div class="stats-grid">' +
    statCard("Pertumbuhan penjualan 30 hari", analyticsPct(g.revenue30), analyticsArrow(g.revenue30), "vs 30 hari sebelumnya", "purple", "") +
    statCard("Rata-rata belanja / transaksi", money(t.avgBasketDone || 0), analyticsArrow(g.revenue7), "30 hari terakhir: " + money(d30.avgBasket || 0), "blue", "") +
    statCard("Rata-rata item / transaksi", avgItems + " item", "—", "30 hari terakhir: " + avgItems30 + " item", "green", "") +
    statCard("Produk stok menipis", analyticsNum(stock.low5) + " produk", "—", analyticsNum(stock.outOfStock) + " produk stok habis", "orange", "") +
    '</div>';
  const charts = '<div class="analytics-charts">' +
    '<div class="panel analytics-chart-panel analytics-chart-wide"><div class="panel-heading"><div><h3>Tren penjualan bulanan</h3><p>Pendapatan per bulan (status Selesai)</p></div></div><div class="analytics-chart-wrap"><canvas id="analyticsMonthlyChart"></canvas></div></div>' +
    '<div class="panel analytics-chart-panel"><div class="panel-heading"><div><h3>Pendapatan per kategori</h3><p>Pangsa tiap kategori dari total pendapatan</p></div></div><div class="analytics-chart-wrap"><canvas id="analyticsCategoryChart"></canvas></div></div>' +
    '<div class="panel analytics-chart-panel"><div class="panel-heading"><div><h3>Jam tersibuk</h3><p>Jumlah transaksi per jam (00–23)</p></div></div><div class="analytics-chart-wrap"><canvas id="analyticsHourlyChart"></canvas></div></div>' +
    '</div>';
  const topRows = analyticsTopRows(topByQty);
  const slowRows = analyticsSlowRows(slowest30);
  const tables = '<div class="analytics-tables">' +
    '<section class="panel table-panel"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>10 produk terlaris</h2><span class="count-pill">berdasarkan jumlah terjual</span></div></div><div class="table-wrap"><table class="analytics-table"><thead><tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Terjual</th><th>Pendapatan</th></tr></thead><tbody>' + topRows + '</tbody></table></div></section>' +
    '<section class="panel table-panel"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>Produk paling lambat terjual (30 hari)</h2><span class="count-pill">' + analyticsNum(unsold.d30) + ' produk tidak terjual</span></div></div><p class="analytics-note">Semua produk masih terjual dalam 30 hari terakhir; di bawah ini 10 produk dengan penjualan 30 hari paling sedikit.</p><div class="table-wrap"><table class="analytics-table"><thead><tr><th>Produk</th><th>SKU</th><th>Stok</th><th>Terjual 30 hari</th><th>Terakhir terjual</th></tr></thead><tbody>' + slowRows + '</tbody></table></div></section>' +
    '</div>';
  const insights = analyticsInsights(data);
  const insightHtml = '<section class="panel analytics-insight"><div class="panel-heading"><div><h2>Insight Bisnis</h2><p>Temuan otomatis dari angka-angka di atas</p></div></div><ul class="analytics-insight-list">' + insights + '</ul><p class="analytics-foot">Periode data: ' + firstTx + ' s.d. ' + lastTx + ' (data contoh / seed 12 bulan, bukan penjualan toko sungguhan). Pendapatan hanya menghitung transaksi berstatus Selesai.</p></section>';
  section.innerHTML = '<div class="panel-heading"><div><h2>Analisis & Insight</h2><p>Agregasi penjualan 12 bulan terakhir - data contoh (seed), bukan penjualan nyata.</p></div></div>' + kpi + charts + tables + insightHtml;
  drawAnalyticsCharts(data);
}

function analyticsTopRows(list) {
  if (!list || !list.length) return '<tr><td colspan="5">Belum ada data.</td></tr>';
  let rows = "";
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    rows += '<tr><td>' + item.name + '</td><td>' + item.sku + '</td><td>' + item.category + '</td><td>' + analyticsNum(item.sold) + '</td><td>' + money(item.revenue) + '</td></tr>';
  }
  return rows;
}

function analyticsSlowRows(list) {
  if (!list || !list.length) return '<tr><td colspan="5">Belum ada data.</td></tr>';
  let rows = "";
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const last = item.lastSold ? String(item.lastSold).slice(0, 10) : "—";
    rows += '<tr><td>' + item.name + '</td><td>' + item.sku + '</td><td>' + analyticsNum(item.stock) + '</td><td>' + analyticsNum(item.sold30) + '</td><td>' + last + '</td></tr>';
  }
  return rows;
}

function analyticsInsights(data) {
  const items = [];
  const g = data.growth || {};
  const stock = data.stock || {};
  const unsold = data.unsold || {};
  const peak = data.peak || {};
  const categories = data.categories || [];
  const topByQty = data.topByQty || [];
  const monthly = data.monthly || [];
  const weekday = data.weekday || [];
  if (g.revenue30 !== null && g.revenue30 !== undefined) {
    if (g.revenue30 < 0) {
      items.push("Penjualan 30 hari terakhir turun " + analyticsPct(g.revenue30) + " dibanding 30 hari sebelumnya. Periksa stok produk terlaris dan pertimbangkan promosi untuk mengembalikan penjualan.");
    } else {
      items.push("Penjualan 30 hari terakhir naik " + analyticsPct(g.revenue30) + " dibanding 30 hari sebelumnya.");
    }
  }
  let bestCat = null;
  for (let i = 0; i < categories.length; i++) {
    if (!bestCat || categories[i].revenue > bestCat.revenue) bestCat = categories[i];
  }
  if (bestCat) {
    items.push("Kategori terkuat adalah " + bestCat.category + " dengan pangsa " + Number(bestCat.share).toFixed(2).replace(".", ",") + "% dari total pendapatan (" + money(bestCat.revenue) + ").");
  }
  if (topByQty.length) {
    const top = topByQty[0];
    items.push("Produk terlaris adalah " + top.name + " (" + top.sku + "): " + analyticsNum(top.sold) + " unit terjual dengan pendapatan " + money(top.revenue) + ".");
  }
  if (peak.hourByTransactions !== null && peak.hourByTransactions !== undefined) {
    items.push("Jam tersibuk adalah pukul " + String(peak.hourByTransactions).padStart(2, "0") + ".00 berdasarkan jumlah transaksi. Siapkan stok dan kasir lebih banyak di jam tersebut.");
  }
  if (weekday.length) {
    let bestDay = weekday[0];
    for (let i = 1; i < weekday.length; i++) {
      if (weekday[i].transactions > bestDay.transactions) bestDay = weekday[i];
    }
    items.push("Hari tersibuk adalah " + bestDay.name + " dengan " + analyticsNum(bestDay.transactions) + " transaksi.");
  }
  items.push("Ada " + analyticsNum(stock.low5) + " produk dengan stok menipis (1–5 unit) dan " + analyticsNum(stock.outOfStock) + " produk stok habis. Segera restock produk stok menipis agar tidak kehilangan penjualan.");
  if (unsold.d30 === 0) {
    items.push("Tidak ada produk yang tidak terjual dalam 30 hari terakhir — semua 1.000 produk masih laku. Fokuskan promosi pada 10 produk paling lambat terjual di atas.");
  }
  if (monthly.length > 2) {
    const full = monthly.slice(1, -1);
    if (full.length) {
      let bestM = full[0];
      let worstM = full[0];
      for (let i = 1; i < full.length; i++) {
        if (full[i].revenue > bestM.revenue) bestM = full[i];
        if (full[i].revenue < worstM.revenue) worstM = full[i];
      }
      items.push("Bulan penuh terbaik adalah " + bestM.month + " (" + money(bestM.revenue) + "), sedangkan bulan penuh terlemah adalah " + worstM.month + " (" + money(worstM.revenue) + ").");
    }
  }
  let html = "";
  for (let i = 0; i < items.length; i++) {
    html += "<li>" + items[i] + "</li>";
  }
  return html;
}

function drawAnalyticsCharts(data) {
  const monthly = data.monthly || [];
  const categories = data.categories || [];
  const hourly = data.hourly || [];
  ensureChartJs().then(function (ok) {
    if (!ok || !window.Chart) {
      const wraps = document.querySelectorAll(".analytics-chart-wrap");
      for (let i = 0; i < wraps.length; i++) {
        wraps[i].innerHTML = '<div class="analytics-error">Grafik tidak dapat dimuat (pustaka Chart.js tidak tersedia).</div>';
      }
      return;
    }
    for (let i = 0; i < analyticsCharts.length; i++) {
      try { analyticsCharts[i].destroy(); } catch (e) {}
    }
    analyticsCharts = [];
    const gridColor = "rgba(148, 163, 184, 0.18)";
    const tickColor = "#9aa0b0";
    const monthlyEl = document.getElementById("analyticsMonthlyChart");
    if (monthlyEl) {
      analyticsCharts.push(new Chart(monthlyEl, {
        type: "line",
        data: {
          labels: monthly.map(function (row) { return row.month; }),
          datasets: [{ label: "Pendapatan (Rp)", data: monthly.map(function (row) { return row.revenue; }), borderColor: "#a89df7", backgroundColor: "rgba(168, 157, 247, 0.15)", fill: true, tension: 0.3, pointRadius: 3 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function (ctx) { return " " + money(ctx.parsed.y); } } }
          },
          scales: {
            x: { ticks: { color: tickColor }, grid: { color: gridColor } },
            y: { ticks: { color: tickColor, callback: function (v) { return "Rp" + (v / 1000000000).toFixed(1).replace(".", ",") + " M"; } }, grid: { color: gridColor } }
          }
        }
      }));
    }
    const catEl = document.getElementById("analyticsCategoryChart");
    if (catEl) {
      analyticsCharts.push(new Chart(catEl, {
        type: "doughnut",
        data: {
          labels: categories.map(function (row) { return row.category; }),
          datasets: [{ data: categories.map(function (row) { return row.revenue; }), backgroundColor: ["#a89df7", "#7dd3fc", "#fbbf24"], borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { color: tickColor } },
            tooltip: { callbacks: { label: function (ctx) { return " " + ctx.label + ": " + money(ctx.parsed); } } }
          }
        }
      }));
    }
    const hourEl = document.getElementById("analyticsHourlyChart");
    if (hourEl) {
      analyticsCharts.push(new Chart(hourEl, {
        type: "bar",
        data: {
          labels: hourly.map(function (row) { return String(row.hour).padStart(2, "0"); }),
          datasets: [{ label: "Transaksi", data: hourly.map(function (row) { return row.transactions; }), backgroundColor: "#a89df7", borderRadius: 4 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function (ctx) { return " " + analyticsNum(ctx.parsed.y) + " transaksi"; } } }
          },
          scales: {
            x: { ticks: { color: tickColor }, grid: { color: gridColor } },
            y: { ticks: { color: tickColor }, grid: { color: gridColor } }
          }
        }
      }));
    }
  });
}
function chartLine(points) {
  return `<svg class="sparkline" viewBox="0 0 58 22" aria-hidden="true"><polyline points="${points.map((point, index) => `${index * 9},${20 - point}`).join(" ")}"/></svg>`;
}

function statCard(label, value, trend, foot, color, spark) {
  const down = trend.startsWith("↘");
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${statIcon(color)}</span></div><div class="stat-value">${escapeHTML(value)}</div><div class="stat-foot"><span class="trend${down ? " down" : ""}">${escapeHTML(trend)}</span><span>${escapeHTML(foot)}</span>${spark}</div></article>`;
}

function statIcon(color) {
  const icons = {
    purple: '<svg viewBox="0 0 24 24"><path d="M3 7h18v13H3zM7 7V4h10v3m-5 4v5m-2-2h4"/></svg>',
    blue: '<svg viewBox="0 0 24 24"><path d="M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-11 4h2m4 0h2m-8 3h2"/></svg>',
    orange: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-.7-1.5-1-2.7-1-1.4 0-2.3.7-2.3 1.7 0 2.7 5.2 1.2 5.2 4.2 0 1.1-1 2-2.7 2-1.2 0-2.2-.4-2.9-1.2M12 6.5v11"/></svg>',
    green: '<svg viewBox="0 0 24 24"><path d="M4 7h16v14H4zM8 7V4h8v3m-8 5h8m-8 4h5"/></svg>'
  };
  return icons[color];
}

function renderTransactionTable(transactions, clickable = true) {
  if (!transactions.length) return `<div class="empty-state"><strong>Belum ada transaksi</strong>Transaksi yang masuk akan tampil di sini.</div>`;
  return `<div class="table-scroll"><table><thead><tr><th>ID TRANSAKSI</th><th>PELANGGAN</th><th>TANGGAL</th><th>PEMBAYARAN</th><th>TOTAL</th><th>STATUS</th>${clickable ? "<th></th>" : ""}</tr></thead><tbody>${transactions.map((transaction) => {
    const initials = transaction.customer.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return `<tr ${clickable ? `data-action="transaction-detail" data-id="${escapeHTML(transaction.id)}" tabindex="0"` : ""}><td><strong>${escapeHTML(transaction.id)}</strong></td><td><div class="customer-cell"><span class="mini-avatar">${escapeHTML(initials || "UM")}</span><strong>${escapeHTML(transaction.customer)}</strong></div></td><td>${dateFormat(transaction.date, { day: "2-digit", month: "short", year: "numeric" })}</td><td>${escapeHTML(transaction.payment)}</td><td><strong>${money(transaction.total)}</strong></td><td><span class="status ${transaction.status === "Dibatalkan" ? "cancelled" : ""}">${escapeHTML(transaction.status)}</span></td>${clickable ? '<td><button class="text-link" aria-label="Lihat detail">•••</button></td>' : ""}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function drawSalesChart(transactions, days) {
  const canvas = document.querySelector("#salesChart");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 12, right: 8, bottom: 27, left: 43 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  // Plot one point per calendar day, not a multi-day bucket.
  const points = Array.from({ length: days }, (_, index) => {
    const startDaysAgo = days - 1 - index;
    const endDaysAgo = startDaysAgo;
     
     
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - startDaysAgo);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - endDaysAgo);
    const total = transactions.filter((item) => new Date(item.date) >= start && new Date(item.date) <= end).reduce((sum, item) => sum + item.total, 0);
    return { date: start, total };
  });
  const max = Math.max(50000, ...points.map((point) => point.total));
  context.font = "9px 'DM Sans', sans-serif";
  context.textBaseline = "middle";
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + plotHeight * index / 4;
    context.strokeStyle = "#f0f1f5";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillStyle = "#a3a6b3";
    context.textAlign = "left";
    context.fillText(index === 0 ? "Rp" + Math.round(max / 1000) + "k" : index === 4 ? "Rp0" : "Rp" + Math.round(max * (4 - index) / 4 / 1000) + "k", 0, y);
  }
  const coords = points.map((point, index) => ({ x: padding.left + plotWidth * (points.length === 1 ? .5 : index / (points.length - 1)), y: padding.top + plotHeight * (1 - point.total / max) }));
  context.beginPath();
  coords.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  if (coords.length) {
    context.lineTo(coords[coords.length - 1].x, padding.top + plotHeight);
    context.lineTo(coords[0].x, padding.top + plotHeight);
    context.closePath();
    const fill = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    fill.addColorStop(0, "#7669ea2e");
    fill.addColorStop(1, "#7669ea00");
    context.fillStyle = fill;
    context.fill();
    context.beginPath();
    coords.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = "#7164e8";
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  }
  coords.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.strokeStyle = "#7164e8";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#a3a6b3";
    context.textAlign = "center";
    if (days <= 7 || index % 5 === 0 || index === points.length - 1) context.fillText(shortDate(points[index].date), point.x, height - 11);
  });
}

function renderProducts() {
  const categories = ["Semua", "Makanan", "Minuman", "Snack", ...new Set(state.products.map((item) => item.category))].filter((value, index, list) => list.indexOf(value) === index);
  const filtered = state.products.filter((item) => {
    const matchesQuery = `${item.name} ${item.id} ${item.category}`.toLowerCase().includes(productFilter.toLowerCase());
    return matchesQuery && (productCategoryFilter === "Semua" || item.category === productCategoryFilter);
  });
  const actions = `<button class="button primary" data-action="add-product"><svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Tambah produk</button>`;
  content.innerHTML = `${heading("Produk", "Atur katalog, harga, dan stok tokomu.", actions)}
    <div class="toolbar"><label class="toolbar-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><input id="productSearch" value="${escapeHTML(productFilter)}" placeholder="Cari nama atau SKU produk..." /></label><div class="toolbar-spacer"></div><select class="select-control" id="productCategoryFilter">${categories.map((category) => `<option ${category === productCategoryFilter ? "selected" : ""}>${escapeHTML(category)}</option>`).join("")}</select></div>
    <section class="panel table-panel"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>Daftar produk</h2><span class="count-pill">${productsPage.total} produk</span></div><button class="button" data-action="export-products">Ekspor CSV</button></div>
    ${filtered.length ? `<div class="table-scroll"><table><thead><tr><th>PRODUK</th><th>SKU</th><th>KATEGORI</th><th>HARGA</th><th>STOK</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>${filtered.map((item) => `<tr><td><div class="customer-cell"><span class="mini-avatar" style="font-size:15px">${escapeHTML(item.emoji)}</span><strong>${escapeHTML(item.name)}</strong></div></td><td>${escapeHTML(item.id)}</td><td>${escapeHTML(item.category)}</td><td><strong>${money(item.price)}</strong></td><td>${item.stock} unit</td><td><span class="status ${item.stock === 0 ? "danger" : item.stock < 5 ? "pending" : ""}">${item.stock === 0 ? "Habis" : item.stock < 5 ? "Stok menipis" : "Tersedia"}</span></td><td><button class="text-link" data-action="edit-product" data-id="${escapeHTML(item.id)}">Edit</button><button class="text-link" style="margin-left:9px;color:#dc6969" data-action="delete-product" data-id="${escapeHTML(item.id)}">Hapus</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>Produk tidak ditemukan</strong>Coba kata kunci atau kategori yang berbeda.</div>`}
    <div class="table-footer"><span>Menampilkan ${state.products.length} dari ${productsPage.total} produk</span><div class="pagination"><button class="button small" data-action="products-prev" ${productsPage.page <= 1 ? "disabled" : ""}>Sebelumnya</button><button class="page-number active">${productsPage.page}</button><span>Halaman ${productsPage.page} dari ${productsPage.totalPages}</span><button class="button small" data-action="products-next" ${productsPage.page >= productsPage.totalPages ? "disabled" : ""}>Berikutnya</button></div></div></section>`;
}

function renderTransactions() {
  const filtered = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).filter((transaction) => `${transaction.id} ${transaction.customer} ${transaction.payment}`.toLowerCase().includes(transactionFilter.toLowerCase()));
  const actions = `<button class="button" data-action="export-transactions"><svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2"/></svg>Ekspor CSV</button><button class="button primary" data-action="go-pos"><svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Transaksi baru</button>`;
  content.innerHTML = `${heading("Transaksi", "Lihat dan kelola semua transaksi tokomu.", actions)}
    <div class="toolbar"><label class="toolbar-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><input id="transactionSearch" value="${escapeHTML(transactionFilter)}" placeholder="Cari ID atau nama pelanggan..." /></label><div class="toolbar-spacer"></div><select class="select-control" id="transactionStatus"><option>Semua status</option><option>Selesai</option><option>Dibatalkan</option></select></div>
    <section class="panel table-panel"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>Semua transaksi</h2><span class="count-pill">${transactionsPage.total} transaksi</span></div></div>${renderTransactionTable(filtered)}
    <div class="table-footer"><span>Menampilkan ${state.transactions.length} dari ${transactionsPage.total} transaksi</span><div class="pagination"><button class="button small" data-action="transactions-prev" ${transactionsPage.page <= 1 ? "disabled" : ""}>Sebelumnya</button><button class="page-number active">${transactionsPage.page}</button><span>Halaman ${transactionsPage.page} dari ${transactionsPage.totalPages}</span><button class="button small" data-action="transactions-next" ${transactionsPage.page >= transactionsPage.totalPages ? "disabled" : ""}>Berikutnya</button></div></div></section>`;
}

function renderPos() {
  const categories = ["Semua", "Makanan", "Minuman", "Snack", ...new Set(state.products.map((item) => item.category))].filter((value, index, list) => list.indexOf(value) === index);
  const products = state.products.filter((item) => (posCategory === "Semua" || item.category === posCategory) && `${item.name} ${item.id} ${item.category}`.toLowerCase().includes(productFilter.toLowerCase()));
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  content.innerHTML = `${heading("Kasir", "Pilih produk untuk memulai transaksi.", `<button class="button" data-action="clear-cart">Kosongkan keranjang</button>`)}
    <div class="pos-layout"><section><div class="pos-toolbar"><label class="toolbar-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><input id="posSearch" value="${escapeHTML(productFilter)}" placeholder="Cari produk..." /></label></div>
      <div class="category-tabs">${categories.map((category) => `<button class="category-tab ${posCategory === category ? "active" : ""}" data-action="pos-category" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join("")}</div>
      <div class="product-grid">${products.map((item, index) => `<button class="product-card" data-action="add-cart" data-id="${escapeHTML(item.id)}" ${item.stock <= 0 ? "disabled" : ""}><span class="product-art art-${index % 6}">${escapeHTML(item.emoji)}</span><strong>${escapeHTML(item.name)}</strong><small>Stok ${item.stock} · ${escapeHTML(item.category)}</small><span class="product-price">${money(item.price)}</span></button>`).join("") || `<div class="empty-state">Produk tidak ditemukan.</div>`}</div>
    </section><aside class="panel cart-panel"><div class="panel-heading"><div><h2>Keranjang</h2><p>${cartCount} item dipilih</p></div><span class="count-pill">${cart.length} produk</span></div>
      <div class="cart-customer"><label class="field-label" for="customerName">Nama pelanggan <span style="font-weight:400">(opsional)</span></label><input class="field-control" id="customerName" placeholder="Pelanggan umum" /></div>
      <div class="cart-items">${cart.length ? cart.map((line) => `<div class="cart-item"><div><div class="cart-item-name">${escapeHTML(line.name)}</div><div class="cart-item-price">${money(line.price)} · ${money(line.price * line.qty)}</div></div><div class="qty-control"><button data-action="cart-qty" data-id="${escapeHTML(line.productId)}" data-change="-1" aria-label="Kurangi">−</button><span>${line.qty}</span><button data-action="cart-qty" data-id="${escapeHTML(line.productId)}" data-change="1" aria-label="Tambah">+</button></div></div>`).join("") : `<div class="cart-empty"><div><span>🛍️</span>Keranjang masih kosong.<br>Pilih produk untuk memulai.</div></div>`}</div>
      <div class="cart-summary"><div class="cart-summary-row"><span>Subtotal (${cartCount} item)</span><strong>${money(subtotal)}</strong></div><div class="cart-summary-row"><span>Pajak</span><strong>Rp0</strong></div><div class="cart-summary-row total"><span>Total pembayaran</span><strong>${money(subtotal)}</strong></div></div>
      <div class="cart-customer"><label class="field-label" for="paymentMethod">Metode pembayaran</label><select class="field-control" id="paymentMethod"><option>Tunai</option><option>QRIS</option><option>Transfer</option><option>Kartu debit</option></select></div>
      <button class="button primary cart-checkout" data-action="checkout" ${cart.length ? "" : "disabled"}>Selesaikan transaksi &nbsp; →</button></aside></div>`;
}

async function renderReports() {
  const token = navToken;
  let report;
  try {
    report = await apiRequest(`/api/report?period=${reportPeriod}`);
  } catch (error) {
    if (token !== navToken) return;
    content.innerHTML = `${heading("Laporan", "Analisis penjualan dan metode pembayaran.", "")}<div class="empty-state"><strong>Laporan tidak dapat dimuat</strong>${escapeHTML(error.message || "")}</div>`;
    return;
  }
  if (token !== navToken) return;
  reportData = report;
  const revenue = Number(report.revenue || 0);
  const transactionCount = Number(report.transactionCount || 0);
  const bestProducts = (report.bestProducts || []).slice(0, 5);
  const itemsSold = bestProducts.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const paymentSummary = (report.paymentSummary || []).map((item) => ({ method: item.method, total: Number(item.total || 0), share: revenue ? Math.round(Number(item.total || 0) / revenue * 100) : 0 })).sort((a, b) => b.total - a.total);
  const period = Number(report.period || reportPeriod);
  const actions = `<div class="report-filter"><select class="select-control" id="reportPeriod"><option value="7" ${reportPeriod === "7" ? "selected" : ""}>7 hari terakhir</option><option value="30" ${reportPeriod === "30" ? "selected" : ""}>30 hari terakhir</option><option value="90" ${reportPeriod === "90" ? "selected" : ""}>90 hari terakhir</option></select><button class="button" data-action="export-report">Ekspor laporan</button></div>`;
  content.innerHTML = `${heading("Laporan", "Analisis penjualan dan metode pembayaran.", actions)}
    <section class="stats-grid">${statCard("Total pendapatan", money(revenue), "Pendapatan bersih", "dari transaksi selesai", "purple", chartLine([4, 8, 6, 12, 9, 17, 15]))}${statCard("Transaksi", transactionCount, "Selesai", "dalam periode laporan", "blue", chartLine([5, 6, 4, 9, 8, 13, 16]))}${statCard("Produk terjual", itemsSold, "Total item", "5 produk terlaris", "orange", chartLine([7, 5, 11, 8, 12, 10, 16]))}${statCard("Rata-rata transaksi", money(transactionCount ? revenue / transactionCount : 0), "Nilai rata-rata", "per transaksi selesai", "green", chartLine([5, 11, 8, 13, 10, 15, 17]))}</section>
    <section class="report-grid"><div class="panel"><div class="panel-heading"><div><h2>Penjualan harian</h2><p>Ringkasan dalam periode laporan</p></div><span class="chart-legend"><span class="legend-dot"></span>Pendapatan</span></div><div class="chart-wrap"><canvas id="salesChart" role="img" aria-label="Grafik penjualan laporan"></canvas></div></div>
    <div class="panel"><div class="panel-heading"><div><h2>Metode pembayaran</h2><p>Komposisi transaksi selesai</p></div></div>${paymentSummary.length ? `<div class="report-breakdown">${paymentSummary.map((item) => `<div><div class="breakdown-row"><span>${escapeHTML(item.method)}</span><span class="breakdown-bar"><span style="width:${item.share}%"></span></span><strong>${item.share}%</strong></div><div style="margin:5px 0 0 99px;color:#a1a4b1;font-size:9px">${money(item.total)}</div></div>`).join("")}</div>` : `<div class="empty-state">Belum ada data pembayaran.</div>`}<p class="report-note">Data laporan diambil dari server dan diperbarui otomatis setiap transaksi selesai.</p></div></section>
    <section class="panel table-panel"><div class="panel-heading table-head"><div class="table-title-wrap"><h2>Produk terlaris</h2><span class="count-pill">${bestProducts.length} produk</span></div></div>${bestProducts.length ? `<div class="table-scroll"><table><thead><tr><th>PRODUK</th><th>KATEGORI</th><th>UNIT TERJUAL</th><th>TOTAL PENDAPATAN</th></tr></thead><tbody>${bestProducts.map((item) => `<tr><td><div class="customer-cell"><span class="mini-avatar" style="font-size:15px">${escapeHTML(item.emoji)}</span><strong>${escapeHTML(item.name)}</strong></div></td><td>${escapeHTML(item.category)}</td><td>${item.qty} unit</td><td><strong>${money(Number(item.revenue || 0))}</strong></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>Belum ada produk terjual</strong>Data produk terlaris akan muncul setelah transaksi.</div>`}</section>`;
  drawSalesChart(reportDailyData(), period);
}

async function renderUsers() {
  const token = navToken;
  if (!isAdmin()) {
    content.innerHTML = `${heading("Pengguna", "Kelola akun pengguna TokoPintar.", "")}<div class="empty-state"><strong>Akses ditolak</strong>Halaman ini hanya untuk admin.</div>`;
    return;
  }
  content.innerHTML = `${heading("Pengguna", "Kelola akun pengguna TokoPintar.", "")}<div class="empty-state"><strong>Memuat pengguna...</strong></div>`;
  try {
    const result = await apiRequest("/api/users");
    if (token !== navToken) return;
    users = result.users || [];
  } catch (error) {
    if (token !== navToken) return;
    content.innerHTML = `${heading("Pengguna", "Kelola akun pengguna TokoPintar.", "")}<div class="empty-state"><strong>Daftar pengguna tidak dapat dimuat</strong>${escapeHTML(error.message || "")}</div>`;
    return;
  }
  content.innerHTML = `${heading("Pengguna", "Kelola akun pengguna TokoPintar.", "")}
    <section class="panel" style="max-width:560px">
      <div class="panel-heading"><div><h2>Tambah pengguna</h2><p>Buat akun kasir atau admin baru.</p></div></div>
      <form id="userForm"><div class="form-grid">
        <div class="form-field full"><label class="field-label" for="newUsername">Nama pengguna</label><input class="field-control" id="newUsername" name="username" type="text" required maxlength="64" autocomplete="off" placeholder="cth. kasir-1" /></div>
        <div class="form-field"><label class="field-label" for="newPassword">Kata sandi</label><input class="field-control" id="newPassword" name="password" type="password" required maxlength="256" autocomplete="new-password" /></div>
        <div class="form-field"><label class="field-label" for="newRole">Peran</label><select class="field-control" id="newRole" name="role"><option value="kasir">Kasir</option><option value="admin">Admin</option></select></div>
      </div><div class="form-actions"><button class="button primary" type="submit">Tambah pengguna</button></div></form>
    </section>
    <section class="panel table-panel" style="margin-top:17px">
      <div class="panel-heading table-head"><div class="table-title-wrap"><h2>Daftar pengguna</h2><span class="count-pill">${users.length} pengguna</span></div></div>
      ${users.length ? `<div class="table-scroll"><table><thead><tr><th>NAMA PENGGUNA</th><th>PERAN</th><th>DIBUAT</th></tr></thead><tbody>${users.map((user) => `<tr><td><strong>${escapeHTML(user.username)}</strong></td><td>${user.role === "admin" ? "Admin" : "Kasir"}</td><td>${user.createdAt ? dateFormat(user.createdAt, { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>Belum ada pengguna</strong></div>`}
    </section>`;
  document.querySelector("#userForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#newUsername").value.trim();
    const password = document.querySelector("#newPassword").value;
    const role = document.querySelector("#newRole").value;
    if (!username || !password) {
      showToast("Nama pengguna dan kata sandi wajib diisi.", true);
      return;
    }
    try {
      const result = await apiRequest("/api/users", { method: "POST", body: JSON.stringify({ username, password, role }) });
      showToast(`Pengguna ${result.user.username} (${result.user.role === "admin" ? "Admin" : "Kasir"}) berhasil ditambahkan.`);
      renderUsers();
    } catch (error) {
      showToast(error.message || "Pengguna gagal ditambahkan.", true);
    }
  });
}

function render() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const isActive = link.dataset.page === activePage;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const pageNames = { dashboard: "Dashboard", kasir: "Kasir", transaksi: "Transaksi", produk: "Produk", laporan: "Laporan", pengguna: "Pengguna" };
  document.querySelector("#breadcrumbCurrent").textContent = pageNames[activePage];
  if (activePage === "dashboard") renderDashboard();
  if (activePage === "kasir") renderPos();
  if (activePage === "transaksi") renderTransactions();
  if (activePage === "produk") renderProducts();
  if (activePage === "laporan") renderReports();
  if (activePage === "pengguna") renderUsers();
}

async function initializeApp() {
  const token = ++navToken;
  try {
    await refreshState();
    if (token !== navToken) return;
    if (!isAdmin() && !["kasir", "transaksi"].includes(activePage)) activePage = "kasir";
    applyRoleVisibility();
    if (activePage === "produk") await loadProductsPage(productsPage.page);
    else if (activePage === "transaksi") await loadTransactionsPage(transactionsPage.page);
    else if (activePage === "kasir") await loadPosProducts();
    else if (activePage === "dashboard") await loadDashboardLists();
    if (token !== navToken) return;
    render();
  } catch (error) {
    if (token !== navToken) return;
    console.error("Gagal menghubungkan aplikasi ke backend:", error);
    content.innerHTML = `<section class="panel" style="max-width:560px;margin:12vh auto;padding:32px;text-align:center"><div class="stat-icon purple" style="margin:0 auto 15px"><svg viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"/></svg></div><h2 style="margin-bottom:8px;font:700 16px Manrope,sans-serif">Backend belum tersambung</h2><p style="margin-bottom:18px;color:#9297a8;font-size:11px">${escapeHTML(error.message)}</p><button class="button primary" data-action="retry-backend">Coba sambungkan lagi</button></section>`;
  }
}

function navigate(page) {
  const allowedPages = ["dashboard", "kasir", "transaksi", "produk", "laporan", "pengguna"];
  if (!allowedPages.includes(page)) return;
  if (!isAdmin() && !["kasir", "transaksi"].includes(page)) page = "kasir";
  if (page === activePage) return;
  activePage = page;
  document.querySelector("#sidebar").classList.remove("open");
  const mobileMenuButton = document.querySelector("#mobileMenu");
  if (mobileMenuButton) mobileMenuButton.setAttribute("aria-expanded", "false");
  initializeApp();
}

function openModal(title, description, body, onSubmit) {
  modalLayer.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><div><h2 id="modalTitle">${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Tutup">×</button></div>${body}</div>`;
  modalLayer.onclick = (event) => {
    if (event.target === modalLayer || event.target.closest("[data-action='close-modal']")) closeModal();
  };
  modalLayer.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onSubmit(new FormData(event.currentTarget));
    } catch (error) {
      showToast(error.message || "Perubahan gagal disimpan.", true);
    }
  });
  modalLayer.querySelector("input")?.focus();
}

function closeModal() {
  modalLayer.innerHTML = "";
  modalLayer.onclick = null;
}

function productForm(product = null) {
  const editing = Boolean(product);
  const fields = `<form><div class="form-grid">
    <div class="form-field full"><label class="field-label" for="productName">Nama produk</label><input class="field-control" id="productName" name="name" required maxlength="60" value="${escapeHTML(product?.name || "")}" placeholder="Contoh: Kopi susu gula aren" /></div>
    <div class="form-field"><label class="field-label" for="productCategory">Kategori</label><select class="field-control" id="productCategory" name="category"><option ${product?.category === "Minuman" ? "selected" : ""}>Minuman</option><option ${product?.category === "Makanan" ? "selected" : ""}>Makanan</option><option ${product?.category === "Snack" ? "selected" : ""}>Snack</option><option ${product?.category && !["Minuman", "Makanan", "Snack"].includes(product.category) ? "selected" : ""}>${product?.category && !["Minuman", "Makanan", "Snack"].includes(product.category) ? escapeHTML(product.category) : "Lainnya"}</option></select></div>
    <div class="form-field"><label class="field-label" for="productEmoji">Ikon produk</label><select class="field-control" id="productEmoji" name="emoji">${["📦", "☕", "🥐", "🍵", "🥖", "🍋", "🍪", "🥪", "💧", "🍩"].map((emoji) => `<option ${product?.emoji === emoji ? "selected" : ""}>${emoji}</option>`).join("")}</select></div>
    <div class="form-field"><label class="field-label" for="productPrice">Harga (Rp)</label><input class="field-control" id="productPrice" type="number" name="price" required min="1" step="500" value="${product?.price || ""}" placeholder="18000" /></div>
    <div class="form-field"><label class="field-label" for="productStock">Stok</label><input class="field-control" id="productStock" type="number" name="stock" required min="0" step="1" value="${product?.stock ?? ""}" placeholder="20" /></div>
  </div><div class="form-actions"><button class="button" type="button" data-action="close-modal">Batal</button><button class="button primary" type="submit">${editing ? "Simpan perubahan" : "Tambah produk"}</button></div></form>`;
  openModal(editing ? "Edit produk" : "Tambah produk baru", editing ? "Perbarui informasi produk dan stok." : "Masukkan informasi produk yang akan dijual.", fields, async (form) => {
    const name = String(form.get("name")).trim();
    const price = Number(form.get("price"));
    const stock = Number(form.get("stock"));
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      showToast("Periksa kembali nama, harga, dan stok produk.", true);
      return;
    }
    const values = { name, category: String(form.get("category")), emoji: String(form.get("emoji")), price, stock };
    const result = await apiRequest(editing ? `/api/products/${encodeURIComponent(product.id)}` : "/api/products", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(values)
    });
    state = result.state;
    closeModal();
    if (activePage === "produk") await loadProductsPage(productsPage.page);
    render();
    showToast(editing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
  });
}

function transactionDetail(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const body = `<div class="detail-list"><div class="detail-row"><span>ID transaksi</span><strong>${escapeHTML(transaction.id)}</strong></div><div class="detail-row"><span>Nama pelanggan</span><strong>${escapeHTML(transaction.customer)}</strong></div><div class="detail-row"><span>Tanggal</span><strong>${dateFormat(transaction.date, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></div><div class="detail-row"><span>Pembayaran</span><strong>${escapeHTML(transaction.payment)}</strong></div><div class="detail-row"><span>Status</span><span class="status">${escapeHTML(transaction.status)}</span></div></div><div class="detail-products">${transaction.items.map((item) => `<div class="detail-row"><span>${escapeHTML(item.name)} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join("")}<div class="detail-row" style="padding-top:11px;margin-top:5px;border-top:1px solid #ececf3"><strong>Total</strong><strong>${money(transaction.total)}</strong></div></div><div class="form-actions"><button class="button" data-action="close-modal">Tutup</button>${transaction.status === "Selesai" && isAdmin() ? `<button class="button danger" data-action="cancel-transaction" data-id="${escapeHTML(transaction.id)}">Batalkan transaksi</button>` : ""}</div>`;
  openModal("Detail transaksi", "Rincian pembayaran dan produk yang dibeli.", body);
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product || product.stock <= 0) return showToast("Stok produk habis.", true);
  const existing = cart.find((line) => line.productId === id);
  if (existing) {
    if (existing.qty >= product.stock) return showToast("Jumlah melebihi stok yang tersedia.", true);
    existing.qty += 1;
  } else cart.push({ productId: product.id, name: product.name, price: product.price, qty: 1 });
  renderPos();
}

function updateCart(id, change) {
  const line = cart.find((item) => item.productId === id);
  if (!line) return;
  const product = state.products.find((item) => item.id === id);
  if (change > 0 && line.qty >= (product?.stock || 0)) return showToast("Jumlah melebihi stok yang tersedia.", true);
  line.qty += change;
  if (line.qty <= 0) cart = cart.filter((item) => item.productId !== id);
  renderPos();
}

async function checkout() {
  if (!cart.length) return showToast("Keranjang masih kosong.", true);
  for (const line of cart) {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product || product.stock < line.qty) return showToast(`Stok ${line.name} tidak mencukupi.`, true);
  }
  const customer = document.querySelector("#customerName")?.value.trim() || "Pelanggan umum";
  const payment = document.querySelector("#paymentMethod")?.value || "Tunai";
  try {
    const result = await apiRequest("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ customer, payment, items: cart.map(({ productId, qty }) => ({ productId, qty })) })
    });
    state = result.state;
    cart = [];
    navigate("transaksi");
    showToast(`Transaksi ${result.transaction.id} berhasil disimpan.`);
    transactionDetail(result.transaction.id);
  } catch (error) {
    showToast(error.message || "Transaksi gagal disimpan.", true);
  }
}

function exportCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showToast("File CSV berhasil diunduh.");
}

document.addEventListener("click", async (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    const nav = event.target.closest("[data-page]");
    if (nav) navigate(nav.dataset.page);
    return;
  }
  const { action, id } = actionElement.dataset;
  if (action === "retry-backend") initializeApp();
  if (action === "navigate") navigate(actionElement.dataset.page);
  if (action === "go-pos") { productFilter = ""; navigate("kasir"); }
  if (action === "products-prev" && productsPage.page > 1) { await loadProductsPage(productsPage.page - 1); renderProducts(); }
  if (action === "products-next" && productsPage.page < productsPage.totalPages) { await loadProductsPage(productsPage.page + 1); renderProducts(); }
  if (action === "transactions-prev" && transactionsPage.page > 1) { await loadTransactionsPage(transactionsPage.page - 1); renderTransactions(); }
  if (action === "transactions-next" && transactionsPage.page < transactionsPage.totalPages) { await loadTransactionsPage(transactionsPage.page + 1); renderTransactions(); }
  if (action === "add-product") productForm();
  if (action === "edit-product") {
    const product = state.products.find((item) => item.id === id);
    if (product) productForm(product);
  }
  if (action === "delete-product") {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    if (state.transactions.some((transaction) => transaction.items.some((item) => item.productId === id))) {
      return showToast("Produk yang pernah terjual tidak dapat dihapus. Ubah stok menjadi 0.", true);
    }
    if (window.confirm(`Hapus produk "${product.name}"?`)) {
      try {
        const result = await apiRequest(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
        state = result.state;
        await loadProductsPage(productsPage.page);
        renderProducts();
        showToast("Produk berhasil dihapus.");
      } catch (error) {
        showToast(error.message || "Produk gagal dihapus.", true);
      }
    }
  }
  if (action === "add-cart") addToCart(id);
  if (action === "cart-qty") updateCart(id, Number(actionElement.dataset.change));
  if (action === "clear-cart") {
    cart = [];
    productFilter = "";
    await loadPosProducts();
    renderPos();
    showToast("Keranjang dikosongkan.");
  }
  if (action === "checkout") await checkout();
  if (action === "pos-category") {
    posCategory = actionElement.dataset.category;
    await loadPosProducts();
    renderPos();
  }
  if (action === "transaction-detail") transactionDetail(id);
  if (action === "cancel-transaction") {
    const transaction = state.transactions.find((item) => item.id === id);
    if (transaction && window.confirm(`Batalkan transaksi ${id}? Stok produk akan dikembalikan.`)) {
      try {
        const result = await apiRequest(`/api/transactions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
        state = result.state;
        closeModal();
        if (activePage === "transaksi") await loadTransactionsPage(transactionsPage.page);
        render();
        showToast("Transaksi dibatalkan dan stok dikembalikan.");
      } catch (error) {
        showToast(error.message || "Transaksi gagal dibatalkan.", true);
      }
    }
  }
  if (action === "close-modal") closeModal();
  if (action === "export-transactions") {
    const all = await apiRequest("/api/transactions?limit=500&offset=0");
    exportCSV("transaksi-grace-shop.csv", [["ID Transaksi", "Pelanggan", "Tanggal", "Pembayaran", "Total", "Status"], ...all.transactions.map((item) => [item.id, item.customer, dateFormat(item.date), item.payment, item.total, item.status])]);
  }
  if (action === "export-products") {
    const all = await apiRequest("/api/products?limit=1000&page=1");
    exportCSV("produk-grace-shop.csv", [["SKU", "Nama Produk", "Kategori", "Harga", "Stok"], ...all.products.map((item) => [item.id, item.name, item.category, item.price, item.stock])]);
  }
  if (action === "export-report") {
    const daily = (reportData && reportData.dailySales) || [];
    exportCSV("laporan-grace-shop.csv", [["Tanggal", "Transaksi", "Total"], ...daily.map((item) => [item.date, item.count, item.total])]);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "dashboardPeriod") {
    selectedPeriod = event.target.value;
    renderDashboard();
  }
  if (event.target.id === "productCategoryFilter") {
    productCategoryFilter = event.target.value;
    loadProductsPage(1).then(renderProducts);
  }
  if (event.target.id === "reportPeriod") {
    reportPeriod = event.target.value;
    reportStart = "";
    reportEnd = "";
    renderReports();
  }
  if (event.target.id === "transactionStatus") {
    transactionStatusFilter = event.target.value;
    loadTransactionsPage(1).then(renderTransactions);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "productSearch") {
    productFilter = event.target.value;
    loadProductsPage(1).then(() => {
      renderProducts();
      const input = document.querySelector("#productSearch");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
  if (event.target.id === "transactionSearch") {
    transactionFilter = event.target.value;
    loadTransactionsPage(1).then(() => {
      renderTransactions();
      const input = document.querySelector("#transactionSearch");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
  if (event.target.id === "posSearch") {
    productFilter = event.target.value;
    loadPosProducts().then(() => {
      renderPos();
      const input = document.querySelector("#posSearch");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
});

document.querySelector("#mobileMenu").addEventListener("click", (event) => {
  const sidebar = document.querySelector("#sidebar");
  const isOpen = sidebar.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.querySelector("#globalSearch").addEventListener("input", (event) => {
  const query = event.target.value.trim();
  if (!query) return;
  if (activePage === "produk") { productFilter = query; loadProductsPage(1).then(renderProducts); }
  else if (activePage === "transaksi") { transactionFilter = query; loadTransactionsPage(1).then(renderTransactions); }
  else { productFilter = query; navigate("kasir"); }
});
document.querySelector("#globalSearch").addEventListener("keydown", (event) => {
  if (event.key === "Escape") { event.target.value = ""; productFilter = ""; transactionFilter = ""; }
});
document.querySelector("#helpButton").addEventListener("click", () => showToast("Pilih Kasir untuk transaksi, atau Produk untuk mengelola katalog."));
document.querySelector("#notificationButton").addEventListener("click", () => {
  const lowStockCount = Number(state.stats && state.stats.lowStockCount ? state.stats.lowStockCount : 0);
  showToast(lowStockCount ? `${lowStockCount} produk memiliki stok menipis.` : "Tidak ada notifikasi baru.");
});
document.querySelector("#profileButton").addEventListener("click", () => showToast(state.user ? `Kamu masuk sebagai ${state.user.username} (${state.user.role === "admin" ? "Administrator" : "Kasir"}).` : "Kamu belum masuk."));
document.querySelector("#todayLabel").textContent = dateFormat(new Date(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
window.addEventListener("resize", () => {
  if (activePage === "dashboard") drawSalesChart(dashboardDailyData(), Number(selectedPeriod));
  if (activePage === "laporan") drawSalesChart(reportDailyData(), Number(reportPeriod));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalLayer.innerHTML) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#globalSearch").focus();
  }
});

render();
initializeApp();

// Tema TokoPintar (terang/gelap/OLED): pilihan tersimpan di localStorage.
(function () {
  var STORAGE_KEY = "tokopintar-theme";
  var toggle = document.getElementById("themeToggle");
  var metaTheme = document.querySelector("meta[name=theme-color]");
  function syncMeta(theme) {
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "oled" ? "#000000" : theme === "dark" ? "#0f172a" : "#f6f7fb");
    }
  }
  function syncToggle(theme) {
    if (toggle) {
      toggle.setAttribute("aria-label", theme === "oled" ? "Ubah ke tema terang" : theme === "dark" ? "Ubah ke tema OLED" : "Ubah ke tema gelap");
    }
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    syncMeta(theme);
    syncToggle(theme);
  }
  var initial = document.documentElement.getAttribute("data-theme");
  if (initial !== "dark" && initial !== "light" && initial !== "oled") {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved !== "dark" && saved !== "light" && saved !== "oled") {
      saved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    applyTheme(saved);
  } else {
    syncMeta(initial);
    syncToggle(initial);
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "light" ? "dark" : current === "dark" ? "oled" : "light");
    });
  }
})();
