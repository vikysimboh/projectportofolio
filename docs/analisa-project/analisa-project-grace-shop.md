# Analisis Proyek Grace Shop — Dokumen Project Manager

> Sumber Markdown ini adalah versi yang bisa diedit dari dokumen PDF dengan judul yang sama. Sumber build resmi (HTML) ada di `.src/index.html`. Gambar merujuk ke `.src/media/`.

Dokumen Project Manager  •  Analisis Proyek

# GRACE SHOP

Point of Sale (POS) / Sistem Kasir — Web & Android
Dari Kasirku di Codespace menjadi aplikasi online 24 jam di Railway + TiDB Cloud

**Pemilik Proyek (Project Owner):** Viky Harpen Simboh
**Disusun oleh:** Project Manager — CyberKid (asisten AI)
**Tanggal dokumen:** 16 November 2026  •  **Versi:** 1.0
**Status proyek:** Live — web online di Railway, aplikasi Android (APK) selesai

- **Pendapatan seed (Selesai)**: Rp81,52 M
- **Transaksi seed**: 1.000.000
- **Biaya berjalan saat ini***: Rp0 / bln
* Biaya berjalan saat ini Rp0 selama masa trial Railway (30 hari / $5) dan paket gratis TiDB Cloud. Lihat Bab 17 Anggaran untuk biaya setelah trial. Semua angka bisnis dalam dokumen ini berasal dari data contoh (seed), bukan dari toko nyata — lihat Bab 1.4.

## Daftar Isi

| 1. Ringkasan Eksekutif | 3 |
| --- | --- |
| 2. Project Charter | 5 |
| 3. Arsitektur Sistem | 7 |
| 4. Timeline & Jadwal Proyek (Gantt) | 9 |
| 5. Work Breakdown Structure (WBS) | 11 |
| 6. Metodologi — SDLC | 12 |
| 7. Flow / Alur Kerja Sistem | 14 |
| 8. Algoritma Inti | 16 |
| 9. Database — Skema & Diagram ER | 19 |
| 10. Cuplikan Kode (Web & Android) | 23 |
| 11. Tangkapan Layar Aplikasi Web | 27 |
| 12. Aplikasi Android (Flutter) | 31 |
| 13. Dashboard Ringkasan — Angka & Grafik | 32 |
| 14. Pengujian (Testing) | 35 |
| 15. Deployment & Keamanan | 36 |
| 16. Manajemen Risiko | 38 |
| 17. Anggaran / Biaya | 39 |
| 18. Kriteria Keberhasilan (Acceptance Criteria) | 40 |
| 19. Lessons Learned & Rekomendasi | 41 |
| Lampiran A. Tautan & Repositori | 43 |
| Lampiran B. Catatan Data & Verifikasi | 44 |

### Cara membaca dokumen ini

Dokumen ini ditulis dari sudut pandang **Project Manager** untuk pemilik proyek (Viky) dan stakeholder lainnya. Bab 1–2 dan 16–19 adalah bagian manajerial: apa tujuannya, berapa biayanya, apa risikonya, dan apa yang harus dilakukan selanjutnya. Bab 3 dan 7–13 adalah bagian teknis yang membuktikan setiap klaim manajerial.

**Aturan kejujuran angka.** Semua angka bisnis (pendapatan, jumlah transaksi, produk terlaris) berasal dari **data contoh (seed)** yang dibangkitkan secara deterministik oleh skrip `seed_bigdata.js`, bukan dari transaksi toko nyata. Sumber angka: repo web `vikysimboh/projectportofolio`, repo Android `vikysimboh/grace-shop-android`, backend live Railway, dan ekspor CSV di folder `exports/` repo web.

## 1. Ringkasan Eksekutif

**Grace Shop** adalah aplikasi kasir (Point of Sale / POS) untuk toko kelontong yang dibangun oleh Viky Harpen Simboh sebagai proyek portofolio Data Analyst sekaligus produk yang bisa dipakai nyata. Aplikasi ini mengelola produk, stok, transaksi penjualan, pengguna ber-role (Admin dan Kasir), serta laporan dan analisis penjualan. Tersedia dalam dua bentuk: **aplikasi web** (dibuka lewat browser) dan **aplikasi Android** (Flutter, dipasang sebagai APK di HP).

Pada 16 November 2026 proyek ini mencapai tonggak terpentingnya: **aplikasi web berhasil online 24 jam** di Railway dengan database TiDB Cloud Serverless — tanpa kartu kredit dan tanpa biaya selama masa trial. Pada hari yang sama, **aplikasi Android selesai dibangun** dan APK-nya siap dipasang di HP Samsung Galaxy A53 5G milik Viky.

- **Pendapatan (seed, Selesai)**: Rp81,52 M — 969.929 transaksi Selesai dari 1.000.000 transaksi seed
- **Rata-rata belanja / transaksi**: Rp84.050 — 3,85 item per transaksi (seed)
- **Produk terlaris (seed)**: Kopi Susu Gula Aren — 36.882 unit terjual • Minuman 46,69% pendapatan
### 1.1 Apa yang sudah selesai

| Hasil | Status | Bukti |
| --- | --- | --- |
| Aplikasi web POS (kasir, produk, transaksi, laporan, analisis, pengguna) | **SELESAI** | Live di Railway, Bab 11 |
| Database MySQL/TiDB + seed 1.000 produk / 1.000.000 transaksi | **SELESAI** | Cluster TiDB aktif, Bab 9 |
| Dashboard Analisis & Insight + ekspor CSV (7 file) | **SELESAI** | Endpoint /api/analytics, Bab 13 |
| Landing page + login gabung (tema biru-putih) | **SELESAI** | GitHub Pages, Bab 11 |
| Hosting 24 jam (Railway + TiDB, tanpa kartu kredit) | **SELESAI** | /api/health {"status":"ok"}, Bab 15 |
| Aplikasi Android Flutter (APK ±49 MB) | **SELESAI** | Repo grace-shop-android, Bab 12 |
| Pengujian otomatis backend 4/4 & Flutter 8/8 | **SELESAI** | Diuji ulang 16 Nov 2026, Bab 14 |

## 1. Ringkasan Eksekutif (lanjutan)

### 1.2 Apa yang masih menjadi perhatian (dari kacamata PM)

- Railway masih trial (30 hari atau $5). Setelah trial habis, butuh keputusan: lanjut Railway ±$1/bulan atau pindah ke VPS lokal Rp64.000-an/bulan (lihat Bab 17).
- APK memakai kunci debug bawaan Flutter — cukup untuk HP sendiri, belum layak diunggah ke Google Play (butuh kunci rilis + App Bundle).
- Data seed vs data nyata. Dashboard saat ini menampilkan data contoh. Nilai bisnis sesungguhnya baru terlihat setelah toko memakai aplikasi ini untuk transaksi nyata.
- Domainvikyharpen.eu.org masih menunggu persetujuan manual eu.org (bisa berminggu-minggu).

### 1.3 Keputusan yang diminta dari pemilik proyek

1. Pilih rencana hosting pasca-trial: Railway berbayar atau VPS lokal (Bab 17–19).
2. Setujui atau tidak pembuatan kunci rilis Android untuk persiapan Google Play.
3. Tentukan apakah data seed dipertahankan sebagai demo, atau dibersihkan saat toko mulai transaksi nyata.

## 2. Project Charter

Charter ini adalah perjanjian kerja proyek dalam satu halaman: kenapa proyek ini ada, apa yang dikerjakan, apa yang tidak dikerjakan, dan siapa yang terlibat.

### 2.1 Latar belakang

Viky sedang membangun portofolio Data Analyst dan membutuhkan proyek ujung-ke-ujung yang nyata: bukan sekadar analisis di spreadsheet, melainkan aplikasi yang menghasilkan data, menyimpan data, lalu menganalisis datanya sendiri. Grace Shop lahir dari kebutuhan itu — awalnya bernama **Kasirku** (14 November 2026), lalu berganti nama menjadi **Grace Shop**. Aplikasi kasir dipilih karena datanya kaya untuk analisis: produk, kategori, jam transaksi, hari transaksi, metode bayar, dan perilaku belanja.

### 2.2 Tujuan bisnis

1. Portofolio: membuktikan kemampuan membangun sistem lengkap — database, backend, frontend, analisis, dan aplikasi mobile — mengikuti SDLC penuh.
2. Fungsi nyata: toko bisa mencatat penjualan, memantau stok, dan melihat laporan tanpa spreadsheet manual.
3. Insight berbasis data: menjawab pertanyaan bisnis dari data: produk apa yang paling laku, kapan jam tersibuk, kategori mana yang paling menguntungkan.
4. Online 24 jam: aplikasi bisa diakses kapan saja dari HP atau laptop, tanpa bergantung pada laptop pribadi yang menyala.

### 2.3 Ruang lingkup

| In-Scope (dikerjakan) | Out-of-Scope (tidak dikerjakan) |
| --- | --- |
| Kasir POS web + Android: keranjang, checkout, metode bayar Tunai/QRIS/Transfer/Kartu debit | Integrasi payment gateway nyata (QRIS di aplikasi hanya dicatat sebagai metode, bukan pembayaran live) |
| Manajemen produk (tambah/ubah/hapus) dan stok | Barcode scanner dan printer struk Bluetooth (belum ada di Flutter) |
| Transaksi + pembatalan (stok dikembalikan) | Manajemen supplier, pembelian stok, dan akuntansi lengkap |
| Login ber-role Admin/Kasir, sesi 24 jam | Mode offline di Android (aplikasi butuh internet) |
| Dashboard Analisis & Insight + ekspor CSV | Dashboard Power BI / Tableau (Power BI dibatalkan atas permintaan pemilik; Tableau ditunda) |
| Hosting 24 jam + database cloud gratis | Domain berbayar (yang dipakai: eu.org gratis, masih menunggu persetujuan) |

## 2. Project Charter (lanjutan)

### 2.4 Stakeholder

