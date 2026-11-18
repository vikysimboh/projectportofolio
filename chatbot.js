"use strict";

// Asisten TokoPintar — chatbot untuk kontak bantuan di landing page.
//
// Dua mode jawaban:
//   1. AI  : bila environment variable SAMUDRA_API_KEY tersedia, pertanyaan
//            dijawab model deepseek-v4.1-flash:free lewat API Samudra
//            (OpenAI-compatible) dengan konteks data toko dari database.
//   2. KB  : bila tidak ada kunci (atau panggilan LLM gagal/timeout),
//            pertanyaan dijawab dari pencocokan kata kunci + data ASLI
//            dari database (harga, stok, produk terlaris, kategori).
// Bila tidak ada yang cocok, balasan fallback mengarahkan ke WhatsApp.
//
// Kunci LLM HANYA dibaca dari process.env.SAMUDRA_API_KEY. Jangan pernah
// menulis API key di file ini atau di repo.

const WHATSAPP_URL =
  "https://wa.me/6281358785835?text=Halo%2C%20saya%20butuh%20bantuan%20dengan%20TokoPintar";
const WHATSAPP_SHORT = "https://wa.me/6281358785835";
const SAMUDRA_BASE_URL = "https://inference.samudracorp.web.id/v1";
const SAMUDRA_MODEL = "deepseek-v4.1-flash:free";
const CHAT_TIMEOUT_MS = 20000;
const MAX_MESSAGE_CHARS = 500;
const MAX_AI_REPLY_CHARS = 1500;
const PAYMENT_METHODS = ["Tunai", "QRIS", "Transfer", "Kartu debit"];

const SYSTEM_PROMPT = [
  "Kamu adalah Asisten TokoPintar, asisten virtual toko kasir POS TokoPintar.",
  "Jawablah dengan ramah, singkat, dan jelas dalam Bahasa Indonesia.",
  "Maksimal sekitar 3 kalimat, kecuali saat menampilkan daftar produk.",
  "Jawab HANYA berdasarkan konteks toko yang diberikan di bawah.",
  "JANGAN mengarang harga, stok, jam buka, alamat, atau promo.",
  "Jika datanya tidak ada di konteks, katakan dengan jujur bahwa kamu tidak tahu dan arahkan pengguna ke WhatsApp " + WHATSAPP_SHORT + ".",
  "Jika pengguna ingin bicara dengan manusia, arahkan ke WhatsApp yang sama.",
  "Jangan pernah mengaku sebagai manusia.",
].join(" ");

const FALLBACK_REPLY =
  "Maaf, saya belum bisa menjawab pertanyaan itu. Saya bisa membantu soal produk terlaris, harga dan stok produk, cara pembayaran, atau cara memakai aplikasi TokoPintar. " +
  "Untuk bantuan lebih lanjut, silakan hubungi kami via WhatsApp: " + WHATSAPP_SHORT;

const STOPWORDS = new Set([
  "yang", "dan", "untuk", "dengan", "berapa", "harga", "stok", "produk",
  "saya", "mau", "tanya", "cek", "ada", "tidak", "apakah", "tolong", "kak",
  "min", "apa", "itu", "ini", "dari", "atau", "saja", "dong", "ya", "bang",
  "berapa", "harganya", "stoknya", "namanya", "katalog", "jual",
]);

