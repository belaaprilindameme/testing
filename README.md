# Telegram Digital Store Bot

Bot Telegram untuk jualan produk digital seperti file `.zip`, `.txt`, `.pdf`, script, akun, panduan, atau produk berbasis teks. Bot mendukung katalog produk, keranjang, checkout, QRIS dinamis otomatis, pengiriman produk digital otomatis, admin panel, backup harian, restore backup, laporan, dan PM2 auto-start.

## Fitur Utama

- Produk digital berupa **file saja**, **text saja**, atau **file + text**.
- Admin upload produk langsung dari menu `/admin`.
- Detail produk lengkap sebelum checkout: nama, harga, stok, kategori, deskripsi, dan S&K.
- Review sebelum checkout supaya user tidak salah beli.
- Payment QRIS/GoPay otomatis.
- QRIS tampil langsung sebagai **foto + caption dalam satu pesan**, bukan link.
- Bot cek status pembayaran otomatis.
- Produk digital otomatis dikirim setelah payment sukses.
- Menu hubungi admin otomatis dari `ADMIN_ID` / username admin.
- Backup otomatis jam 00:00 WIB dan backup manual dari `/admin`.
- Restore backup lewat upload file backup ke `/admin`.
- Admin dashboard, laporan, export, audit log, maintenance mode, kategori, search, pagination, rating, refund, dan delivery log.
- Installer satu command dari awal sampai akhir.
- PM2 auto-start agar bot tetap hidup setelah VPS restart.

## Instalasi Otomatis di VPS

Jalankan satu command ini:

```bash
curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-vps.sh | bash
```

Atau:

```bash
curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-linux.sh | bash
```

Installer akan otomatis melakukan:

```text
apt update
install dependency sistem
install Node.js / npm
install Python
install SQLite
clone/update repository
buat folder database/logs/reports/backups
buat file .env
install npm dependency
cek syntax
install PM2
start bot dengan PM2
aktifkan auto-restart
```

Saat instalasi, kamu hanya perlu mengisi data penting:

```text
Token Bot Telegram
ID Telegram Admin
GoPay / QRIS API Key
Admin tambahan jika ada
Expired QRIS
Port bot
```

Installer **tidak akan menanyakan URL Generate QRIS dan URL Status QRIS**, karena sudah otomatis memakai default.

## Konfigurasi `.env`

Contoh konfigurasi utama:

```env
TELEGRAM_BOT_TOKEN=isi_token_bot_kamu
ADMIN_ID=isi_id_telegram_admin
ADMIN_IDS=123456789,987654321
DATABASE_PATH=./database/ecommerce.db
PORT=3000
NODE_ENV=production

PAYMENT=GOPAY
GOPAY_KEY=isi_api_key_qris_kamu
GOPAY_QRIS_GENERATE_URL=https://v1-gateway.autogopay.site/qris/generate
GOPAY_QRIS_STATUS_URL=https://v1-gateway.autogopay.site/qris/status
QRIS_EXPIRED_MINUTES=10
QRIS_CHECK_INTERVAL_MS=5000
QRIS_EXPIRED_ACTION=edit

BACKUP_AUTO_ENABLED=true
BACKUP_TIME=00:00
BACKUP_TIMEZONE=Asia/Jakarta
BACKUP_KEEP_LOCAL=14
BACKUP_INCLUDE_ENV=true

ADMIN_USERNAME=
ADMIN_DISPLAY_NAME=
ADMIN_CONTACT_URL=
ADMIN_CONTACT_TEXT=Silakan hubungi admin untuk bantuan pembayaran, kendala produk, atau pertanyaan sebelum membeli.
```

## Alur User Membeli Produk

```text
/start
→ Katalog Produk
→ Detail Produk
→ baca deskripsi + S&K
→ Saya Paham, Tambah ke Keranjang
→ Keranjang Saya
→ Checkout
→ Review Sebelum Checkout
→ Saya Setuju, Buat Pesanan
→ bot kirim foto QRIS dinamis + caption
→ user bayar
→ bot cek payment otomatis
→ produk digital dikirim otomatis
```

## Alur Admin Menambahkan Produk

Buka:

```text
/admin
```

Pilih:

```text
➕ Tambah Produk Digital
```

Lalu pilih jenis produk:

```text
📄 Text Saja
📁 File Saja
📁➕📄 File + Text
```

### Contoh Produk File + Text

Upload file sebagai dokumen, lalu isi caption:

```text
Nama: Paket Premium Bot
Harga: 100000
Stok: 999
Kategori: Script
Deskripsi: Paket ini berisi file ZIP script bot dan panduan penggunaan.
S&K: Produk digital tidak bisa refund setelah dikirim. Pembeli wajib membaca deskripsi sebelum checkout.
Text: Berikut panduan singkat: ekstrak file ZIP, buka README, lalu ikuti instruksi install di VPS.
```

