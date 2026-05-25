# Perbaikan Bug

Versi ini memperbaiki error utama pada project Bot Telegram E-Commerce:

- Menambahkan handler yang sebelumnya hilang:
  - `handlers/productHandler.js`
  - `handlers/orderHandler.js`
  - `handlers/trackingHandler.js`
- Melengkapi method database yang sebelumnya dipanggil tetapi belum tersedia:
  - `addOrderItem`
  - `createPayment`
  - `updateOrderPaymentStatus`
  - `getAllOrders`
  - `getAnalytics`
  - `getOrderById`
  - `getOrderItems`
  - `getShipping`
  - `createShipping`
- Menghapus double initialization database.
- Membuat direktori database otomatis.
- Menambahkan seed produk awal agar katalog tidak kosong.
- Memperbaiki urutan `dotenv.config()` supaya environment terbaca sebelum handler dibuat.
- Menambahkan fallback pembayaran manual jika QRIS/GoPay belum dikonfigurasi.
- Menambahkan endpoint Express:
  - `GET /`
  - `POST /qris-gopay/notification`
- Menambahkan dependency `qris-gopay-client` dan `nodemon` di `package.json`.
- Membersihkan `requirements.txt` agar hanya berisi dependency Python.
- Memperbaiki query analytics Python dari `payment_status` menjadi `status`.
- Menambahkan tabel `notifications`.
- Memperbaiki installer agar tidak gagal saat dijalankan dari folder `/root` yang tidak kosong.
- Menambahkan alias installer `install-vps.sh` agar URL lama tetap bisa dipakai jika file ini di-push ke GitHub.

## Cara pakai cepat di VPS

```bash
cd /root
rm -rf testing-bot
git clone https://github.com/belaaprilindameme/testing.git testing-bot
cd testing-bot
npm install
cp .env.example .env
nano .env
npm start
```

Atau setelah file terbaru di-push ke GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-linux.sh | bash
```


## Audit tambahan - 2026-05-24

- Fixed database startup deadlock: `seedProducts()` now uses raw SQLite helpers instead of waiting for `this.ready` while initialization is still running.
- Improved cart stock validation so total quantity in cart cannot exceed product stock.
- Added stock reduction when checkout creates order items.
- Improved analytics chart generation so it does not crash when there is no sales/product data yet.
- Improved installer root handling by avoiding mandatory `sudo` when already running as root.
- Moved repository setup before app directory creation so installer creates project folders in the correct cloned directory.
- Revalidated JavaScript syntax, Python compilation, and shell script syntax.

## Digital product delivery update

- Added digital product columns to `products`.
- Added `digital_delivered` and `delivered_at` to `orders`.
- Added safe schema migrations for old SQLite databases.
- Added admin upload flow for Telegram document products.
- Added admin text-only product flow.
- Added delivery types: `file`, `text`, `file_text`.
- Added automatic digital delivery after QRIS/GoPay paid notification.
- Added manual admin delivery command: `paid ORD-...`.
- Added `.gitignore` and removed Python cache files from the package.


## Pembayaran QRIS/GoPay

Versi ini memakai pembayaran QRIS/GoPay dengan verifikasi admin. Setelah user checkout, bot menampilkan nomor order, total bayar, QRIS/GoPay, dan instruksi kirim bukti pembayaran. Admin mengetik `paid NOMOR_ORDER` untuk menandai pembayaran berhasil dan bot otomatis mengirim produk digital. Admin dapat mengetik `reject NOMOR_ORDER` untuk menolak pembayaran.

- Auto setting kontak admin dari ADMIN_ID lewat menu /admin > Auto Setting Hubungi Admin.