| Peran | Nama / Pihak | Kepentingan |
| --- | --- | --- |
| Project Owner & Developer | Viky Harpen Simboh | Pemilik keputusan, pengguna utama, portofolio karier |
| Project Manager / Asisten AI | CyberKid (Muse) | Perencanaan, eksekusi teknis, dokumentasi, monitoring |
| Pengguna Admin | Pemilik toko (Viky) | Kelola produk, pengguna, laporan, analisis |
| Pengguna Kasir | Kasir toko | Kasir cepat, lihat stok, lihat transaksi sendiri |
| Pelanggan toko | Pembeli | Transaksi tercatat benar, harga sesuai |
| Penyedia platform | Railway, TiDB Cloud, GitHub, Cloudflare | Layanan hosting/database gratis atau trial |

### 2.5 Asumsi & batasan utama

- Pemilik proyek tidak memiliki kartu kredit — semua layanan harus bisa dipakai tanpa kartu (ini memengaruhi seluruh keputusan hosting, lihat Bab 16).
- Data transaksi adalah data contoh (seed) yang dibangkitkan secara deterministik; bukan data penjualan toko nyata.
- Aplikasi berjalan di server trial (Railway) — bukan infrastruktur permanen.

## 3. Arsitektur Sistem

Sistem Grace Shop terdiri dari tiga lapisan: **klien** (browser web dan aplikasi Android), **server aplikasi** (Node.js di Railway), dan **database** (TiDB Cloud Serverless, kompatibel MySQL). Semua komunikasi memakai HTTPS dan JSON; autentikasi memakai cookie sesi.

> [Diagram: Browser Web | GitHub Pages | index.html + app.js | Aplikasi Android | Flutter (Dart) | com.vikysimboh.graceshop | Server Node.js | Railway — Trial | server.js (tanpa framework) | REST API + cookie sesi 24 jam | TiDB Cloud | Serverless STARTER ($0) | MySQL Compatible v8.5.3 | AWS Singapore • TLS wajib | HTTPS + JSON | HTTPS + JSON | MySQL/TLS | Gambar 1. Arsitektur deployment Grace Shop (disederhanakan).]

### 3.1 Alur request/response

1. Pengguna membuka aplikasi (web di GitHub Pages atau Android). Halaman landing dimuat tanpa login; halaman aplikasi meminta sesi.
2. Login: klien mengirim POST /login (JSON username + password). Server memverifikasi hash scrypt, lalu membalas dengan cookie kasirku_session (masa berlaku 24 jam).
3. Setiap request API (mis. GET /api/state) menyertakan cookie tersebut. Server memeriksa sesi di memori, memeriksa role, lalu menjalankan query ke TiDB lewat pool mysql2 (maks. 10 koneksi).
4. Respons JSON dikembalikan; frontend web merender ulang halaman, aplikasi Flutter memperbarui state layar.
5. Checkout berjalan dalam satu transaksi database (lihat Bab 8.1) sehingga stok dan transaksi tidak pernah setengah jadi.

## 3. Arsitektur Sistem (lanjutan)

### 3.2 Keputusan arsitektur dan alasannya

| Keputusan | Alasan (kacamata PM) |
| --- | --- |
| Node.js tanpa framework (modul `http` bawaan) | Dependensi minimal (hanya `mysql2`); mudah dibaca, mudah diuji, tidak ada kerentanan dari framework pihak ketiga. |
| TiDB Cloud Serverless sebagai database | Gratis, kompatibel MySQL 8, tanpa kartu kredit, TLS wajib — satu-satunya database cloud gratis yang lolos semua syarat proyek. |
| Railway sebagai server aplikasi | Trial $5 tanpa kartu kredit; deploy langsung dari GitHub; satu-satunya PaaS gratis yang berhasil setelah Oracle dan Render mentok (Bab 16). |
| Frontend web statis di GitHub Pages | Gratis, terpisah dari server aplikasi; `API_BASE` mengarahkan semua panggilan API ke Railway. |
| Flutter untuk Android | Satu basis kode untuk Android (dan iOS di masa depan); UI native yang mulus; cocok untuk kasir di HP. |
| Sesi di memori server (Map), bukan JWT | Sederhana dan cukup untuk satu server; konsekuensinya sesi hilang bila server restart (risiko tercatat, Bab 16). |

### 3.3 Inventaris komponen

| Komponen | Teknologi | Lokasi |
| --- | --- | --- |
| Frontend web | HTML + CSS + JavaScript murni (969 baris `app.js`) | GitHub Pages |
| Backend API | Node.js 24 + `mysql2` (755 baris `server.js`) | Railway |
| Modul analisis | Node.js (548 baris `analytics.js`), cache 10 menit | Railway (di dalam server) |
| Database | TiDB Serverless, MySQL Compatible v8.5.3 | AWS Singapore (ap-southeast-1) |
| Aplikasi Android | Flutter 3.35.5 + Dart 3.9.2, paket `http` + `shared_preferences` | Repo grace-shop-android, APK ±49 MB |
| Seed data besar | Node.js, PRNG mulberry32 seed 20261114 | `seed_bigdata.js` (dijalankan sekali) |

## 4. Timeline & Jadwal Proyek

Proyek berjalan cepat: dari ide menjadi aplikasi online 24 jam dan APK Android dalam **3 hari** (14–16 November 2026). Tabel dan Gantt di bawah ini mencatat fase nyata proyek, bukan rencana hipotetis.

| Fase / Tonggak | Tanggal | Jadwal | Status |
| --- | --- | --- | --- |
| Kasirku dibuat (POS web di Codespace, MySQL lokal) | 14 Nov 2026 | ███ | **SELESAI** |
| Ganti nama menjadi Grace Shop; login ber-role Admin/Kasir terverifikasi | 14–15 Nov 2026 | ████ | **SELESAI** |
| Tema OLED + redesain login; tes API 3/3 | 15 Nov 2026 | ███ | **SELESAI** |
| Analisis & dashboard Insight + ekspor CSV selesai | 15 Nov 2026 | ███ | **SELESAI** |
| Landing page publik + aplikasi pindah ke /app.html | 15 Nov 2026 | ███ | **SELESAI** |
| Landing + login digabung satu halaman (biru-putih); perbaikan logout | 16 Nov 2026 pagi | ███ | **SELESAI** |
| Hosting 24 jam: Oracle mentok → Render minta kartu → TiDB jadi → Railway live 11.40 WITA | 16 Nov 2026 | █████ | **SELESAI** |
| Admin pertama dibuat lewat /setup; semua data muncul | 16 Nov 2026, 11.52 WITA | ██ | **SELESAI** |
| Aplikasi Android Flutter selesai; APK 14.11 WITA; push ke GitHub | 16 Nov 2026 siang | ████ | **SELESAI** |
| Dokumen analisis ini (Project Manager) | 16 Nov 2026 sore | ██ | **SELESAI** |
| Uji coba APK di HP Samsung A53 oleh pemilik | 16–17 Nov 2026 | ███ | **MENUNGGU** |
| Keputusan hosting pasca-trial Railway | Sebelum 16 Des 2026 | ██████ | **RENCANA** |
| Domain vikyharpen.eu.org aktif (menunggu eu.org) | Tidak dapat dipastikan | █████ | **MENUNGGU PIHAK KETIGA** |

## 4. Timeline & Jadwal Proyek (lanjutan)

> **Catatan PM:** kecepatan 3 hari ini mungkin karena sebagian besar fondasi (database, seed, analisis) sudah dikerjakan sebelum tanggal 16 November. Yang memakan waktu paling lama pada 16 November bukanlah coding, melainkan **pencarian hosting gratis tanpa kartu kredit** — tiga penyedia dicoba (Oracle, Render, Railway) sebelum satu berhasil. Pelajaran ini dicatat di Bab 19.

### 4.1 Ketergantungan antar fase

- Hosting 24 jam bergantung pada database TiDB (dibuat dulu) dan repo GitHub (Railway deploy dari repo).
- Login di Railway bergantung pada halaman /setup karena akun admin Codespace tidak ikut pindah ke database baru.
- Aplikasi Android bergantung pada backend Railway yang live (base URL hardcode ke Railway).
- Dokumen ini bergantung pada semua fase sebelumnya — karena itu disusun terakhir.

## 5. Work Breakdown Structure (WBS)

Pembagian pekerjaan per modul, dengan hasil (deliverable) masing-masing.

| Kode | Paket Pekerjaan | Deliverable |
| --- | --- | --- |
| 1.1 | Backend — server & API | `server.js` (755 baris): 14 endpoint, sesi cookie, role-based access |
| 1.2 | Backend — koneksi database | `db.js` (72 baris): pool mysql2, dukungan TLS (DB_SSL), baca .env |
| 1.3 | Backend — modul analisis | `analytics.js` (548 baris): agregasi + cache 10 menit; endpoint /api/analytics & /api/report |
| 1.4 | Backend — ekspor CSV | `export_csv.js` (90 baris): 7 file CSV di folder `exports/` |
| 1.5 | Backend — pengujian | `server.test.js` (329 baris): 4 tes, lolos 4/4 |
| 2.1 | Frontend web — landing + login | `index.html` gabungan (hero + kartu login, tema biru-putih) |
| 2.2 | Frontend web — aplikasi POS | `app.html` + `app.js` (969 baris) + `styles.css`: Dashboard, Kasir, Produk, Transaksi, Laporan, Pengguna |
| 3.1 | Database — skema | `grace_shop_schema.sql`: 4 tabel, foreign key, indeks |
| 3.2 | Database — seed kecil (demo) | `createSeedStore()` di server.js: 9 produk, 6 transaksi (otomatis bila tabel kosong) |
| 3.3 | Database — seed besar (analisis) | `seed_bigdata.js` (225 baris): 1.000 produk, 1.000.000 transaksi; 2.850.669 baris item (3.731.713 unit pada transaksi Selesai) |
| 3.4 | Database — cadangan | Dump MySQL 256 MB (terkompresi 42,12 MB) di Google Drive, teruji pulih persis |
| 4.1 | Hosting — database cloud | Cluster TiDB grace-shop (STARTER gratis, AWS Singapore) |
| 4.2 | Hosting — server aplikasi | Layanan Railway projectportofolio (Trial), domain up.railway.app |
| 4.3 | Hosting — frontend statis | GitHub Pages https://vikysimboh.github.io/projectportofolio/ |
| 4.4 | Hosting — domain | vikyharpen.eu.org (diajukan, menunggu persetujuan eu.org) + Cloudflare |
| 5.1 | Android — aplikasi Flutter | Login, Kasir, Produk, Transaksi, Laporan; 8 tes lolos; APK ±49 MB |
| 5.2 | Android — repositori | Repo vikysimboh/grace-shop-android (36 file, commit 36b2f5a0) |
| 6.1 | Manajemen proyek | Dokumen ini: charter, timeline, risiko, anggaran, lessons learned |

