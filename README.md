# Grace Shop — Aplikasi Penjualan

Aplikasi web penjualan sederhana berbahasa Indonesia dengan dashboard analitik, kasir, katalog produk, transaksi, dan laporan.

## Menjalankan aplikasi

Perlu Node.js 18 atau lebih baru. Jalankan backend dari folder proyek:

```bash
node server.js
```

Kemudian buka <http://localhost:3000>. Data disimpan persisten di `data/store.json` (file dibuat otomatis dan tidak dimasukkan ke Git). Atur port dengan variabel `PORT`, misalnya `PORT=8080 node server.js`.

## Fitur

- Dashboard ringkasan penjualan, transaksi, nilai persediaan, tren harian, dan stok menipis.
- Kasir dengan pencarian/kategori produk, keranjang, pengaturan jumlah, dan pilihan pembayaran.
- Pengelolaan produk: tambah, edit, hapus, pencarian, filter kategori, dan ekspor CSV.
- Riwayat transaksi dengan pencarian, filter status, detail, pembatalan, serta pengembalian stok otomatis.
- Laporan pendapatan, produk terlaris, komposisi pembayaran, dan ekspor CSV.
- API backend Node.js untuk produk, checkout, transaksi, pembatalan, dan kesehatan server.
- Data contoh untuk mencoba aplikasi; perubahan disimpan di file JSON backend dan tetap ada setelah server dimulai ulang.

Backend tidak memakai database eksternal atau dependensi npm. Aplikasi ini memakai login admin: pada kunjungan pertama buat akun admin di /setup, setelah itu login di /login (kata sandi disimpan sebagai hash scrypt di data/admin.json dan sesi memakai cookie HttpOnly). Jangan mengekspos server ke jaringan publik tanpa konfigurasi keamanan yang sesuai.

## Endpoint API

- `GET /api/health` dan `GET /api/state`
- `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- `POST /api/checkout`
- `POST /api/transactions/:id/cancel`

## Login admin

Kunjungan pertama membuka /setup untuk membuat akun admin (username dan kata sandi). Setelah admin dibuat, semua halaman dan endpoint API membutuhkan login di /login. Tombol Keluar di header menghapus sesi.

## Pengujian

```bash
node --test server.test.js
```
