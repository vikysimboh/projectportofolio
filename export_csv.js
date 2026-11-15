"use strict";

// Skrip ekspor CSV untuk Power BI / Tableau.
// Hanya membaca database (SELECT) lewat modul analytics.js.
// Jalankan: node export_csv.js
// Keluaran: exports/*.csv (UTF-8, dengan header, koma sebagai pemisah).

const fs = require("node:fs");
const path = require("node:path");
const { createPool, closeAllPools } = require("./db.js");
const analytics = require("./analytics.js");

const EXPORT_DIR = path.join(__dirname, "exports");
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const QUOTE = '"';

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const needsQuote = text.indexOf(",") !== -1 || text.indexOf(QUOTE) !== -1
    || text.indexOf(NL) !== -1 || text.indexOf(CR) !== -1;
  if (needsQuote) return QUOTE + text.split(QUOTE).join(QUOTE + QUOTE) + QUOTE;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join(NL) + NL;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function main() {
  const pool = createPool();
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const started = Date.now();

  function write(name, headers, rows) {
    const t0 = Date.now();
    const text = toCsv(headers, rows);
    fs.writeFileSync(path.join(EXPORT_DIR, name), text, "utf8");
    console.log(name + ": " + rows.length + " baris data (" + (Date.now() - t0) + " ms)");
  }

  const [daily, monthly, performance, categories, hourly, products, sample] = await Promise.all([
    analytics.getDailySales(pool),
    analytics.getMonthlySales(pool),
    analytics.getProductPerformance(pool),
    analytics.getCategoryStats(pool),
    analytics.getHourlySales(pool),
    analytics.getProductList(pool),
    analytics.getSampleTransactions(pool, 10000),
  ]);

  write("penjualan_harian.csv",
    ["tanggal", "jumlah_transaksi", "pendapatan", "jumlah_item"],
    daily.map((r) => [r.date, r.transactions, r.revenue, r.items]));
  write("penjualan_bulanan.csv",
    ["bulan", "jumlah_transaksi", "pendapatan", "jumlah_item", "rata_rata_belanja"],
    monthly.map((r) => [r.month, r.transactions, r.revenue, r.items, round2(r.avgBasket)]));
  write("produk_kinerja.csv",
    ["nama_produk", "sku", "kategori", "harga", "stok", "jumlah_terjual", "pendapatan"],
    performance.map((r) => [r.name, r.sku, r.category, r.price, r.stock, r.sold, r.revenue]));
  write("kategori.csv",
    ["kategori", "jumlah_transaksi", "pendapatan", "pangsa_persen"],
    categories.map((r) => [r.category, r.transactions, r.revenue, round2(r.share)]));
  write("penjualan_per_jam.csv",
    ["jam", "jumlah_transaksi", "pendapatan"],
    hourly.map((r) => [r.hour, r.transactions, r.revenue]));
  write("produk.csv",
    ["nama_produk", "sku", "kategori", "harga", "stok"],
    products.map((r) => [r.name, r.sku, r.category, r.price, r.stock]));
  write("transaksi_contoh.csv",
    ["tanggal", "jumlah_item", "total"],
    sample.map((r) => [r.date, r.items, r.total]));

  console.log("Selesai dalam " + (Date.now() - started) + " ms. Folder: exports/");
  await closeAllPools();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
