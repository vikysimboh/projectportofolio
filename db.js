"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

// Memuat variabel dari file .env di root proyek (bila ada). Nilai yang sudah
// ada di process.env tidak ditimpa, jadi kredensial tetap bisa diberikan
// lewat environment variable.
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

function dbConfig(database) {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "grace_app",
    password: process.env.DB_PASSWORD || "",
    database: database || process.env.DB_NAME || "grace_shop",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    timezone: "Z",
  };
}

const pools = new Map();

function getPool(database) {
  const name = database || process.env.DB_NAME || "grace_shop";
  if (!pools.has(name)) pools.set(name, mysql.createPool(dbConfig(name)));
  return pools.get(name);
}

function createPool(database) {
  return mysql.createPool(dbConfig(database));
}

async function closePool(database) {
  const name = database || process.env.DB_NAME || "grace_shop";
  const pool = pools.get(name);
  if (!pool) return;
  pools.delete(name);
  await pool.end();
}

async function closeAllPools() {
  const all = [...pools.values()];
  pools.clear();
  await Promise.all(all.map((pool) => pool.end()));
}

module.exports = { loadEnvFile, dbConfig, getPool, createPool, closePool, closeAllPools };