function formatRupiah(amount) {
  return "Rp" + Number(amount).toLocaleString("id-ID");
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

async function getTopProducts(pool, limit = 5) {
  const rows = await pool.query(
    "SELECT ti.product_id AS productId, ti.name AS name, p.price AS price, p.stock AS stock, SUM(ti.qty) AS sold " +
      "FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id " +
      "LEFT JOIN products p ON p.id = ti.product_id " +
      "WHERE t.status = ? GROUP BY ti.product_id, ti.name, p.price, p.stock " +
      "ORDER BY sold DESC LIMIT ?",
    ["Selesai", limit]
  );
  return rows[0];
}

async function searchProducts(pool, words) {
  const conditions = words.map(() => "name LIKE ?").join(" OR ");
  const params = words.map((word) => "%" + word + "%");
  const rows = await pool.query(
    "SELECT id, name, category, emoji, price, stock FROM products WHERE " + conditions + " ORDER BY name LIMIT 5",
    params
  );
  return rows[0];
}

async function getCategories(pool) {
  const rows = await pool.query("SELECT DISTINCT category FROM products ORDER BY category");
  return rows[0].map((row) => row.category);
}

function contentWords(text) {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

function topProductsText(products) {
  if (!products || products.length === 0) {
    return "Belum ada data penjualan untuk menentukan produk terlaris.";
  }
  const lines = products.map((product, index) => {
    const price = product.price != null ? " — " + formatRupiah(product.price) : "";
    const sold = product.sold != null ? " (terjual " + Number(product.sold).toLocaleString("id-ID") + ")" : "";
    return index + 1 + ". " + product.name + price + sold;
  });
  return "Produk terlaris di TokoPintar:\n" + lines.join("\n");
}

function productDetailText(product) {
  const stockNote =
    product.stock === 0
      ? " Saat ini stoknya habis."
      : product.stock <= 5
        ? " Stok menipis, segera restock."
        : "";
  return (
    product.name +
    (product.category ? " (" + product.category + ")" : "") +
    " — harga " + formatRupiah(product.price) +
    ", stok tersedia " + product.stock + "." +
    stockNote
  );
}

async function answerFromKb(pool, message) {
  const text = normalize(message);

  if (/^(halo|hai|hei|hi|hello|selamat pagi|selamat siang|selamat sore|selamat malam|assalamualaikum|permisi|pagi|siang|sore|malam)\b/.test(text)) {
    return {
      reply:
        "Halo! Saya Asisten TokoPintar. Saya bisa membantu cek harga dan stok produk, melihat produk terlaris, atau menjelaskan cara pembayaran dan cara memakai aplikasi. Ada yang bisa saya bantu?",
      source: "kb",
    };
  }

  if (containsAny(text, ["whatsapp", "wa ", "hubungi", "kontak", "admin", "manusia", "customer service", "bicara dengan", "telepon", "cs toko"])) {
    return {
      reply: "Silakan hubungi kami via WhatsApp di " + WHATSAPP_SHORT + " — tim kami akan membantu Anda.",
      source: "kb",
    };
  }

  if (containsAny(text, ["jam buka", "jam tutup", "buka jam", "alamat", "lokasi toko", "dimana toko", "di mana toko"])) {
    return {
      reply:
        "Maaf, saya tidak punya informasi jam buka atau alamat toko ini. Silakan hubungi kami via WhatsApp agar dibantu langsung: " + WHATSAPP_SHORT,
      source: "kb",
    };
  }

  if (containsAny(text, ["bayar", "pembayaran", "qris", "tunai", "transfer", "kartu debit", "kartu kredit", "dana", "ovo", "gopay", "e wallet"])) {
    return {
      reply:
        "TokoPintar menerima pembayaran " + PAYMENT_METHODS.join(", ") + ". Pembayaran dipilih saat kasir menyelesaikan transaksi di aplikasi.",
      source: "kb",
    };
  }

  if (containsAny(text, ["cara memesan", "cara order", "cara beli", "cara belanja", "gimana pesan", "bagaimana pesan", "checkout", "memesan", "order"])) {
    return {
      reply:
        "Untuk memesan, pelanggan bisa datang langsung ke toko dan kasir akan memproses pesanannya di aplikasi kasir TokoPintar. Jika Anda pemilik toko, masuk ke aplikasi, buka menu Kasir, pilih produk, lalu selesaikan transaksi.",
      source: "kb",
    };
  }

  if (containsAny(text, ["login", "masuk aplikasi", "daftar akun", "cara pakai", "cara memakai", "cara menggunakan", "cara menggunakan aplikasi", "gimana cara", "bagaimana cara"])) {
    return {
      reply:
        "Untuk memakai TokoPintar: buka aplikasi, masuk dengan akun admin atau kasir Anda, lalu gunakan menu Kasir untuk transaksi, Produk untuk mengelola katalog, dan Laporan untuk melihat penjualan. Akun kasir dibuat oleh admin; jika Anda belum punya akun, hubungi admin toko atau WhatsApp kami: " + WHATSAPP_SHORT,
      source: "kb",
    };
  }

  if (containsAny(text, ["terlaris", "paling laku", "paling laris", "best seller", "paling banyak dibeli", "favorit", "paling dicari"])) {
    const top = await getTopProducts(pool, 5);
    return { reply: topProductsText(top), source: "kb" };
  }

  if (containsAny(text, ["kategori", "daftar kategori"]) || ["minuman", "makanan", "snack", "camilan"].includes(text)) {
    const categories = await getCategories(pool);
    if (categories.length === 0) {
      return { reply: "Belum ada kategori produk di katalog TokoPintar.", source: "kb" };
    }
    return {
      reply:
        "Kategori produk di TokoPintar: " + categories.join(", ") + ". Tulis nama produk untuk cek harga dan stoknya, misalnya \u201CKopi Susu Gula Aren\u201D.",
      source: "kb",
    };
  }

  const words = contentWords(message);
  const asksPriceOrStock = containsAny(text, ["harga", "stok", "berapa"]);
  if (asksPriceOrStock && words.length === 0) {
    return {
      reply:
        "Produk apa yang ingin dicek harganya? Tulis namanya, misalnya \u201CKopi Susu Gula Aren\u201D, \u201CMatcha Latte\u201D, atau \u201CCroissant Butter\u201D.",
      source: "kb",
    };
  }
  if (words.length > 0 && (asksPriceOrStock || text.includes("produk") || text.includes("cek"))) {
    const matches = await searchProducts(pool, words);
    // Cocok kuat = nama produk mengandung SEMUA kata kunci. Cocok sebagian
    // hanya ditawarkan sebagai saran, bukan disajikan sebagai jawaban.
    const scored = matches.map((product) => ({
      product,
      score: words.filter((word) => normalize(product.name).includes(word)).length,
    }));
    const strong = scored.filter((item) => item.score === words.length).map((item) => item.product);
    const partial = scored.filter((item) => item.score > 0 && item.score < words.length).map((item) => item.product);
    if (strong.length === 1) {
      return { reply: productDetailText(strong[0]), source: "kb" };
    }
    if (strong.length > 1) {
      const lines = strong.map((product, index) => index + 1 + ". " + product.name + " — " + formatRupiah(product.price));
      return {
        reply: "Saya menemukan beberapa produk yang cocok:\n" + lines.join("\n") + "\nTulis nama produk yang lebih lengkap untuk detail harga dan stoknya.",
        source: "kb",
      };
    }
    if (partial.length > 0) {
      const lines = partial.map((product, index) => index + 1 + ". " + product.name + " — " + formatRupiah(product.price));
      return {
        reply: "Saya tidak menemukan produk dengan nama itu. Mungkin maksud Anda:\n" + lines.join("\n"),
        source: "kb",
      };
    }
    if (asksPriceOrStock) {
      return {
        reply:
          "Maaf, saya tidak menemukan produk dengan nama itu di katalog TokoPintar. Coba tulis nama produknya dengan lebih lengkap, atau hubungi kami via WhatsApp: " + WHATSAPP_SHORT,
        source: "kb",
      };
    }
  }

  return null;
}

function buildAiContext(topProducts) {
  const lines = [
    "Toko: TokoPintar — aplikasi kasir POS. Pembayaran yang diterima: " + PAYMENT_METHODS.join(", ") + ".",
    "Kontak bantuan: WhatsApp " + WHATSAPP_SHORT + ".",
  ];
  if (topProducts && topProducts.length > 0) {
    lines.push("5 produk terlaris (berdasarkan penjualan):");
    topProducts.forEach((product, index) => {
      const price = product.price != null ? formatRupiah(product.price) : "harga tidak tersedia";
      const stock = product.stock != null ? "stok " + product.stock : "stok tidak tersedia";
      const sold = product.sold != null ? ", terjual " + Number(product.sold).toLocaleString("id-ID") : "";
      lines.push(index + 1 + ". " + product.name + " — " + price + ", " + stock + sold);
    });
  } else {
    lines.push("Data produk terlaris tidak tersedia saat ini.");
  }
  return lines.join("\n");
}

async function answerFromAi(pool, message) {
  const apiKey = process.env.SAMUDRA_API_KEY;
  if (!apiKey || typeof fetch !== "function") return null;
  let topProducts = [];
  try {
    topProducts = await getTopProducts(pool, 5);
  } catch (error) {
    console.error("Chatbot: gagal memuat produk terlaris untuk konteks AI:", error.message);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(SAMUDRA_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: SAMUDRA_MODEL,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\nKonteks toko:\n" + buildAiContext(topProducts) },
          { role: "user", content: message },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("Chatbot: Samudra mengembalikan HTTP " + response.status);
      return null;
    }
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || "").trim()
      : "";
    if (!reply) return null;
    return { reply: reply.slice(0, MAX_AI_REPLY_CHARS), source: "ai" };
  } catch (error) {
    console.error("Chatbot: panggilan Samudra gagal:", error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function answerChat(pool, message) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return { reply: "Silakan tulis pertanyaan Anda.", source: "fallback" };
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return { reply: "Maaf, pesan terlalu panjang (maksimal 500 karakter).", source: "fallback" };
  }

  // Mode AI dulu bila kunci tersedia; gagal/timeout -> jatuh ke KB.
  try {
    const ai = await answerFromAi(pool, text);
    if (ai) return ai;
  } catch (error) {
    console.error("Chatbot: mode AI gagal, beralih ke KB:", error.message);
  }

  try {
    const kb = await answerFromKb(pool, text);
    if (kb) return kb;
  } catch (error) {
    console.error("Chatbot: mode KB gagal:", error.message);
  }

  return { reply: FALLBACK_REPLY, source: "fallback" };
}

module.exports = {
  answerChat,
  answerFromKb,
  answerFromAi,
  getTopProducts,
  searchProducts,
  getCategories,
  buildAiContext,
  formatRupiah,
  normalize,
  WHATSAPP_URL,
  WHATSAPP_SHORT,
  SAMUDRA_MODEL,
  MAX_MESSAGE_CHARS,
  FALLBACK_REPLY,
};
