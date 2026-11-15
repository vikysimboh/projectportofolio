"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { getPool, closeAllPools } = require("./db.js");

function toMysqlDatetime(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function main() {
  const pool = getPool();
  const storePath = path.join(__dirname, "data", "store.json");
  const adminPath = path.join(__dirname, "data", "admin.json");
  const store = JSON.parse(await fs.readFile(storePath, "utf8"));
  let admin = null;
  try {
    admin = JSON.parse(await fs.readFile(adminPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let productCount = 0;
    for (const product of store.products || []) {
      await connection.query(
        "INSERT INTO products (id, name, category, emoji, price, stock) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), emoji = VALUES(emoji), price = VALUES(price), stock = VALUES(stock)",
        [product.id, product.name, product.category, product.emoji, product.price, product.stock]
      );
      productCount += 1;
    }
    let transactionCount = 0;
    let itemCount = 0;
    for (const transaction of store.transactions || []) {
      await connection.query(
        "INSERT INTO transactions (id, customer, date, total, payment, status) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE customer = VALUES(customer), date = VALUES(date), total = VALUES(total), payment = VALUES(payment), status = VALUES(status)",
        [transaction.id, transaction.customer, toMysqlDatetime(transaction.date), transaction.total, transaction.payment, transaction.status]
      );
      transactionCount += 1;
      await connection.query("DELETE FROM transaction_items WHERE transaction_id = ?", [transaction.id]);
      for (const item of transaction.items || []) {
        await connection.query(
          "INSERT INTO transaction_items (transaction_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
          [transaction.id, item.productId, item.name, item.price, item.qty]
        );
        itemCount += 1;
      }
    }
    let adminCount = 0;
    if (admin && admin.username && admin.salt && admin.hash) {
      await connection.query(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)",
        [admin.username, admin.salt + ":" + admin.hash, "admin", toMysqlDatetime(admin.createdAt || new Date().toISOString())]
      );
      adminCount = 1;
    }
    await connection.commit();
    console.log("Migrasi selesai.");
    console.log("Produk dimigrasi: " + productCount);
    console.log("Transaksi dimigrasi: " + transactionCount);
    console.log("Item transaksi dimigrasi: " + itemCount);
    console.log("Akun admin dimigrasi: " + adminCount);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error("Migrasi gagal:", error.message);
    process.exitCode = 1;
  })
  .finally(() => closeAllPools());
