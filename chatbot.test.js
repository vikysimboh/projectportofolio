"use strict";

// Tes unit chatbot Asisten TokoPintar (chatbot.js) dengan mock pool.
// Tidak butuh database MySQL maupun kunci API Samudra.
// Jalankan: node --test chatbot.test.js

const assert = require("node:assert/strict");
const test = require("node:test");

const { answerChat, FALLBACK_REPLY, WHATSAPP_SHORT } = require("./chatbot");

const MOCK_PRODUCTS = [
  { id: "PRD-001", name: "Kopi Susu Gula Aren", category: "Minuman", emoji: "☕", price: 18000, stock: 32, sold: 36882 },
  { id: "PRD-002", name: "Croissant Butter", category: "Makanan", emoji: "🥐", price: 22000, stock: 18, sold: 21911 },
  { id: "PRD-003", name: "Matcha Latte", category: "Minuman", emoji: "🍵", price: 24000, stock: 21, sold: 18585 },
];

function makeMockPool() {
  return {
    async query(sql, params = []) {
      if (sql.includes("SUM(ti.qty)")) {
        const top = [...MOCK_PRODUCTS]
          .sort((a, b) => b.sold - a.sold)
          .map((p) => ({ productId: p.id, name: p.name, price: p.price, stock: p.stock, sold: p.sold }));
        return [top];
      }
      if (sql.includes("DISTINCT category")) {
        return [[...new Set(MOCK_PRODUCTS.map((p) => p.category))].map((category) => ({ category }))];
      }
      if (sql.includes("FROM products WHERE")) {
        const words = params.map((param) => String(param).replace(/%/g, "").toLowerCase());
        const matches = MOCK_PRODUCTS.filter((product) =>
          words.some((word) => product.name.toLowerCase().includes(word))
        );
        return [matches];
      }
      return [[]];
    },
  };
}

test("sapaan dijawab ramah (source kb)", async () => {
  const result = await answerChat(makeMockPool(), "Halo");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /Halo! Saya Asisten TokoPintar/);
});

test("harga Kopi Susu Gula Aren memakai data asli (source kb)", async () => {
  const result = await answerChat(makeMockPool(), "Berapa harga Kopi Susu Gula Aren?");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /Kopi Susu Gula Aren/);
  assert.match(result.reply, /Rp18\.000/);
  assert.match(result.reply, /stok tersedia 32/);
});

test("produk terlaris menampilkan daftar dari database (source kb)", async () => {
  const result = await answerChat(makeMockPool(), "Apa produk terlaris?");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /Produk terlaris/);
  assert.match(result.reply, /1\. Kopi Susu Gula Aren/);
  assert.match(result.reply, /2\. Croissant Butter/);
});

test("cara pembayaran menyebut metode yang diterima (source kb)", async () => {
  const result = await answerChat(makeMockPool(), "Bagaimana cara pembayaran?");
  assert.equal(result.source, "kb");
  for (const method of ["Tunai", "QRIS", "Transfer", "Kartu debit"]) {
    assert.match(result.reply, new RegExp(method));
  }
});

test("pertanyaan di luar topik -> fallback sopan + WhatsApp (source fallback)", async () => {
  const result = await answerChat(makeMockPool(), "Apakah ada diskon untuk pembelian bulan depan?");
  assert.equal(result.source, "fallback");
  assert.equal(result.reply, FALLBACK_REPLY);
  assert.match(result.reply, new RegExp(WHATSAPP_SHORT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("pesan kosong ditolak dengan sopan", async () => {
  const result = await answerChat(makeMockPool(), "   ");
  assert.equal(result.source, "fallback");
  assert.match(result.reply, /Silakan tulis pertanyaan Anda/);
});

test("pesan lebih dari 500 karakter ditolak", async () => {
  const result = await answerChat(makeMockPool(), "a".repeat(501));
  assert.equal(result.source, "fallback");
  assert.match(result.reply, /maksimal 500 karakter/);
});

test("minta bicara dengan manusia -> diarahkan ke WhatsApp", async () => {
  const result = await answerChat(makeMockPool(), "Saya mau bicara dengan manusia");
  assert.equal(result.source, "kb");
  assert.match(result.reply, new RegExp(WHATSAPP_SHORT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("produk tidak dikenal -> jawaban jujur + saran, bukan karangan", async () => {
  const result = await answerChat(makeMockPool(), "Berapa harga es kopi alpukat?");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /tidak menemukan produk/);
  assert.match(result.reply, /Mungkin maksud Anda/);
  assert.match(result.reply, /Kopi Susu Gula Aren/);
  assert.doesNotMatch(result.reply, /stok tersedia/);
});

test("chip 'Cek harga produk' -> chatbot bertanya produk yang mana", async () => {
  const result = await answerChat(makeMockPool(), "Cek harga produk");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /Produk apa yang ingin dicek harganya/);
});

test("mode AI dipakai bila kunci tersedia (fetch di-stub)", async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SAMUDRA_API_KEY;
  process.env.SAMUDRA_API_KEY = "dummy-key-untuk-tes";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "Halo! Ada yang bisa saya bantu?" } }] }),
  });
  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SAMUDRA_API_KEY;
    else process.env.SAMUDRA_API_KEY = originalKey;
  });
  const result = await answerChat(makeMockPool(), "Halo");
  assert.equal(result.source, "ai");
  assert.equal(result.reply, "Halo! Ada yang bisa saya bantu?");
});

test("LLM gagal -> jatuh ke mode KB", async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SAMUDRA_API_KEY;
  process.env.SAMUDRA_API_KEY = "dummy-key-untuk-tes";
  global.fetch = async () => {
    throw new Error("jaringan putus");
  };
  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SAMUDRA_API_KEY;
    else process.env.SAMUDRA_API_KEY = originalKey;
  });
  const result = await answerChat(makeMockPool(), "Berapa harga Kopi Susu Gula Aren?");
  assert.equal(result.source, "kb");
  assert.match(result.reply, /Rp18\.000/);
});
