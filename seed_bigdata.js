"use strict";

// Seed big data Grace Shop: sekitar 1.000 produk dan 1.000.000 transaksi.
// Data contoh (seed) yang realistis dan berpola: nama produk Indonesia,
// transaksi lebih ramai di akhir pekan dan akhir bulan, tersebar 12 bulan.
// RNG deterministik (mulberry32) supaya hasil bisa diulang.
// Cara pakai: node seed_bigdata.js
// (membaca kredensial dari .env / environment variable, seperti db.js)

const { getPool, closeAllPools } = require("./db.js");

const TARGET_PRODUCTS = 1000;
const TARGET_TRANSACTIONS = 1000000;
const BATCH = 5000;
const DAY_MS = 86400000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261114);
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function intBetween(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
function weighted(pairs) {
  let total = 0;
  for (const pair of pairs) total += pair[1];
  let r = rand() * total;
  for (const pair of pairs) {
    r -= pair[1];
    if (r <= 0) return pair[0];
  }
  return pairs[pairs.length - 1][0];
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toMysqlDatetime(d) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

const DRINKS = [
  ["Kopi Susu", "☕"], ["Kopi Hitam", "☕"], ["Es Kopi", "🥋"], ["Cappuccino", "☕"],
  ["Matcha Latte", "🍚"], ["Cokelat Panas", "🍻"], ["Es Teh", "🥋"], ["Teh Melati", "🍵"],
  ["Lemon Tea", "🍋"], ["Jus Alpukat", "🥏"], ["Jus Mangga", "🥏"], ["Es Jeruk", "🍊"],
  ["Susu Cokelat", "🥛"], ["Red Velvet", "🥋"], ["Taro Latte", "🧋"], ["Es Buah", "🍉"],
  ["Soda Gembira", "🥃"], ["Air Kelapa", "🥥"], ["Wedang Jahe", "🍵"], ["Es Cendol", "🍨"]
];

const FOODS = ["Croissant", "Roti Cokelat", "Sandwich Ayam", "Nasi Goreng", "Mie Goreng", "Ayam Geprek", "Soto Ayam", "Bakso", "Nasi Ayam", "Spaghetti", "Roti Bakar", "Burger", "Kentang Goreng", "Pisang Goreng", "Lumpia", "Siomay", "Dimsum", "Nasi Uduk", "Gado-Gado", "Sate Ayam"];
const SNACKS = ["Cookies Cokelat", "Donat Gula", "Brownies", "Kue Lapis", "Risoles", "Lemper", "Klepon", "Puding", "Es Krim", "Churros", "Makaroni", "Keripik Singkong", "Kacang", "Cokelat Batang", "Permen", "Wafer", "Biskuit", "Muffin", "Cupcake", "Pancake"];
const VARIANTS = ["Original", "Gula Aren", "Cokelat", "Pandan", "Karamel", "Keju", "Spesial", "Premium", "Madu", "Kacang", "Stroberi", "Vanila", "Matcha", "Taro", "Susu", "Pedas", "Bakar"];
const FIRST_NAMES = ["Agus", "Budi", "Citra", "Dewi", "Eko", "Fitri", "Gilang", "Hana", "Irfan", "Joko", "Kirana", "Lestari", "Made", "Nadia", "Putri", "Rizky", "Siti", "Tono", "Umar", "Wulan", "Yoga", "Ratna", "Bambang", "Sari", "Dedi", "Maya", "Andi", "Rina", "Fajar", "Lina"];
const LAST_NAMES = ["Santoso", "Wijaya", "Prasetyo", "Kusuma", "Rahmawati", "Saputra", "Hidayat", "Nugroho", "Anggraini", "Setiawan", "Puspita", "Gunawan", "Maharani", "Firmansyah", "Utami", "Ramadhan", "Hakim", "Siregar", "Nasution", "Pangestu", "Wulandari", "Sihombing", "Halim", "Salim", "Maulana", "Rahman", "Suryani", "Hartono", "Lestari", "Putri"];
const PAYMENTS = [["QRIS", 40], ["Tunai", 30], ["Transfer", 20], ["Kartu debit", 10]];
const HOUR_WEIGHTS = [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 2], [6, 4], [7, 8], [8, 10], [9, 9], [10, 7], [11, 8], [12, 9], [13, 7], [14, 6], [15, 8], [16, 9], [17, 10], [18, 9], [19, 7], [20, 5], [21, 3], [22, 2], [23, 1]];
const CATEGORY_EMOJI = { Minuman: "☕", Makanan: "🍔", Snack: "🍪" };
const CATEGORY_PRICE = { Minuman: [8000, 35000], Makanan: [12000, 45000], Snack: [5000, 25000] };

// Membangun daftar produk seed (nama unik = nama dasar + varian).
function buildProductList(existingCount, targetCount) {
  const bases = [];
  for (const pair of DRINKS) bases.push(["Minuman", pair[0], pair[1]]);
  for (const name of FOODS) bases.push(["Makanan", name, CATEGORY_EMOJI.Makanan]);
  for (const name of SNACKS) bases.push(["Snack", name, CATEGORY_EMOJI.Snack]);
  const names = new Set();
  const products = [];
  let number = existingCount + 1;
  for (const base of bases) {
    for (const variant of VARIANTS) {
      if (products.length >= targetCount - existingCount) break;
      const name = base[1] + " " + variant;
      if (names.has(name)) continue;
      names.add(name);
      const range = CATEGORY_PRICE[base[0]];
      const price = Math.round(intBetween(range[0], range[1]) / 500) * 500;
      const stock = rand() < 0.1 ? 0 : intBetween(1, 80);
      products.push(["PRD-" + String(number).padStart(3, "0"), name, base[0], base[2], price, stock]);
      number += 1;
    }
    if (products.length >= targetCount - existingCount) break;
  }
  return products;
}

async function bulkInsert(connection, table, columns, rows) {
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await connection.query("INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES ?", [slice]);
  }
  return rows.length;
}