> **Catatan PM:** WBS di atas disusun mundur (retrospektif) dari pekerjaan yang sudah terjadi — karena proyek ini berjalan cepat tanpa dokumen perencanaan formal di awal. Untuk pengembangan selanjutnya (Bab 19), WBS sebaiknya disusun *sebelum* pengerjaan dimulai.

## 6. Metodologi — SDLC

Proyek ini dibangun mengikuti **Software Development Life Cycle (SDLC)** penuh: Requirements → Design → Development → Testing → Deployment → Maintenance. Setiap tahap dikaitkan dengan bukti nyata di proyek ini.

### 6.1 Requirements (pengumpulan kebutuhan)

Kebutuhan dirumuskan dari dua sumber: (1) kebutuhan toko — kasir cepat, stok terpantau, laporan penjualan; (2) kebutuhan portofolio Data Analyst — sistem harus menghasilkan data yang cukup besar dan berpola untuk dianalisis. Kebutuhan kunci yang tercatat:

- Pengguna ber-role: Admin mengelola segalanya; Kasir hanya melayani penjualan dan melihat data sendiri.
- Transaksi tidak boleh membuat stok negatif dan tidak boleh setengah jadi (atomic).
- Transaksi yang dibatalkan harus mengembalikan stok.
- Analisis harus menjawab: pendapatan, produk terlaris, kategori, jam dan hari tersibuk, metode bayar.
- Hosting harus gratis dan tanpa kartu kredit (batasan pemilik proyek).
- Aplikasi harus bisa dipakai dari HP Android.

### 6.2 Design (perancangan)

