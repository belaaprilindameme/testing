# SETUP GUIDE - Bot Telegram E-Commerce

Panduan lengkap untuk setup dan menjalankan Bot Telegram E-Commerce.

## 📋 Prasyarat

Sebelum memulai, pastikan Anda sudah memiliki:

1. **Node.js v14+** - Download dari [nodejs.org](https://nodejs.org)
2. **Python 3.8+** - Download dari [python.org](https://www.python.org)
3. **Telegram Bot Token** - Hubungi [@BotFather](https://t.me/botfather)
4. **QRIS/GoPay Account** - Daftar di [qris-gopay.com](https://qris-gopay.com)

## 🚀 Instalasi & Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/belaaprilindameme/testing.git
cd testing
```

### Step 2: Setup Node.js Dependencies

```bash
npm install
```

### Step 3: Setup Python Environment

```bash
# Create virtual environment (optional tapi recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 4: Konfigurasi Environment

Buat file `.env` dari template `.env.example`:

```bash
cp .env.example .env
```

Edit file `.env` dan isi dengan kredensial Anda:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# QRIS/GoPay Payment Gateway
QRIS_FILE_ID=
QRIS_IMAGE_URL=
GOPAY_NUMBER=08xxxxxxxxxx
GOPAY_NAME=Nama Pemilik GoPay

# Database
DATABASE_PATH=./database/ecommerce.db

# Server
PORT=3000
NODE_ENV=development

# Admin
ADMIN_ID=your_telegram_user_id
```

### Step 5: Dapatkan Telegram Bot Token

1. Buka [@BotFather](https://t.me/botfather) di Telegram
2. Kirim command `/start` 
3. Kirim command `/newbot`
4. Ikuti instruksi dan copy token yang diberikan
5. Paste ke file `.env` di `TELEGRAM_BOT_TOKEN`

### Step 6: Setup QRIS/GoPay Account

1. Buka [qris-gopay.com](https://qris-gopay.com)
2. Daftar dan verify akun Anda
3. Login ke dashboard
4. Pergi ke Settings → Access Keys
5. Copy `Server Key` dan `Client Key`
6. Paste ke file `.env`

## ▶️ Menjalankan Bot

### Development Mode

```bash
# Dengan auto-reload menggunakan nodemon
npm run dev
```

### Production Mode

```bash
npm start
```

Bot akan mulai berjalan dan menunggu pesan dari user.

## 📊 Menjalankan Analytics

### Generate Report JSON

```bash
python analytics/analytics.py
```

Output akan disimpan di folder `reports/`:
- `analytics_report.json` - Laporan lengkap dalam format JSON
- `sales_report.csv` - Data penjualan dalam format CSV
- `analytics_chart.png` - Visualisasi grafik

## 🛍️ Fitur Bot

### Untuk User (Pembeli)

- `/start` - Menu utama
- `/products` - Lihat katalog produk
- `/cart` - Lihat keranjang belanja
- `/orders` - Riwayat pesanan
- `/tracking` - Lacak pesanan
- `/help` - Bantuan

### Untuk Admin

- `/admin` - Menu admin panel
- Kelola produk, pesanan, pembayaran
- Lihat analytics & report
- Kirim notifikasi

## 📁 Struktur Folder

```
testing/
├── index.js                 # Bot entry point
├── package.json             # Node.js dependencies
├── requirements.txt         # Python dependencies
├── .env.example             # Contoh environment config
├── .gitignore               # Files to ignore in git
│
├── config/
│   └── database.js          # SQLite configuration
│
├── handlers/
│   ├── productHandler.js    # Katalog & produk
│   ├── orderHandler.js      # Keranjang & pesanan
│   ├── paymentHandler.js    # Pembayaran QRIS/GoPay
│   ├── trackingHandler.js   # Tracking pesanan
│   └── adminHandler.js      # Panel admin
│
├── analytics/
│   ├── analytics.py         # Analytics & reporting
│   └── notifications.py     # Sistem notifikasi
│
├── database/
│   └── ecommerce.db         # SQLite database (auto-created)
│
└── reports/                 # Output reports & charts
    ├── analytics_report.json
    ├── sales_report.csv
    └── analytics_chart.png
```

## 🔗 Integrasi Pembayaran

Bot menggunakan **QRIS/GoPay** untuk pembayaran:

1. User memilih produk dan checkout
2. Sistem generate payment link via QRIS/GoPay
3. User diarahkan ke QRIS/GoPay payment page
4. Setelah pembayaran berhasil, notifikasi dikirim
5. Pesanan diproses otomatis

## 📊 Database Schema

Bot menggunakan SQLite dengan tabel:

- **users** - Data pelanggan
- **products** - Katalog produk
- **cart** - Keranjang belanja
- **orders** - Riwayat pesanan
- **order_items** - Item dalam pesanan
- **shipping** - Tracking pengiriman
- **payments** - Transaksi pembayaran

Semua tabel dibuat otomatis saat bot pertama kali dijalankan.

## 🔐 Keamanan

- Token disimpan di `.env` (jangan di-commit ke Git)
- Password & API key tidak pernah di-hardcode
- Database terenkripsi secara lokal
- Semua transaksi melalui QRIS/GoPay yang tersertifikasi

## 🐛 Troubleshooting

### Bot tidak merespons

```bash
# Check token di .env
# Restart bot
npm start
```

### Error koneksi database

```bash
# Delete database yang corrupt
rm database/ecommerce.db

# Bot akan membuat database baru otomatis
npm start
```

### Pembayaran tidak terproses

- Pastikan QRIS/GoPay keys sudah benar di `.env`
- Cek status di dashboard QRIS/GoPay
- Verify akun QRIS/GoPay Anda

## 📞 Support

Untuk bantuan, hubungi admin atau buat issue di repository.

## 📝 License

MIT

## 🤝 Kontribusi

Pull request welcome! Silakan fork dan submit changes.

---

**Happy Coding! 🚀**


## Pembayaran QRIS/GoPay

Versi ini memakai pembayaran QRIS/GoPay dengan verifikasi admin. Setelah user checkout, bot menampilkan nomor order, total bayar, QRIS/GoPay, dan instruksi kirim bukti pembayaran. Admin mengetik `paid NOMOR_ORDER` untuk menandai pembayaran berhasil dan bot otomatis mengirim produk digital. Admin dapat mengetik `reject NOMOR_ORDER` untuk menolak pembayaran.