### Contoh Produk Text Saja

Kirim pesan ke bot setelah memilih **Text Saja**:

```text
Nama: Akses Premium
Harga: 25000
Stok: 999
Kategori: Digital
Deskripsi: Produk ini berisi akses/panduan premium dalam bentuk teks.
S&K: Text dikirim setelah pembayaran sukses.
Text: Ini isi produk yang akan dikirim ke pembeli setelah checkout berhasil.
```

## Menu Admin

Command utama:

```text
/admin
```

Fitur admin:

```text
Dashboard Ringkas
Kelola Produk Digital
Tambah Produk Digital
Edit Produk
Hapus / Nonaktifkan Produk
Kelola Pesanan
Backup & Restore
Export Laporan
Pengaturan Bot
Audit Log Admin
Auto Setting Hubungi Admin
Maintenance Mode
```

## Command Admin Penting

```text
cek ORD-xxxx
resend ORD-xxxx
refund ORD-xxxx
paid ORD-xxxx
reject ORD-xxxx

editprod ID harga 50000
editprod ID stok 999
editprod ID nama Nama Produk Baru
editprod ID deskripsi Isi deskripsi baru
editprod ID snk Isi S&K baru
hapusprod ID
aktifprod ID
nonaktifprod ID

coupon KODE percent 10 100
coupon KODE fixed 5000 50
delcoupon KODE

setgopaykey TOKEN_PROVIDER
setqrisexpired 10
addcat Nama Kategori
maintenance_on
maintenance_off
```

## Command User

```text
/start
/products
/search nama_produk
/cart
/orders
/tracking
/contact
/help
voucher KODE
rating ORD-xxxx PRODUCT_ID 5 komentar
```

## Backup & Restore

Backup otomatis berjalan tiap hari jam 00:00 WIB jika aktif di `.env`:

```env
BACKUP_AUTO_ENABLED=true
BACKUP_TIME=00:00
BACKUP_TIMEZONE=Asia/Jakarta
```

Backup akan dikirim ke admin utama dan admin tambahan di `ADMIN_IDS`.

Restore backup:

```text
/admin
→ Backup & Restore
→ Restore dari File Backup
→ upload file backup .tar.gz
→ konfirmasi restore
```

Backup bisa menyertakan `.env` jika:

```env
BACKUP_INCLUDE_ENV=true
```

File backup bersifat rahasia karena bisa berisi token bot, API key, database user, order, payment, produk, dan data transaksi.

## QRIS Dinamis

Bot menggunakan provider QRIS/GoPay otomatis.

Saat checkout, bot akan:

```text
request QRIS ke provider
menerima qr_url / transaction_id
mengunduh gambar QRIS
mengirim QRIS sebagai foto Telegram
cek status payment berkala
mengirim produk digital setelah payment sukses
```

Tampilan payment ke user adalah satu pesan:

```text
[Foto QRIS]
📝 Detail Pembayaran
Order
Total
Expired
Instruksi bayar
```

Tidak ada link `Klik QRIS` dan tidak ada tombol `Buka QRIS`.

## PM2

Installer otomatis menjalankan bot dengan PM2.

Command berguna:

```bash
pm2 status
pm2 logs ecommerce-bot
pm2 restart ecommerce-bot
pm2 stop ecommerce-bot
pm2 save
```

## Health Check

Endpoint:

```text
/health
```

Digunakan untuk mengecek status bot, database, uptime, dan service utama.

## Troubleshooting

### Bot tidak jalan

```bash
pm2 logs ecommerce-bot
```

Cek `.env`:

```bash
nano .env
```

Pastikan minimal ada:

```env
TELEGRAM_BOT_TOKEN=
ADMIN_ID=
GOPAY_KEY=
```

### QRIS tidak muncul

Pastikan:

```text
GOPAY_KEY benar
Provider QRIS aktif
VPS bisa akses internet
QRIS_EXPIRED_MINUTES valid
```

### Produk tidak terkirim

Admin bisa kirim ulang:

```text
resend ORD-xxxx
```

### Backup tidak terkirim

Pastikan:

```text
ADMIN_ID benar
admin sudah pernah /start ke bot
BACKUP_AUTO_ENABLED=true
```

## Struktur Project

```text
index.js
config/database.js
handlers/adminHandler.js
handlers/productHandler.js
handlers/orderHandler.js
handlers/paymentHandler.js
handlers/trackingHandler.js
services/backupService.js
services/adminContactService.js
services/adminNotifyService.js
analytics/analytics.py
install-linux.sh
install-vps.sh
ecosystem.config.js
```