- Arsitektur: tiga lapis (klien – server Node.js – database MySQL/TiDB), REST + JSON, cookie sesi (Bab 3).
- Database: 4 tabel dengan relasi foreign key (Bab 9). Produk memakai ID PRD-xxx; transaksi memakai ID unik.
- UI/UX: tema biru-putih (#2563eb), terinspirasi template Canva "Blue Modern App Landing Page" dan "Blue and White Clean Login" — dipakai sebagai inspirasi gambar, bukan menyalin template berbayar. Mode gelap dan OLED ditambahkan 15 November atas permintaan pemilik.
- Keamanan: kata sandi di-hash scrypt (bukan plaintext), sesi cookie 24 jam, proteksi role di sisi server (bukan hanya di UI).

### 6.3 Development (pengembangan)

Pengembangan dilakukan bertahap dan selalu dalam keadaan bisa dijalankan (working software): pertama POS web di Codespace dengan MySQL lokal; lalu tema dan login; lalu modul analisis dan ekspor CSV; lalu landing page; lalu migrasi hosting; terakhir aplikasi Android. Setiap tahap di-commit ke GitHub (repo `projectportofolio` dan `grace-shop-android`), sehingga riwayat perubahan terlacak. Total kode yang ditulis: ±2.988 baris di repo web (server, frontend, analisis, seed, tes) dan ±15 file Dart di repo Android.

### 6.4 Testing (pengujian)

Pengujian dilakukan di tiga lapis: tes otomatis backend (`node --test`, 4 tes), tes otomatis Flutter (8 tes), dan pengujian manual lewat UI (login Admin/Kasir, checkout, pembatalan, logout — diverifikasi pemilik proyek sendiri pada 16 November 2026). Hasil lengkap di Bab 14. Temuan pengujian yang paling berharga: **tes konkurensi** membuktikan stok tidak bisa negatif walau dua checkout berjalan bersamaan.

## 6. Metodologi — SDLC (lanjutan)

### 6.5 Deployment (penerapan)

Deployment dilakukan dua jalur: **frontend statis** ke GitHub Pages (otomatis setiap push ke branch `main`) dan **backend** ke Railway (deploy otomatis dari repo GitHub yang sama). Variabel lingkungan (kredensial TiDB) diisi lewat dashboard Railway, tidak pernah di-commit ke repo. Urutan deployment yang benar: (1) buat cluster TiDB dan database `grace_shop`; (2) buat layanan Railway dari repo; (3) isi 7 environment variable (HOST, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL); (4) verifikasi `/api/health`; (5) ubah `API_BASE` di frontend ke URL Railway dan push; (6) buat admin pertama lewat `/setup`; (7) uji login dan logout.

### 6.6 Maintenance (pemeliharaan)

Yang sudah berjalan: pemantauan lewat endpoint `/api/health`; cadangan (backup) database berupa dump MySQL yang teruji pulih; perbaikan bug logout (dua kali iterasi pada 16 November, diverifikasi pemilik: "Aman udah benar"). Yang masih harus dijadwalkan:

- Sebelum 16 Desember 2026: putuskan hosting pasca-trial Railway (Bab 17).
- Rutin: cadangan database berkala — perhatikan bahwa alat cadangan lama (rclone) memakai client_id bersama yang akan pensiun selama 2026, jadi perlu client_id sendiri sebelum cadangan berikutnya.
- Keamanan: ganti kunci debug APK dengan kunci rilis sebelum distribusi luas; rotasi kredensial bila ada kebocoran.
- Performa: perpindahan halaman web masih memuat ulang /api/state (±1,5 MB, ±60 detik pada koneksi lambat) — kandidat perbaikan berikutnya.

> **Penilaian PM atas SDLC:** keenam tahap benar-benar dijalankan dan dapat dibuktikan (bukan sekadar klaim). Kelemahannya: tahap Requirements dan Design tidak didokumentasikan formal di awal — dokumen ini dibuat belakangan untuk menutup celah itu. Untuk proyek berikutnya, charter dan desain sebaiknya ditulis sebelum coding dimulai.

## 7. Flow / Alur Kerja Sistem

### 7.1 Login dan pembuatan admin pertama

1. Pengguna membuka aplikasi. Bila sudah ada sesi aktif (cookie masih berlaku), langsung masuk ke /app.html.
2. Bila belum ada sesi: sistem memeriksa apakah sudah ada akun admin.
  - Sudah ada admin — tampil halaman Login. Pengguna mengisi username + password. Benar: server memberi cookie sesi 24 jam, lalu masuk ke /app.html. Salah: tampil pesan "Nama pengguna atau kata sandi salah." (HTTP 401).
  - Belum ada admin — tampil halaman /setup "Buat akun admin". Setelah username + password diisi, akun admin pertama dibuat dan pengguna langsung login.

Alur ini penting karena menjelaskan insiden nyata pada 16 November 2026: pemilik tidak bisa login di Railway bukan karena kata sandinya salah, melainkan karena **belum ada akun admin sama sekali** di database TiDB yang baru. Solusinya adalah membuka `/setup` dan membuat admin pertama — setelah itu login berhasil.

### 7.2 Kasir / checkout

1. Kasir mencari produk (pencarian teks / filter kategori) lalu menambahkannya ke keranjang; jumlah dibatasi stok yang tersedia.
2. Kasir mengisi nama pelanggan (opsional; default "Pelanggan umum") dan memilih metode bayar: Tunai, QRIS, Transfer, atau Kartu debit.
3. Kasir menekan "Selesaikan transaksi". Server memvalidasi item dan stok, lalu menjalankan seluruh proses dalam satu transaksi database (Bab 8.1): stok berkurang, transaksi tersimpan dengan status Selesai, dan keranjang dikosongkan.
4. Kasir melihat konfirmasi beserta nomor transaksi (format TRX-...).

**Diagram alir visual:** alur kasir di atas juga digambarkan sebagai diagram pada Gambar 1 (Bab 3) untuk arsitektur, dan pseudocode lengkapnya ada di Bab 8.1. Diagram flowchart grafis (SVG) untuk alur checkout ditampilkan di bawah sebagai ringkasan visual.

> [Diagram: Pilih produk | + keranjang | Metode bayar | Tunai / QRIS / dll | Validasi + kunci | stok (FOR UPDATE) | Commit | stok -qty, TRX Selesai | Bila validasi gagal (stok kurang / produk tidak ada): ROLLBACK, tidak ada perubahan apa pun. | Gambar 1b. Flowchart checkout — dari keranjang ke transaksi tersimpan.]

## 7. Flow / Alur Kerja Sistem (lanjutan)

### 7.3 Produk, transaksi, dan laporan

- Produk (Admin): tambah produk baru → ID otomatis PRD-xxxx; ubah nama/kategori/harga/stok; hapus produk — ditolak bila produk pernah masuk transaksi (aturan integritas di server, bukan hanya di UI).
- Transaksi: daftar transaksi terbaru (maks. 200 di state, halaman transaksi memakai limit/offset); klik untuk detail item; cari berdasarkan ID/pelanggan.
- Pembatalan (Admin): transaksi Selesai → status Dibatalkan → stok tiap item dikembalikan → tidak bisa dibatalkan dua kali.
- Laporan & Analisis (Admin): ringkasan 7/30/90 hari, produk terlaris, metode bayar, penjualan harian/bulanan, tren per jam dan per hari; ekspor CSV 7 file.
- Pengguna (Admin): tambah pengguna Kasir/Admin baru; daftar pengguna.
- Logout: sesi dihapus di server dan cookie dihapus di klien; kembali ke halaman landing/login. Sesi juga berakhir otomatis setelah 24 jam.

## 8. Algoritma Inti

Bagian ini menjelaskan cara kerja algoritma terpenting dengan pseudocode yang mengikuti kode nyata di `server.js`, `analytics.js`, dan `seed_bigdata.js`. Kompleksitas dinyatakan untuk ukuran input yang relevan.

### 8.1 Checkout dan pengurangan stok (doCheckout)

Checkout adalah operasi paling kritis: uang, stok, dan catatan transaksi harus berubah bersamaan atau tidak sama sekali. Karena itu seluruh proses dibungkus dalam **satu transaksi database** dengan kunci baris (`SELECT ... FOR UPDATE`).

```
// POST /api/checkout — server.js, fungsi doCheckout(body)
FUNGSI checkout(body):
  validasi metode bayar ∈ {Tunai, QRIS, Transfer, Kartu debit}
  validasi 1 ≤ jumlah item ≤ 100; tiap qty bilangan bulat > 0
  gabung item berulang per produk (Map productId → qty total)

  MULAI TRANSAKSI DATABASE
    kunci baris produk: SELECT ... FROM products WHERE id IN (...) FOR UPDATE
    JIKA ada produk tidak ditemukan → BATAL (404), rollback
    JIKA ada stok < qty → BATAL (409 "Stok ... tidak mencukupi"), rollback
    total = Σ (harga_produk × qty)          // harga diambil dari DB, bukan dari klien
    id_transaksi = "TRX-" + 8 digit akhir timestamp + "-" + 2 byte acak (hex)
    INSERT INTO transactions (..., status = 'Selesai')
    INSERT INTO transaction_items (satu baris per produk)
    UNTUK tiap produk: UPDATE products SET stock = stock - qty
  COMMIT; kembalikan transaksi
  JIKA error apa pun: ROLLBACK; lempar error
```

**Mengapa aman:** (1) `FOR UPDATE` mengunci baris produk selama transaksi, sehingga dua kasir yang checkout produk yang sama secara bersamaan akan antre — stok tidak bisa negatif; tes konkurensi di Bab 14 membuktikannya. (2) Harga diambil dari database, bukan dari request klien — kasir nakal tidak bisa mengubah harga lewat aplikasi. (3) Semua perubahan di-commit bersamaan; bila satu langkah gagal, rollback mengembalikan semuanya. **Kompleksitas:** O(n) untuk n item dalam keranjang (maks. 100), plus O(1) kunci baris per produk.

### 8.2 Pembatalan transaksi dan pengembalian stok (doCancel)

```
// POST /api/transactions/:id/cancel (Admin) — server.js, fungsi doCancel(id)
FUNGSI batalkan(id_transaksi):
  MULAI TRANSAKSI DATABASE
    kunci baris transaksi: SELECT ... WHERE id = ? FOR UPDATE
    JIKA tidak ditemukan → BATAL (404), rollback
    JIKA status sudah "Dibatalkan" → BATAL (409), rollback   // tidak bisa batal 2×
    ambil semua item transaksi
    UPDATE transactions SET status = 'Dibatalkan'
    UNTUK tiap item: UPDATE products SET stock = stock + qty  // stok kembali
  COMMIT; kembalikan transaksi (status Dibatalkan)
  JIKA error: ROLLBACK
```

Transaksi yang dibatalkan **tidak dihapus** — statusnya berubah dan jejak auditnya tetap ada. Laporan pendapatan hanya menghitung transaksi berstatus `Selesai`, sehingga pembatalan otomatis mengoreksi angka tanpa menghapus riwayat.

## 8. Algoritma Inti (lanjutan)

### 8.3 Analytics — agregasi dan cache

Modul `analytics.js` hanya membaca database (SELECT). Satu pemanggilan `getCachedAnalytics()` menjalankan ±10 query agregasi, antara lain: ringkasan per periode (semua / 30 hari / 7 hari + periode sebelumnya untuk perbandingan), produk terlaris, per kategori, per bulan, per jam, per hari dalam seminggu, dan stok (total nilai persediaan, habis, menipis ≤5 dan ≤10).

```
// analytics.js — getCachedAnalytics() dengan TTL 10 menit
FUNGSI getAnalytics():
  JIKA cache ada DAN (sekarang - waktu_cache) < 10 menit:
      KEMBALIKAN cache                       // tanpa query ke database
  JALANKAN query agregasi (COUNT, SUM, AVG, GROUP BY)
  SIMPAN hasil ke cache + catat waktu
  KEMBALIKAN hasil

TIDAK ADA invalidasi: FUNGSI clearAnalyticsCache() memang ada di
analytics.js, tetapi TIDAK PERNAH dipanggil dari server.js — checkout,
batal, dan ubah produk TIDAK menghapus cache. Angka analytics bisa
tertinggal hingga 10 menit (TTL) setelah transaksi baru.
```

**Contoh agregasi (produk terlaris):**

```
SELECT p.id AS sku, p.name, p.category, p.price,
       SUM(ti.qty) AS sold, SUM(ti.qty * ti.price) AS revenue
FROM transaction_items ti JOIN products p ON p.id = ti.product_id
JOIN transactions t ON t.id = ti.transaction_id
WHERE t.status = 'Selesai'
GROUP BY p.id, p.name, p.category, p.price
ORDER BY sold DESC
```

**Kompleksitas:** agregasi memakai indeks (`idx_items_product`, `idx_transactions_date/status`) sehingga GROUP BY tidak memindai seluruh tabel tanpa arah; cache 10 menit membuat dashboard yang dibuka berulang kali tidak membebani database. Kelemahan yang jujur: (1) cache di memori server — restart server menghapus cache (tidak masalah, cache dibangun ulang pada request pertama); (2) cache **tidak diinvalidasi** saat checkout/pembatalan/ubah produk — fungsi `clearAnalyticsCache()` ada di `analytics.js` tetapi tidak pernah dipanggil dari `server.js`, jadi dashboard Analisis & Insight bisa menampilkan angka hingga 10 menit tertinggal setelah transaksi baru.

## 8. Algoritma Inti (lanjutan)

### 8.4 Seed data deterministik (mulberry32)

Data contoh 1.000.000 transaksi dibangkitkan oleh `seed_bigdata.js` memakai PRNG **mulberry32** dengan seed tetap `20261114` — artinya siapa pun yang menjalankan skrip ini mendapat dataset yang **persis sama**. Pola yang dimodelkan: bobot jam (puncak 08.00 dan 17.00), akhir pekan lebih ramai, akhir bulan lebih ramai, metode bayar berbobot (QRIS 40%, Tunai 30%, Transfer 20%, Kartu debit 10%), harga per kategori, dan 1.000 produk unik (nama dasar × varian). Jumlah baris item per transaksi 2–4 (bobot 40/35/25 → rata-rata 2,85) dan qty 1–3 per baris (70/25/5 → rata-rata 1,35), sehingga rata-rata 3,85 unit per transaksi. Perlu dibedakan: 'baris item' (COUNT(*) `transaction_items` ≈ 2.850.669) dan 'unit terjual' (Σ qty ≈ 3.731.713 pada transaksi Selesai) — lihat Lampiran B.2. Penulisan memakai batch 5.000 baris per INSERT agar cepat. **Kompleksitas:** O(N) untuk N transaksi, memori O(1) per batch.

```
// seed_bigdata.js — inti PRNG (disederhanakan)
FUNGSI mulberry32(seed):
  a = seed
  KEMBALIKAN FUNGSI acak():
    a = (a + 0x6D2B79F5) mod 2^32
    t = (a XOR (a >>> 15)) * (1 | a)
    t = (t + (t XOR (t >>> 7)) * (61 | t)) XOR t
    KEMBALIKAN ((t XOR (t >>> 14)) mod 2^32) / 2^32

acak = mulberry32(20261114)   // seed tetap → hasil dapat diulang
```

### 8.5 Autentikasi sesi cookie + hash kata sandi

Kata sandi tidak pernah disimpan apa adanya. Saat akun dibuat, `hashPassword()` membangkitkan salt acak 16 byte, lalu menghitung **scrypt** (N=16384, r=8, p=1, output 64 byte) dan menyimpan `salt:hash` dalam bentuk heksadesimal. Saat login, `verifyPassword()` menghitung ulang scrypt dengan salt yang sama dan membandingkan dengan `timingSafeEqual` (tahan terhadap serangan timing). Sesi dibuat sebagai token acak yang disimpan di memori server (Map) bersama username, role, dan waktu kedaluwarsa (24 jam), lalu dikirim sebagai cookie `kasirku_session`. Setiap request API memeriksa cookie itu; sesi yang kedaluwarsa atau tidak dikenal ditolak 401.

### 8.6 Kontrol akses berbasis role (RBAC)

Setiap endpoint sensitif memanggil `requireRole(session, response, roles)` di sisi server. Aturannya: **Admin** boleh semuanya; **Kasir** hanya boleh checkout, melihat state/produk/transaksi, dan logout — endpoint tambah/ubah/hapus produk, batalkan transaksi, kelola pengguna, dan analytics mengembalikan **403** untuk kasir. Penting: proteksi ini ada di server, bukan hanya menyembunyikan tombol di UI — tes otomatis (Bab 14) membuktikan kasir yang memanggil API admin langsung tetap ditolak.

## 9. Database — Skema & Diagram ER

Database `grace_shop` memakai MySQL 8 / TiDB (kompatibel MySQL 8.5.3), mesin InnoDB, charset `utf8mb4`. Skema dibuat otomatis saat server pertama kali jalan (`ensureSchema()` membaca `grace_shop_schema.sql`). Ada **4 tabel**.

### 9.1 Tabel products

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | VARCHAR(20) | Primary key. Format PRD-001 (seed kecil) atau PRD-xxxxxxxx (produk baru, dari `crypto.randomBytes`) |
| name | VARCHAR(60) | Nama produk, wajib diisi |
| category | VARCHAR(40) | Minuman / Makanan / Snack — terindeks (`idx_products_category`) |
| emoji | VARCHAR(12) | Ikon produk (bukan foto), default '' |
| price | DECIMAL(12,2) | Harga satuan (Rupiah) |
| stock | INT | Stok saat ini; dikurangi saat checkout, ditambah saat batal |
| created_at | DATETIME | Default CURRENT_TIMESTAMP |

### 9.2 Tabel transactions

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | VARCHAR(40) | Primary key. Format TRX-<8 digit waktu>-<2 byte acak> |
| customer | VARCHAR(100) | Nama pelanggan, default "Pelanggan umum" |
| date | DATETIME | Waktu transaksi — terindeks (`idx_transactions_date`) |
| total | DECIMAL(15,2) | Total bayar (dihitung server dari harga DB) |
| payment | ENUM | Tunai / QRIS / Transfer / Kartu debit |
| status | ENUM | Selesai / Dibatalkan — terindeks (`idx_transactions_status`) |

## 9. Database — Skema & Diagram ER (lanjutan)

### 9.3 Tabel transaction_items

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT | Primary key |
| transaction_id | VARCHAR(40) | FK → transactions.id, ON DELETE CASCADE, terindeks |
| product_id | VARCHAR(20) | FK → products.id, ON DELETE RESTRICT, terindeks |
| name | VARCHAR(60) | Nama produk *saat transaksi* (snapshot — tetap benar walau produk diubah namanya) |
| price | DECIMAL(12,2) | Harga satuan *saat transaksi* (snapshot — tetap benar walau harga berubah) |
| qty | INT | Jumlah unit |

### 9.4 Tabel users

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | INT AUTO_INCREMENT | Primary key |
| username | VARCHAR(64) | Unik (`uq_users_username`) |
| password_hash | VARCHAR(200) | Format `salt:hash` scrypt (heksadesimal, 32 + 128 karakter) |
| role | ENUM | admin / kasir (default kasir) — terindeks |
| created_at | DATETIME | Default CURRENT_TIMESTAMP |

## 9. Database (lanjutan)

### 9.5 Diagram ER

> [Diagram: products | PK id VARCHAR(20) | name, category, emoji | price DECIMAL(12,2) | stock INT | transactions | PK id VARCHAR(40) | customer, date, total | payment ENUM | status ENUM | transaction_items | PK id BIGINT AUTO_INCREMENT | FK transaction_id → transactions | FK product_id → products | name, price (snapshot), qty | users | PK id • username UNIQUE • role | 1 – N | 1 – N | users berdiri sendiri (tidak berelasi ke transaksi — transaksi tidak mencatat kasir).]

### 9.6 Relasi dan aturan integritas

- products 1–N transaction_items: satu produk bisa muncul di banyak item transaksi. Menghapus produk yang pernah terjual ditolak oleh foreign key ON DELETE RESTRICT dan oleh validasi di server (409).
- transactions 1–N transaction_items: satu transaksi berisi banyak item. Menghapus transaksi (tidak dilakukan aplikasi) akan menghapus itemnya (ON DELETE CASCADE).
- Snapshot harga/nama di transaction_items membuat laporan historis tetap benar walau produk diubah harga atau namanya kemudian — keputusan desain yang penting untuk analisis.
- users tidak berelasi ke transaksi: transaksi tidak mencatat siapa kasirnya. Ini keterbatasan yang dicatat untuk pengembangan selanjutnya (Bab 19).

## 9. Database (lanjutan)

### 9.7 Ukuran data seed

| Tabel | Baris (seed besar) | Catatan |
| --- | --- | --- |
| products | 1.000 | Nama unik (dasar × varian), 3 kategori |
| transactions | 1.000.000 | ±969.929 Selesai + ±30.071 Dibatalkan (dari ekspor harian: total Selesai 969.929) |
| transaction_items | 2.850.669 | Jumlah baris (COUNT(*)) — angka yang dicetak skrip seed setelah generate. Unit terjual pada transaksi *Selesai*: 3.731.713 (Σ qty, dihitung dari ekspor CSV repo); rata-rata 3,85 unit per transaksi Selesai (2,85 baris × 1,35 unit per baris). Lihat Lampiran B.2. |
| users | — | Dibuat manual lewat /setup atau menu Pengguna; tidak termasuk seed |

### 9.8 Contoh baris (data seed kecil — demo)

| Tabel | Contoh baris |
| --- | --- |
| products | PRD-001 / Kopi Susu Gula Aren / Minuman / 18000 / 32 |
| transactions | TRX-24110801 / Nadia Putri / 2026-11-16 08:xx / 58000 / Tunai / Selesai |
| transaction_items | … / TRX-24110801 / PRD-001 / Kopi Susu Gula Aren / 18000 / 2 |
| users | 1 / admin / <salt:hash scrypt> / admin |

## 10. Cuplikan Kode (Web & Android)

Semua cuplikan di bawah ini adalah **kode nyata** dari repositori proyek (bukan karangan), dipotong seperlunya dengan penjelasan singkat.

### 10.1 server.js — hash kata sandi (scrypt)

```
// server.js — fungsi hashPassword & verifyPassword
function hashPassword(password) {
  const salt = crypto.randomBytes(16);                       // salt acak 16 byte
  const hash = crypto.scryptSync(password, salt, 64, {      // scrypt: N=16384, r=8, p=1
    N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return salt.toString("hex") + ":" + hash.toString("hex"); // simpan "salt:hash"
}
function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64,
    { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
```

**Penjelasan:** scrypt adalah fungsi hash yang sengaja lambat dan boros memori — serangan brute-force menjadi mahal. `timingSafeEqual` membandingkan hash dalam waktu yang sama untuk semua input, sehingga penyerang tidak bisa menebak kata sandi dari perbedaan waktu respons.

### 10.2 server.js — sesi dan proteksi role

```
// server.js — pembuatan sesi saat login berhasil (disederhanakan)
const token = crypto.randomBytes(24).toString("hex");   // token sesi acak 48 karakter
sessions.set(token, {
  userId: user.id, username: user.username, role: user.role,
  expiresAt: Date.now() + SESSION_TTL_MS,               // 24 jam (86.400.000 ms)
});
setCookie(response, "kasirku_session", token,
  { maxAge: 86400, sameSite: "None", secure: true });   // Secure + SameSite=None
                                                        // agar login lintas situs
                                                        // (GitHub Pages → Railway) bekerja

// Pemeriksaan role sebelum tindakan sensitif
function requireRole(session, response, roles) {
  if (!roles.includes(session.role)) {
    sendJson(response, 403, { error: "Akses ditolak. Peran Anda tidak memiliki izin untuk tindakan ini." });
    return false;
  }
  return true;
}
```

## 10. Cuplikan Kode (lanjutan)

### 10.3 db.js — koneksi database dengan TLS

```
// db.js — pool koneksi mysql2 (disederhanakan)
function createPool(config) {
  return mysql.createPool({
    host: config.host, port: config.port, user: config.user,
    password: config.password, database: config.database,
    waitForConnections: true, connectionLimit: 10,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    // DB_SSL=1 wajib diaktifkan untuk TiDB Cloud (TLS wajib)
  });
}
```

**Penjelasan:** pool 10 koneksi melayani semua request; bila koneksi habis, request antre (`waitForConnections`). Kredensial dibaca dari environment variable (`.env` di lokal, dashboard Railway di production) — tidak pernah ditulis di kode.

## 10. Cuplikan Kode (lanjutan)

### 10.4 app.js — login dari frontend web

```
// app.js — login memakai fetch JSON dengan credentials (disederhanakan)
async function handleLogin(event) {
  event.preventDefault();
  const payload = { username, password };
  const res = await fetch(API_BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",        // kirim + simpan cookie lintas situs
  });
  if (res.ok) { window.location.href = "app.html"; return; }
  showLoginError("Nama pengguna atau kata sandi salah.");
}
```

**Penjelasan:**`credentials: "include"` adalah kunci agar cookie sesi dari Railway tersimpan di browser saat halaman dibuka dari GitHub Pages. Tanpa ini login tampak berhasil tetapi sesi langsung hilang. Server membalas JSON bila request meminta JSON, dan redirect bila request berasal dari form biasa — dua jalur yang sama-sama didukung.

### 10.5 api.dart — klien HTTP Flutter

```
// lib/services/api.dart — GraceShopApi (disederhanakan dari kode nyata)
class GraceShopApi {
  static const String baseUrl =
      'https://projectportofolio-production.up.railway.app'; // backend Railway
  String? _cookie;                    // cookie sesi disimpan di memori +
                                      // SharedPreferences (kunci 'session_cookie')

  // Ambil pasangan "kasirku_session=<token>" dari header Set-Cookie.
  Future<void> _saveCookie(String? setCookieHeader) async {
    if (setCookieHeader == null) return;
    final match =
        RegExp(r'kasirku_session=[^;]+').firstMatch(setCookieHeader);
    if (match == null) return;
    _cookie = match.group(0);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('session_cookie', _cookie!);  // sesi bertahan walau
  }                                                     // aplikasi ditutup (maks. 24 jam)

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    if (_cookie != null) headers['Cookie'] = _cookie!;
    return headers;
  }
}
```

**Penjelasan:** Flutter tidak memakai cookie jar otomatis seperti browser, jadi `api.dart` mengambil cookie dari header `Set-Cookie` secara manual (regex/pemisah `;`) dan menyimpannya lewat `shared_preferences`. Saat aplikasi dibuka lagi, cookie dipulihkan dan sesi diperiksa lewat `GET /api/me` — bila masih berlaku, pengguna langsung masuk tanpa login ulang.

## 10. Cuplikan Kode (lanjutan)

### 10.6 app.js — pemuatan state aplikasi web

```
// app.js — memuat seluruh state (produk, transaksi, ringkasan) sekali jalan
async function loadState() {
  const res = await fetch(API_BASE + "/api/state", { credentials: "include" });
  if (res.status === 401) { window.location.href = LANDING_URL; return; }
  state = await res.json();   // { products, transactions, summary, user }
  renderAll();                // gambar ulang Dashboard, Kasir, Produk, dst.
}
```

**Penjelasan:**`/api/state` mengembalikan ±1,5 MB (1.000 produk + 200 transaksi terbaru + ringkasan). Inilah penyebab perpindahan halaman terasa lambat (±60 detik pada koneksi lambat): setiap pindah halaman memuat ulang seluruh state. Perbaikan yang diusulkan: cache state di memori frontend dan muat per halaman (Bab 19).

## 11. Tangkapan Layar Aplikasi Web

Semua tangkapan di bab ini diambil pada **16 November 2026** dari server lokal yang menjalankan kode yang sama persis dengan yang live di Railway (repo `vikysimboh/projectportofolio`, commit yang sama). Alasan memakai lingkungan lokal: kredensial admin Railway milik pemilik proyek tidak tersedia untuk keperluan dokumentasi, dan data di TiDB tidak boleh diubah. Data yang tampak pada tangkapan lokal adalah **data seed kecil bawaan aplikasi** (9 produk, 6 transaksi) — bukan data seed 1.000.000 transaksi di Railway. Tampilan, menu, dan perilaku aplikasi identik dengan versi live.

### 11.1 Landing page dan login

![Landing page dan login Grace Shop](.src/media/01-landing-login.png)

*Gambar 2. Landing page + login Grace Shop (tema biru-putih). Kiri: hero, 6 produk unggulan, fitur, kategori. Kanan: kartu login. Tangkapan dari server lokal dengan file `index.html` yang identik dengan GitHub Pages. URL live: https://vikysimboh.github.io/projectportofolio/*

## 11. Tangkapan Layar (lanjutan)

### 11.1b Halaman setup admin pertama

![Halaman setup admin pertama Grace Shop](.src/media/02-setup.png)

*Gambar 2b. Halaman /setup "Buat akun admin" — dipakai saat database baru belum memiliki akun admin sama sekali (kejadian nyata di Railway, 16 November 2026). Tangkapan lingkungan lokal.*

### 11.2 Dashboard

![Dashboard Grace Shop](.src/media/03-dashboard.png)

*Gambar 3. Dashboard aplikasi: kartu pendapatan hari ini, transaksi hari ini, total produk, dan stok menipis; tabel produk terlaris dan transaksi terbaru. Tangkapan lingkungan lokal (data seed kecil: pendapatan hari ini Rp209.000 dari 6 transaksi) — angka pada dashboard live di Railway jauh lebih besar karena memakai data seed 1.000.000 transaksi.*

## 11. Tangkapan Layar (lanjutan)

### 11.3 Kasir

![Halaman kasir Grace Shop](.src/media/04-kasir.png)

*Gambar 4. Halaman Kasir: pencarian produk, filter kategori, keranjang belanja dengan tombol jumlah, nama pelanggan, pilihan metode bayar (Tunai / QRIS / Transfer / Kartu debit), dan tombol "Selesaikan transaksi". Tangkapan lingkungan lokal, data seed kecil.*

### 11.4 Produk

![Halaman produk Grace Shop](.src/media/04-produk.png)

*Gambar 5. Halaman Produk (Admin): tabel produk dengan SKU, kategori, harga, dan stok; tombol tambah produk, ubah, dan hapus; penanda stok habis/menipis. Tangkapan lingkungan lokal, data seed kecil.*

## 11. Tangkapan Layar (lanjutan)

### 11.5 Transaksi

![Halaman transaksi Grace Shop](.src/media/04-transaksi.png)

*Gambar 6. Halaman Transaksi: daftar transaksi dengan ID, pelanggan, tanggal, total, metode bayar, dan status; detail item per transaksi; tombol batalkan (Admin) yang mengembalikan stok. Tangkapan lingkungan lokal, data seed kecil.*

### 11.6 Laporan & Analisis

![Halaman laporan Grace Shop](.src/media/04-laporan.png)

*Gambar 7. Halaman Laporan & Analisis: ringkasan periode (7/30/90 hari) dengan perbandingan periode sebelumnya, produk terlaris, penjualan per kategori, penjualan bulanan, dan tombol ekspor CSV. Grafik garis tidak tampil di lingkungan pengujian (CDN tidak terjangkau); di versi live tampil normal. Tangkapan lingkungan lokal, data seed kecil.*

## 12. Aplikasi Android (Flutter)

Aplikasi Android dibangun dengan Flutter 3.35.5 + Dart 3.9.2, paket `com.vikysimboh.graceshop`, versi 1.0.0+1. Fitur: login (sesi tersimpan 24 jam), Kasir, Produk, Transaksi, Laporan (khusus Admin), dan logout. Backend yang dipakai adalah Railway yang sama dengan aplikasi web. APK release ±49 MB sudah dibuat pada 16 November 2026 dan kode sumbernya ada di repo `vikysimboh/grace-shop-android`.

> **Penting — status gambar di bawah:** mockup layar berikut adalah **ilustrasi yang dibuat dari kode screens Flutter** (menu, label, dan alur diambil dari kode nyata), **bukan tangkapan layar HP asli**. Tidak ada emulator Android di lingkungan ini, dan APK belum sempat dijalankan di HP saat dokumen ini ditulis. Uji coba di HP Samsung Galaxy A53 milik pemilik proyek masih menunggu.

**GRACE SHOP — LOGIN (ilustrasi)**
##### Selamat datang kembali

Masuk ke akun Grace Shop Anda.

**Nama pengguna**
[______________]

**Kata sandi**
[______________]

MASUK

**GRACE SHOP — KASIR (ilustrasi)**
##### Kasir

Cari produk...   [Minuman]

Kopi Susu Gula Aren — Rp18.000
Stok: 32   [+ Tambah]

Croissant Butter — Rp22.000
Stok: 18   [+ Tambah]

**Keranjang (2 item)**
Total: **Rp40.000**
Bayar: Tunai

SELESAIKAN TRANSAKSI

### 12.1 Arsitektur aplikasi Flutter

- State management:setState saja (tanpa Provider/Bloc) — sederhana dan cukup untuk ukuran aplikasi ini.
- Navigasi:RootScreen dengan IndexedStack + bottom navigation (Kasir / Produk / Transaksi / Laporan). Tab Laporan hanya tampil untuk Admin.
- Sesi: cookie disimpan di shared_preferences; saat aplikasi dibuka, loadSavedSession() memulihkan cookie lalu GET /api/me memeriksa keabsahannya (Bab 10.5).
- Batasan yang diketahui: tidak ada mode offline, tidak ada barcode scanner, tidak ada manajemen pengguna dari aplikasi (pengguna baru dibuat lewat web), dan APK ditandatangani kunci debug.

## 13. Dashboard Ringkasan — Angka & Grafik

Seluruh angka di bab ini berasal dari **data contoh (seed)** 12 bulan (November 2025 – Oktober 2026) yang dihitung dari ekspor CSV repo (`exports/`). Angka-angka ini membuktikan kemampuan analisis sistem, **bukan** laporan keuangan toko nyata.

- **Pendapatan (Selesai)**: Rp81,52 M — 969.929 transaksi Selesai
- **Rata-rata belanja (AOV)**: Rp84.050 — 3,85 item / transaksi
- **Total item terjual**: 3.731.713 — 1.000 produk • 3 kategori
- **Kategori terbesar**: Minuman 46,69% — Makanan 37,79% • Snack 15,51%
- **Jam tersibuk**: 17.00 WIB — 75.413 transaksi pada jam 17
- **Hari tersibuk**: Sabtu — 177.135 transaksi (Sabtu)
![Pendapatan bulanan](.src/media/chart-bulanan.png)

*Gambar 8. Pendapatan per bulan (data seed, transaksi Selesai). Total 12 bulan: Rp81.522.329.000.*

## 13. Dashboard Ringkasan (lanjutan)

![Pendapatan per kategori](.src/media/chart-kategori.png)

*Gambar 9. Pangsa pendapatan per kategori (data seed): Minuman 46,69%, Makanan 37,79%, Snack 15,51%.*

![Transaksi per jam](.src/media/chart-jam.png)

*Gambar 10. Jumlah transaksi per jam (data seed): dua puncak jelas pada jam 08.00 dan 17.00 — pola yang sengaja dimodelkan di seed (bobot jam), dan sesuai dengan jam buka toko pagi dan pulang kerja.*

## 13. Dashboard Ringkasan (lanjutan)

![Produk terlaris](.src/media/chart-produk.png)

*Gambar 11. 5 produk terlaris (data seed): Kopi Susu Gula Aren 36.882 unit, Croissant Butter 21.911 unit, Matcha Latte 18.585 unit.*

### 13.1 Insight bisnis dari data seed

- Minuman adalah tulang punggung (46,69% pendapatan). Stok dan promosi sebaiknya diprioritaskan ke kategori ini.
- Jam 17.00 adalah puncak (75.413 transaksi) diikuti jam 08.00 — jadwal kasir dan stok pagi/sore perlu diperkuat pada dua jam ini.
- Sabtu paling ramai (177.135 transaksi) — hari terbaik untuk promosi dan penambahan jam kasir.
- Kopi Susu Gula Aren terjual 36.882 unit (pendapatan Rp663.876.000) — produk andalan; kehabisan stok produk ini paling merugikan.
- Metode bayar: QRIS 40%, Tunai 30%, Transfer 20%, Kartu debit 10% (bobot pemodelan seed) — toko perlu memastikan QRIS selalu aktif.

**Catatan metodologi:** pola jam/hari/metode bayar di atas adalah hasil pemodelan seed (bobot yang ditulis di `seed_bigdata.js`), sehingga insight ini mendemonstrasikan *cara membaca dashboard*, bukan perilaku pelanggan nyata. Insight yang sesungguhnya baru bisa diambil setelah toko memakai aplikasi ini untuk transaksi nyata selama beberapa minggu.

## 14. Pengujian (Testing)

### 14.1 Hasil tes otomatis — diuji ulang 16 November 2026

| Paket tes | Cara menjalankan | Hasil |
| --- | --- | --- |
| Backend `server.test.js` (4 tes) | `npm test` di folder repo web (butuh MySQL lokal) | **4/4 lolos** |
| Flutter `flutter test` (8 tes) | `flutter test` di folder repo Android | **8/8 lolos** |
| Tes API manual (3 endpoint) | curl ke Railway: /api/health, /login salah, /api/state tanpa login | **3/3 lolos** |
| Tes analytics manual (4 skenario) | Endpoint /api/analytics + /api/report + ekspor CSV | **4/4 lolos** |

### 14.2 Apa yang diuji backend (4 tes, server.test.js)

1. Login salah ditolak 401 — memastikan kata sandi salah tidak menghasilkan sesi.
2. Login benar + sesi bekerja — membuat pengguna baru, login, lalu memakai cookie untuk membaca /api/me.
3. Kasir tidak boleh memakai endpoint Admin — kasir yang memanggil POST /api/products langsung mendapat 403 (bukti proteksi ada di server, bukan hanya di UI).
4. Konkurensi checkout — dua checkout bersamaan untuk produk yang sama dengan stok terbatas: satu berhasil, satu ditolak 409, stok akhir tidak pernah negatif.

### 14.3 Apa yang diuji Flutter (8 tes)

- 5 tes parsing model: User, Product, CartItem, TransactionItem, dan ringkasan transaksi dari JSON API.
- 3 tes smoke live terhadap Railway:/api/health OK; login dengan kata sandi salah ditolak 401; /api/state tanpa sesi ditolak 401.

### 14.4 Pengujian manual oleh pemilik proyek (16 November 2026)

- Login dari halaman landing baru — berhasil (10.12 WITA).
- Logout kembali ke landing — berhasil setelah 2 kali perbaikan (10.25 WITA, "Aman udah benar").
- Login di Railway + admin pertama via /setup — berhasil (11.52 WITA), semua data muncul di dashboard.
- Login Admin dan Kasir lewat UI — terverifikasi 15 November 2026 (akun kasiruji, kata sandi diketik pemilik sendiri).

> **Celah pengujian yang jujur dicatat:** belum ada tes beban (load test) untuk 1.000.000 baris di TiDB dari banyak pengguna bersamaan; belum ada tes keamanan penetrasi; belum ada tes UI otomatis (semua UI diuji manual). Grafik Chart.js pada dashboard lokal tidak tampil saat pengujian (CDN tidak terjangkau) — di Railway grafik tampil normal.

## 15. Deployment & Keamanan

### 15.1 Peta deployment saat ini

| Lapisan | Layanan | URL / Lokasi | Biaya |
| --- | --- | --- | --- |
| Frontend web | GitHub Pages | https://vikysimboh.github.io/projectportofolio/ | $0 |
| Backend API | Railway (Trial 30 hari / $5) | https://projectportofolio-production.up.railway.app | $0 (trial) |
| Database | TiDB Cloud Serverless STARTER | gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000 | $0 |
| Kode sumber | GitHub | vikysimboh/projectportofolio, vikysimboh/grace-shop-android | $0 |
| Domain | eu.org + Cloudflare | vikyharpen.eu.org (menunggu persetujuan) | $0 |

### 15.2 Keamanan yang sudah diterapkan

- Kata sandi di-hash scrypt (salt acak + timingSafeEqual); tidak ada kata sandi plaintext di database maupun di repo.
- Sesi cookieSameSite=None; Secure; Max-Age=86400 — cookie hanya lewat HTTPS.
- Proteksi role di server (403 untuk kasir pada endpoint Admin) — teruji otomatis.
- Query berparameter (mysql2 placeholders ?) — tahan SQL injection pada semua query utama.
- Koneksi database TLS wajib (DB_SSL) ke TiDB Cloud.
- Kredensial tidak di-commit:.env dan data/admin.json masuk .gitignore; kredensial production hanya ada di dashboard Railway.
- Validasi input server: metode bayar harus dari daftar, qty bilangan bulat > 0, item maks. 100, nama pelanggan maks. 100 karakter, total harus bilangan aman.
- Harga dari database — klien tidak bisa mengubah harga transaksi lewat request.

## 15. Deployment & Keamanan (lanjutan)

### 15.3 Keterbatasan yang jujur

- Sesi disimpan di memori server (Map) — restart server Railway membuat semua pengguna harus login ulang. Tidak ada penyimpanan sesi persisten.
- Tidak ada rate limiting pada endpoint login — login bisa dicoba berulang kali tanpa batas.
- README.md kedaluwarsa: masih mendeskripsikan arsitektur lama (penyimpanan file JSON data/store.json, hash di data/admin.json, "tidak memakai database eksternal") — kode aktual sudah MySQL + tabel users. Jangan jadikan README sebagai sumber arsitektur.
- Tidak ada HTTPS di level aplikasi — keamanan transport sepenuhnya bergantung pada Railway/Cloudflare.
- APK ditandatangani kunci debug — tidak layak distribusi publik (Google Play) sebelum kunci rilis dibuat.
- Backup Google Drive saat ini bisa dilihat siapa saja yang punya tautan (perlu dibatasi aksesnya).
- Pindah halaman lambat (±60 detik, muat ulang /api/state ±1,5 MB) — masalah performa, bukan keamanan, tapi memengaruhi pengalaman kasir.
- Transaksi tidak mencatat kasir — tidak ada jejak siapa yang melayani transaksi (lihat Bab 9.6).

## 16. Manajemen Risiko

Risiko di bawah ini adalah risiko yang **benar-benar terjadi** selama proyek, bukan risiko hipotetis. Setiap risiko dicatat dengan mitigasi dan status akhirnya.

| Risiko (yang terjadi) | Dampak | Mitigasi yang dilakukan | Status |
| --- | --- | --- | --- |
| Server Codespace mati saat idle | Aplikasi tidak bisa diakses (502); login gagal | Pindah ke hosting 24 jam: Railway + TiDB (Bab 15) | **TERATASI** |
| Oracle Cloud mentok di "Cloud Account Name"; pemilik tidak punya kartu kredit | Jalur hosting gratis Oracle tertutup | Berhenti mencoba Oracle; cari alternatif tanpa kartu (Render → Railway) | **DITUTUP** |
| Render mewajibkan kartu tersimpan (tahan $1) walau paket Free | Deploy Render tidak bisa dilanjutkan | Layanan tidak jadi dibuat, tanpa biaya; pindah ke Railway | **DITUTUP** |
| Koneksi ke TiDB dari VM sempat gagal | Pengujian lokal ke TiDB tertunda | Koneksi dari Railway berhasil; pengujian lokal memakai MySQL lokal 8.0.46 | **TERATASI** |
| Login di Railway gagal karena belum ada akun admin | Pemilik mengira kata sandinya salah | Buat admin pertama lewat `/setup`; login berhasil 11.52 WITA | **TERATASI** |
| Logout kembali ke halaman login lama, bukan landing | Pengalaman pengguna membingungkan | Dua kali perbaikan redirect (commit 81433ae, 211d97b); diverifikasi pemilik | **TERATASI** |
| APK hanya ditandatangani kunci debug | Tidak bisa diunggah ke Google Play | Didokumentasikan; cukup untuk pemakaian pribadi; kunci rilis direncanakan (Bab 19) | **TERBUKA** |
| Railway hanya trial (30 hari / $5) | Server bisa berhenti bila trial habis tanpa keputusan | Keputusan hosting pasca-trial dijadwalkan sebelum 16 Des 2026 (Bab 17) | **TERBUKA** |
| Domain eu.org belum disetujui (manual, berminggu-minggu) | Domain cantik belum bisa dipakai | Tidak ada tindakan yang bisa dilakukan; aplikasi tetap jalan di Railway/Pages | **MENUNGGU PIHAK KETIGA** |
| Alat cadangan (rclone) memakai client_id bersama yang pensiun 2026 | Cadangan berikutnya bisa gagal | Buat client_id Google sendiri sebelum cadangan berikutnya | **TERBUKA** |

> **Pola yang terlihat (catatan PM):** hampir semua risiko besar proyek ini bukan risiko teknis, melainkan **risiko akses dan pembayaran** — tidak punya kartu kredit, layanan gratis yang ternyata meminta kartu, dan layanan trial yang berbatas waktu. Pelajaran utamanya: periksa syarat pembayaran sebelum memilih teknologi.

## 17. Anggaran / Biaya

Semua angka di bawah ini sudah terverifikasi dari dashboard layanan atau sumber harga Oktober 2026 (cek ulang sebelum membeli). Tidak ada angka yang dikarang.

| Item | Biaya saat ini | Biaya setelah masa trial / ke depan |
| --- | --- | --- |
| TiDB Cloud Serverless (STARTER, AWS Singapore) | $0 / bulan (gratis) | $0 — tetap gratis selama dalam batas paket STARTER |
| GitHub (repo + Pages) | $0 | $0 |
| Cloudflare (paket Free) | $0 | $0 |
| Domain eu.org | $0 | $0 (bila disetujui) |
| Railway (Trial: 30 hari atau $5) | $0 (trial) | ±$1 / bulan (pemakaian kecil, perkiraan dari konsumsi trial — perlu verifikasi tagihan pertama) |
| Alternatif VPS lokal — Awan (2 vCPU / 4 GB) | — | ±Rp64.000 / bulan (Okt 2026; cek ulang) |
| Alternatif VPS lokal — IDCloudHost (2 vCPU / 2 GB) | — | ±Rp87.000 / bulan (Okt 2026; cek ulang) |
| Alternatif VPS lokal — Biznet Gio NEO Lite (2 vCPU / 2 GB) | — | ±Rp109.000 / bulan (Okt 2026; cek ulang) |

**Total biaya berjalan saat ini: Rp0 / bulan** (selama trial Railway). **Setelah trial bila tetap di Railway: ±$1/bulan.** Bila pindah ke VPS lokal: Rp64.000–Rp109.000/bulan (bayar via QRIS / e-wallet / transfer bank, tanpa kartu kredit). Paket deploy VPS sudah disiapkan di `workspace/your_files/grace-shop-deploy-24jam/`.

**Biaya yang tidak keluar:** Oracle Cloud (pendaftaran tidak selesai, tanpa biaya) dan Render (layanan tidak jadi dibuat, tanpa biaya). Tidak ada biaya yang terbuang selama proyek.

## 18. Kriteria Keberhasilan (Acceptance Criteria)

| Kriteria (per modul) | Status | Bukti |
| --- | --- | --- |
| Kasir: checkout mengurangi stok dan tersimpan sebagai transaksi Selesai | **LULUS** | Tes konkurensi 4/4; Bab 8.1 |
| Kasir: checkout dengan stok tidak cukup ditolak 409, stok tidak berubah | **LULUS** | Tes konkurensi; Bab 8.1 |
| Produk: Admin bisa tambah/ubah/hapus; hapus produk yang pernah terjual ditolak | **LULUS** | FK RESTRICT + validasi 409; Bab 9.6 |
| Transaksi: pembatalan mengembalikan stok dan tidak bisa dilakukan 2× | **LULUS** | doCancel + tes; Bab 8.2 |
| Login: kata sandi salah ditolak 401; sesi berlaku 24 jam | **LULUS** | Tes backend; verifikasi pemilik 16 Nov |
| Role: Kasir memanggil API Admin langsung ditolak 403 | **LULUS** | Tes backend 4/4; Bab 14.2 |
| Analisis: pendapatan, AOV, produk terlaris, jam/hari tersibuk tampil benar | **LULUS** | Angka cocok dengan CSV; Bab 13 |
| Ekspor: 7 file CSV tersedia dan cocok dengan database | **LULUS** | Folder exports/ di repo |
| Hosting: /api/health {"status":"ok"} dan login dari HP/laptop | **LULUS** | Verifikasi pemilik 11.52 WITA |
| Android: login, kasir, produk, transaksi, laporan berfungsi ke Railway | **MENUNGGU UJI HP** | APK jadi; tes Flutter 8/8; uji di HP belum dilakukan |
| Performa: pindah halaman < 5 detik | **BELUM LULUS** | ±60 detik karena muat ulang /api/state ±1,5 MB |
| Domain vikyharpen.eu.org aktif | **MENUNGGU PIHAK KETIGA** | Menunggu persetujuan manual eu.org |

## 19. Lessons Learned & Rekomendasi

### 19.1 Lessons learned

1. Periksa syarat pembayaran sebelum memilih layanan. Dua dari tiga jalur hosting gagal bukan karena teknologi, melainkan karena kartu kredit. Kriteria "tanpa kartu kredit" seharusnya menjadi filter pertama, bukan terakhir.
2. Database baru = akun baru. Migrasi database berarti semua akun pengguna harus dibuat ulang. Halaman /setup menyelamatkan proyek ini; tanpa itu login Railway tidak akan pernah berhasil.
3. Snapshot harga di item transaksi itu keputusan yang tepat. Laporan historis tetap benar walau harga produk berubah — ini yang membedakan sistem kasir yang serius dari sekadar CRUD.
4. Tes konkurensi menemukan bug yang tidak ditemukan tes biasa. Tanpa kunci baris (FOR UPDATE), dua checkout bersamaan bisa membuat stok negatif. Tes ini murah ditulisnya, mahal nilainya.
5. Dokumentasi belakangan lebih sulit daripada dokumentasi sambil jalan. Charter, timeline, dan WBS di dokumen ini disusun mundur dari pekerjaan yang sudah terjadi — jauh lebih mudah bila ditulis di awal.
6. Angka harus bisa dilacak ke sumbernya. Selama penyusunan dokumen ini ditemukan bahwa angka "2.850.669 item" dari catatan awal tidak cocok dengan ekspor CSV repo (3.731.713 item pada transaksi Selesai). Semua angka di dokumen ini sudah diverifikasi ulang ke CSV dan dilaporkan perbedaannya di Lampiran B.
7. Seed deterministik (mulberry32) adalah aset. Siapa pun bisa membangkitkan dataset yang persis sama — analisis dapat diulang dan diperiksa orang lain.

## 19. Lessons Learned & Rekomendasi (lanjutan)

### 19.2 Rekomendasi langkah selanjutnya (prioritas PM)

| # | Tindakan | Prioritas | Tenggat |
| --- | --- | --- | --- |
| 1 | Uji APK di HP Samsung A53 (login, kasir, checkout, laporan) | **Tinggi** | 17 Nov 2026 |
| 2 | Putuskan hosting pasca-trial: Railway ±$1/bulan atau VPS lokal Rp64.000-an/bulan | **Tinggi** | Sebelum 16 Des 2026 |
| 3 | Perbaiki performa pindah halaman: cache /api/state di frontend, muat per halaman (limit/offset) | **Tinggi** | Des 2026 |
| 4 | Buat kunci rilis Android + App Bundle bila ingin masuk Google Play | Sedang | Des 2026 |
| 5 | Batasi akses tautan cadangan Google Drive (saat ini siapa saja yang punya tautan bisa melihat) | Sedang | Nov 2026 |
| 6 | Buat client_id Google sendiri untuk rclone sebelum cadangan berikutnya | Sedang | Sebelum cadangan berikutnya |
| 7 | Tambah rate limiting pada endpoint login | Sedang | Des 2026 |
| 8 | Catat kasir pada transaksi (relasi users → transactions) untuk jejak audit | Sedang | Des 2026 |
| 9 | Pindahkan sesi dari memori ke database/Redis agar tidak hilang saat restart | Rendah | 2027 |
| 10 | Putuskan nasib data seed: pertahankan sebagai demo atau bersihkan saat transaksi nyata dimulai | Sedang | Saat toko mulai pakai |
| 11 | Aktifkan domain vikyharpen.eu.org (nameserver + A record) bila eu.org menyetujui | Rendah | Setelah persetujuan eu.org |
| 12 | Lanjutkan dashboard Tableau (CSV sudah siap) bila dibutuhkan untuk portofolio | Rendah | Menunggu keputusan pemilik |

> **Kesimpulan PM:** Grace Shop sudah melewati ambang "proyek selesai" — aplikasi web live 24 jam, Android selesai, analisis terbukti dengan data 1.000.000 transaksi, dan pengujian lolos. Yang tersisa adalah keputusan operasional (hosting pasca-trial, kunci rilis, nasib data seed) dan dua perbaikan kualitas (performa halaman, rate limiting). Proyek ini layak jadi portofolio utama Data Analyst — dengan catatan jujur bahwa angka bisnisnya adalah data contoh.

## Lampiran A. Tautan & Repositori

| Item | Tautan |
| --- | --- |
| Aplikasi web (live) | https://vikysimboh.github.io/projectportofolio/ |
| Backend API (Railway) | https://projectportofolio-production.up.railway.app |
| Repo web | https://github.com/vikysimboh/projectportofolio |
| Repo Android | https://github.com/vikysimboh/grace-shop-android |
| Domain (menunggu persetujuan) | https://vikyharpen.eu.org |
| Cadangan database (Drive) | https://drive.google.com/file/d/18r8TTS0T_O6OUnGdK0t9qMjWhmWpTST8/view |

### Endpoint API utama

| Endpoint | Metode | Role | Fungsi |
| --- | --- | --- | --- |
| /api/health | GET | Publik | Status server {"status":"ok"} |
| /login | POST | Publik | Login, memberi cookie sesi |
| /setup | GET/POST | Publik (bila belum ada admin) | Buat admin pertama |
| /api/me | GET | Login | Info pengguna saat ini |
| /api/state | GET | Login | Produk + transaksi + ringkasan |
| /api/products | POST | Admin | Tambah produk |
| /api/products/:id | PUT / DELETE | Admin | Ubah / hapus produk |
| /api/checkout | POST | Admin, Kasir | Checkout (transaksi DB) |
| /api/transactions | GET | Login | Daftar transaksi (limit/offset) |
| /api/transactions/:id/cancel | POST | Admin | Batalkan + kembalikan stok |
| /api/analytics | GET | Admin | Agregasi analisis (cache 10 menit) |
| /api/report | GET | Admin | Laporan ringkas per periode |
| /api/export/:type | GET | Admin | Ekspor CSV (7 jenis) |
| /api/users | GET / POST | Admin | Daftar / tambah pengguna |

## Lampiran B. Catatan Data & Verifikasi

**B.1 Sumber angka.** Semua angka bisnis di dokumen ini dihitung ulang dari ekspor CSV di folder `exports/` repo web (file `penjualan_bulanan.csv`, `penjualan_harian.csv`, `penjualan_per_jam.csv`, `kategori.csv`, `produk_kinerja.csv`) pada 16 November 2026. Hasil verifikasi: pendapatan total Rp81.522.329.000; transaksi Selesai 969.929; item terjual (Selesai) 3.731.713; AOV Rp84.050; 3,85 item/transaksi; Minuman 46,69%; Kopi Susu Gula Aren 36.882 unit; jam 17 tersibuk (75.413 transaksi); Sabtu tersibuk (177.135 transaksi).

**B.2 Dua angka 'item' yang berbeda — keduanya benar (koreksi atas hipotesis sebelumnya).** Catatan awal proyek menyebut "2.850.669 item" untuk seed 1.000.000 transaksi, sementara ekspor CSV repo menunjukkan 3.731.713 item pada transaksi Selesai. Setelah memeriksa `seed_bigdata.js` dan `analytics.js`, keduanya **benar — tetapi mengukur hal yang berbeda**: **2.850.669 adalah jumlah baris**`transaction_items` (COUNT(*), semua status) — persis angka yang dicetak skrip seed setelah generate ("Item transaksi akhir"). **3.731.713 adalah jumlah unit** (Σ `qty`) pada transaksi Selesai — cara `analytics.js` menghitung `itemsDone` (`SUM(ti.qty)`), terverifikasi dari tiga CSV (`penjualan_harian.csv`, `penjualan_bulanan.csv`, `produk_kinerja.csv` — ketiganya Σ 3.731.713). Matematikanya cocok: 2–4 baris per transaksi (bobot 40/35/25 → rata-rata 2,85 baris) × qty 1–3 per baris (70/25/5 → rata-rata 1,35 unit) = 3,85 unit per transaksi; 969.929 transaksi Selesai × 3,85 ≈ 3.731.713 (nilai harapan 3.731.802, selisih 89 adalah variasi acak). Hipotesis di versi sebelumnya dokumen ini — bahwa 2.850.669 berasal dari seed lama — **ditarik**. Di dokumen ini, 'item' berarti unit (mengikuti `analytics.js`), dan jumlah baris selalu disebut 'baris item'.

**B.3 Status tangkapan layar.** Semua tangkapan aplikasi web (Bab 11) diambil dari server lokal yang menjalankan kode yang sama persis dengan yang live di Railway, dengan data seed kecil bawaan (9 produk, 6 transaksi). Mockup Android (Bab 12) adalah ilustrasi dari kode, bukan tangkapan HP. Tidak ada tangkapan yang diambil dari Railway/TiDB secara langsung, karena kredensial admin milik pemilik proyek tidak tersedia untuk keperluan dokumentasi dan data live tidak boleh diubah. Tangkapan dari GitHub Pages live tidak berhasil diambil (terowongan proxy Chromium gagal); tangkapan landing memakai file `index.html` yang identik dengan yang live.

**B.4 Batasan dokumen.** Disusun 16 November 2026 dari kode sumber, ekspor CSV, pengujian ulang, dan catatan proyek. Belum dapat diverifikasi: hasil uji APK di HP pemilik; tagihan pertama Railway setelah trial; tanggal persetujuan domain eu.org; dan apakah angka seed di TiDB live sama persis dengan ekspor CSV repo (keduanya dari skrip seed yang sama, seed 20261114 — belum dibandingkan baris per baris).

— Akhir dokumen —
Analisis Proyek Grace Shop • Dokumen Project Manager • v1.0 • 16 November 2026