async function main() {
  const started = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const existingTx = await connection.query("SELECT COUNT(*) AS total FROM transactions");
    const existingProducts = await connection.query("SELECT COUNT(*) AS total FROM products");
    console.log("Kondisi awal: produk " + existingProducts[0][0].total + ", transaksi " + existingTx[0][0].total);
    await connection.query("DELETE FROM transaction_items WHERE transaction_id LIKE ?", ["TRX-S%"]);
    await connection.query("DELETE FROM transactions WHERE id LIKE ?", ["TRX-S%"]);
    await connection.query(
      "DELETE FROM products WHERE id REGEXP ? AND CAST(SUBSTRING(id, 5) AS UNSIGNED) BETWEEN 10 AND 1000 " +
        "AND NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_items.product_id = products.id)",
      ["^PRD-[0-9]+\$"]
    );
    const afterDeleteTx = await connection.query("SELECT COUNT(*) AS total FROM transactions");
    const afterDeleteProducts = await connection.query("SELECT COUNT(*) AS total FROM products");
    const remainingTransactions = afterDeleteTx[0][0].total;
    const remainingProducts = afterDeleteProducts[0][0].total;
    console.log("Setelah menghapus seed lama: produk " + remainingProducts + ", transaksi " + remainingTransactions);
    const seedProducts = buildProductList(remainingProducts, TARGET_PRODUCTS);
    if (seedProducts.length > 0) {
      await bulkInsert(connection, "products", ["id", "name", "category", "emoji", "price", "stock"], seedProducts);
      console.log("Produk seed ditambahkan: " + seedProducts.length);
    }
    const allProducts = (await connection.query("SELECT id, name, price FROM products"))[0];
    const productCount = allProducts.length;
    const totalToGenerate = TARGET_TRANSACTIONS - remainingTransactions;
    console.log("Transaksi yang akan dibuat: " + totalToGenerate);

    if (totalToGenerate <= 0) {
      console.log("Target transaksi sudah tercapai, tidak ada yang dibuat.");
    } else {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let generated = 0;
      let sequence = 1;
      let lastLogged = 0;
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      await connection.query("SET UNIQUE_CHECKS = 0");
      try {
        for (let dayOffset = 364; dayOffset >= 0 && generated < totalToGenerate; dayOffset -= 1) {
          const day = new Date(today.getTime() - dayOffset * DAY_MS);
          const remaining = totalToGenerate - generated;
          const daysLeft = dayOffset + 1;
          const weekday = day.getUTCDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const isMonthEnd = day.getUTCDate() >= 25;
          let factor = 1;
          if (isWeekend) factor *= 1.4;
          if (isMonthEnd) factor *= 1.3;
          let count = Math.round((remaining / daysLeft) * factor * (0.8 + rand() * 0.4));
          if (count < 0) count = 0;
          if (count > remaining) count = remaining;
          if (count === 0) continue;
          const txRows = [];
          const itemRows = [];
          for (let i = 0; i < count; i += 1) {
            const hour = weighted(HOUR_WEIGHTS);
            const minute = intBetween(0, 59);
            const second = intBetween(0, 59);
            const date = new Date(day.getTime() + (hour * 3600 + minute * 60 + second) * 1000);
            const customer = rand() < 0.15 ? "Pelanggan umum" : pick(FIRST_NAMES) + " " + pick(LAST_NAMES);
            const payment = weighted(PAYMENTS);
            const status = weighted([["Selesai", 97], ["Dibatalkan", 3]]);
            const itemCount = weighted([[2, 40], [3, 35], [4, 25]]);
            const id = "TRX-S" + String(sequence).padStart(7, "0");
            sequence += 1;
            let total = 0;
            const used = new Set();
            for (let j = 0; j < itemCount; j += 1) {
              let productIndex = Math.floor(Math.pow(rand(), 1.5) * productCount);
              let product = allProducts[productIndex];
              let guard = 0;
              while (used.has(product.id) && guard < 10) {
                productIndex = Math.floor(rand() * productCount);
                product = allProducts[productIndex];
                guard += 1;
              }
              used.add(product.id);
              const qty = weighted([[1, 70], [2, 25], [3, 5]]);
              total += product.price * qty;
              itemRows.push([id, product.id, product.name, product.price, qty]);
            }
            txRows.push([id, customer, toMysqlDatetime(date), total, payment, status]);
          }
          await bulkInsert(connection, "transactions", ["id", "customer", "date", "total", "payment", "status"], txRows);
          await bulkInsert(connection, "transaction_items", ["transaction_id", "product_id", "name", "price", "qty"], itemRows);
          generated += count;
          if (generated - lastLogged >= 100000) {
            console.log("  ... " + generated + " / " + totalToGenerate + " transaksi");
            lastLogged = generated;
          }
        }
      } finally {
        await connection.query("SET UNIQUE_CHECKS = 1");
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      }
      console.log("Transaksi seed dibuat: " + generated);
    }

    const finalCounts = await connection.query("SELECT (SELECT COUNT(*) FROM products) AS produk, (SELECT COUNT(*) FROM transactions) AS transaksi, (SELECT COUNT(*) FROM transaction_items) AS item");
    const counts = finalCounts[0][0];
    const orphans = await connection.query("SELECT COUNT(*) AS total FROM transaction_items ti LEFT JOIN transactions t ON t.id = ti.transaction_id LEFT JOIN products p ON p.id = ti.product_id WHERE t.id IS NULL OR p.id IS NULL");
    console.log("Selesai dalam " + Math.round((Date.now() - started) / 1000) + " detik.");
    console.log("Produk akhir: " + counts.produk);
    console.log("Transaksi akhir: " + counts.transaksi);
    console.log("Item transaksi akhir: " + counts.item);
    console.log("Item tanpa transaksi/produk (harus 0): " + orphans[0][0].total);
  } catch (error) {
    console.error("Seed gagal:", error.message);
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    process.exitCode = 1;
  })
  .finally(() => closeAllPools());