## Catatan Keamanan

- Jangan bagikan `.env`.
- Jangan bagikan file backup ke orang lain.
- Jangan tampilkan `GOPAY_KEY` atau `TELEGRAM_BOT_TOKEN` di chat publik.
- Restore backup hanya boleh dilakukan admin.
- File produk digital dikirim berdasarkan `file_id` Telegram yang tersimpan di database.

## Update Terakhir

README ini sudah disesuaikan dengan versi bot yang mendukung:

```text
one-command installer
produk digital file/text/file+text
QRIS dinamis foto + caption satu pesan
admin dashboard
backup restore
PM2
audit log
export laporan
maintenance
health check
```


## 📣 Broadcast User

Admin bisa mengirim broadcast ke semua user yang sudah pernah memakai bot. Broadcast mendukung:

- text
- foto + caption
- video + caption

Cara pakai dari menu:

```text
/admin
→ 📣 Broadcast User
→ pilih Broadcast Text / Foto / Video
→ kirim konten
→ cek preview
→ ✅ Kirim Broadcast
```

Cara cepat broadcast text:

```text
/broadcast Isi pesan broadcast kamu di sini
```

Bot akan menampilkan preview dan meminta konfirmasi sebelum broadcast dikirim. Hanya admin yang bisa memakai fitur ini.

Setting jeda antar user:

```env
BROADCAST_DELAY_MS=80
```


## 📝 Fitur Pre Order / Request Produk

User bisa request produk yang belum tersedia di katalog.

Alur user:

```text
/start
→ 📝 Pre Order / Request Produk
→ kirim request berupa text, foto, video, atau file/dokumen
→ bot membuat QRIS dinamis
→ user bayar
→ setelah payment sukses, status berubah menjadi PROSES
→ request + transaction ID dikirim ke admin
```

Setting harga pre order di `.env`:

```env
PREORDER_PRICE=50000
```

Setelah pembayaran pre order sukses, admin menerima:

```text
ID Pre Order
Order ID
Transaction ID
Telegram ID user
Request user
```

Command admin untuk melihat pre order:

```text
cekpo ID_PREORDER_ATAU_ORDER_ATAU_TRANSACTION
```

Command admin untuk mengirim hasil produk pre order ke user:

```text
sendpo ID_PREORDER_ATAU_ORDER_ATAU_TRANSACTION
```

Setelah command `sendpo`, admin cukup mengirim hasil produk berupa text, foto, video, atau file/dokumen. Bot akan meneruskan hasil tersebut ke user dan menandai pre order sebagai `delivered`.

## Pre Order Advanced Flow

Pre Order sekarang memakai alur quote dari admin:

1. User membuka **Pre Order / Request Produk**.
2. User membaca S&K lalu mengirim request berupa text, foto, video, atau file/dokumen.
3. Bot mengirim request tersebut ke admin.
4. Admin menentukan harga, tanggal pengerjaan, estimasi, dan catatan dengan command `setpo`.
5. Bot mengirim invoice/penawaran ke user.
6. User klik **Setuju & Bayar**.
7. Bot membuat QRIS dinamis sebagai foto + caption dalam satu pesan.
8. Setelah pembayaran sukses, status menjadi `process`.
9. Admin mengirim hasil produk dengan `sendpo`.
10. User bisa meminta revisi atau menandai selesai.

Command utama:

```text
setpo PO-xxxx 75000 2026-05-25 2026-05-27 2 hari | Catatan admin
editpo PO-xxxx harga 85000
cekpo PO-xxxx
invoicepo PO-xxxx
sendpo PO-xxxx
cancelpo PO-xxxx alasan pembatalan
revision PO-xxxx alasan revisi
completepo PO-xxxx
```

Panduan lengkap ada di `PREORDER_GUIDE.md`.

## Audit Project

Untuk mengecek syntax JS, Python, dan Bash sekaligus:

```bash
npm run audit
```


## 🧹 Auto-Cleanup Data Lama

Bot sudah memiliki cleanup otomatis untuk membersihkan data sementara/lama seperti QRIS expired, cart lama, log lama, report lama, dan backup lokal lama. Data penting seperti produk, user, order utama, payment utama, dan pre order aktif tidak dihapus.

Menu admin:

```text
/admin → 🧹 Auto-Cleanup Data Lama
```

Command manual:

```text
/cleanup
```

Setting tersedia di `.env.example`, misalnya `CLEANUP_AUTO_ENABLED`, `CLEANUP_INTERVAL_MS`, `CLEANUP_QRIS_DAYS`, dan `CLEANUP_REPORT_DAYS`.
