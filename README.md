<!-- markdownlint-disable MD033 -->

<div align="center">

# 🤖 Bot Telegram E-Commerce

<img src="https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge" alt="Node.js">
<img src="https://img.shields.io/badge/Python-v3.8+-blue?style=for-the-badge" alt="Python">
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
<img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status">
<img src="https://img.shields.io/badge/VPS-Ready-orange?style=for-the-badge" alt="VPS Ready">

**Bot Telegram lengkap untuk platform E-Commerce dengan sistem penjualan, pemesanan, pembayaran, tracking, notifikasi, dan analytics.**

**⚡ One-Command Deploy ke VPS:** `curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-vps.sh | bash`

[🚀 Quick Start](#-quick-start) • [🚀 Deploy VPS](#-deploy-ke-vps) • [📚 Documentation](#-dokumentasi) • [🎯 Features](#-fitur-utama) • [💡 Examples](#-contoh-penggunaan) • [🤝 Contributing](#-kontribusi)

</div>

---

## 📋 Daftar Isi

- [🎯 Fitur Utama](#-fitur-utama)
- [🛠️ Tech Stack](#-tech-stack)
- [📋 Requirements](#-requirements)
- [🚀 Quick Start](#-quick-start)
- [🚀 Deploy ke VPS](#-deploy-ke-vps)
- [📚 Dokumentasi](#-dokumentasi)
- [🎮 Cara Penggunaan](#-cara-penggunaan)
- [📁 Struktur Project](#-struktur-project)
- [🔧 Konfigurasi](#-konfigurasi)
- [📊 Database Schema](#-database-schema)
- [💡 Contoh Penggunaan](#-contoh-penggunaan)
- [🐛 Troubleshooting](#-troubleshooting)
- [🤝 Kontribusi](#-kontribusi)
- [📝 License](#-license)

---

## 🎯 Fitur Utama

### 🛍️ Katalog Produk
- Menampilkan semua produk dengan detail lengkap
- Pencarian dan filter produk
- Gambar produk dan deskripsi
- Informasi stok real-time
- Kategori produk

### 🛒 Sistem Pemesanan
- Keranjang belanja yang mudah digunakan
- Tambah/kurangi jumlah produk
- Simpan pesanan untuk nanti
- Riwayat pemesanan
- Detail pesanan lengkap

### 💳 Integrasi Pembayaran
- Integrasi dengan **Midtrans** untuk pembayaran aman
- Multiple payment methods (kartu kredit, bank transfer, e-wallet)
- Notifikasi pembayaran real-time
- Verifikasi pembayaran otomatis
- Rekam transaksi lengkap

### 📦 Tracking Pesanan
- Lacak status pesanan real-time
- Nomor resi pengiriman
- Informasi kurir & lokasi
- Estimasi waktu tiba
- Notifikasi update pengiriman

### 🔔 Notifikasi & Update
- Notifikasi order confirmation
- Update pembayaran
- Status pengiriman
- Promo & penawaran spesial
- Reminder keranjang yang ditinggalkan

### 📊 Analytics & Reporting
- Dashboard analytics lengkap
- Laporan penjualan harian/bulanan
- Statistik produk terlaris
- Data pelanggan
- Visualisasi grafik
- Export data (JSON, CSV)

### ⚙️ Admin Panel
- Manajemen produk
- Manajemen pesanan
- Manajemen pembayaran
- Monitoring analytics
- Kirim notifikasi ke customer

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js v18+ LTS
- **Framework:** Telegraf.js (Telegram Bot API)
- **Database:** SQLite3
- **Payment:** Midtrans Client
- **Process Manager:** PM2
- **Environment:** dotenv

### Analytics & Reporting
- **Language:** Python 3.8+
- **Data Processing:** Pandas
- **Visualization:** Matplotlib
- **Data Format:** JSON, CSV

### Tools & Services
- **Version Control:** Git & GitHub
- **Package Manager:** npm, pip
- **Development:** Nodemon (auto-reload)
- **VPS:** Ubuntu, Debian, Kali Linux (semua versi)

---

## 📋 Requirements

### Sistem Operasi
- **Local:** Windows, macOS, atau Linux
- **VPS:** Ubuntu 18+, Debian 10+, Kali Linux
- Minimal 2GB RAM
- 500MB storage

### Software yang Diperlukan
- **Node.js** v18+ ([download](https://nodejs.org))
- **Python** 3.8+ ([download](https://www.python.org))
- **Git** ([download](https://git-scm.com))
- **Terminal/CMD** untuk menjalankan commands

### Akun & Services
- **Telegram Account** - Untuk membuat bot
- **Telegram Bot Token** - Dari [@BotFather](https://t.me/botfather)
- **Midtrans Account** - Untuk payment gateway ([daftar](https://midtrans.com))
- **Midtrans API Keys** - Server Key & Client Key

---

## 🚀 Quick Start

### Instalasi Lokal (Windows/Mac/Linux)

#### 1. Clone Repository

```bash
git clone https://github.com/belaaprilindameme/testing.git
cd testing
```

#### 2. Install Node.js Dependencies

```bash
npm install
```

#### 3. Setup Python Environment

```bash
# Create virtual environment (optional tapi recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 4. Konfigurasi Environment

```bash
# Copy template
cp .env.example .env

# Edit .env dengan editor favorit
nano .env
# Isi dengan:
# - TELEGRAM_BOT_TOKEN (dari @BotFather)
# - MIDTRANS_SERVER_KEY
# - MIDTRANS_CLIENT_KEY
# - ADMIN_ID (user ID Telegram Anda)
```

#### 5. Jalankan Bot

```bash
# Development mode (dengan auto-reload)
npm run dev

# Production mode
npm start
```

✅ Bot siap menerima pesan dari Telegram!

---

## 🚀 Deploy ke VPS

### ⚡ One-Command Installation (Recommended)

Buka terminal di VPS Anda dan jalankan:

```bash
curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-vps.sh | bash
```

Script akan secara otomatis:
- ✅ Detect OS (Ubuntu, Debian, Kali Linux)
- ✅ Install semua dependencies
- ✅ Setup Node.js & Python
- ✅ Clone repository
- ✅ Install npm & pip packages
- ✅ Setup PM2 process manager
- ✅ Configure auto-start on reboot
- ✅ Setup firewall rules

### Manual Installation (Jika Anda Prefer)

#### Step 1: SSH ke VPS

```bash
ssh user@your-vps-ip
```

#### Step 2: Install Install Script

```bash
cd ~ && curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-vps.sh -o install-vps.sh && chmod +x install-vps.sh && ./install-vps.sh
```

#### Step 3: Configure Environment

```bash
nano ~/telegram-bot/.env
```

Isi dengan credentials Anda:
```env
TELEGRAM_BOT_TOKEN=your_token
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
ADMIN_ID=your_telegram_id
```

#### Step 4: Start Bot

```bash
cd ~/telegram-bot
pm2 start index.js --name "telegram-bot"
pm2 save
```

#### Step 5: View Logs

```bash
pm2 logs telegram-bot
```

### 📊 PM2 Commands Cheatsheet

```bash
# Start bot
pm2 start ~/telegram-bot/index.js --name "telegram-bot"

# Stop bot
pm2 stop telegram-bot

# Restart bot
pm2 restart telegram-bot

# View real-time logs
pm2 logs telegram-bot

# Monitor all processes
pm2 monit

# Auto-start on system reboot
pm2 startup
pm2 save

# Remove bot
pm2 delete telegram-bot
```

### 🔒 VPS Security Best Practices

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable

# 3. Setup SSH keys
ssh-copy-id -i ~/.ssh/id_rsa.pub user@your-vps-ip

# 4. Disable password login (optional)
sudo nano /etc/ssh/sshd_config
# Change: PasswordAuthentication no
sudo systemctl restart sshd
```

---

## 📚 Dokumentasi

Dokumentasi lengkap tersedia di:

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Panduan instalasi & konfigurasi detail
- **[API_DOCS.md](./API_DOCS.md)** - Dokumentasi semua API endpoints
- **[README.md](./README.md)** - File ini

---

## 🎮 Cara Penggunaan

### Untuk User (Pembeli)

Buka Telegram dan cari bot Anda atau ketik command berikut:

| Command | Fungsi |
|---------|--------|
| `/start` | Tampilkan menu utama |
| `/products` | Lihat katalog produk |
| `/cart` | Lihat keranjang belanja |
| `/orders` | Riwayat pesanan saya |
| `/tracking` | Lacak pesanan |
| `/help` | Bantuan & panduan |

**Cara berbelanja:**
1. Ketik `/start` atau `/products`
2. Pilih produk yang diinginkan
3. Klik tombol "Tambah ke Keranjang"
4. Klik `/cart` untuk melihat keranjang
5. Klik "Checkout" untuk membayar
6. Ikuti link pembayaran Midtrans
7. Selesai! Pesanan akan diproses

### Untuk Admin

| Command | Fungsi |
|---------|--------|
| `/admin` | Buka admin panel |

**Menu Admin:**
- 📦 Kelola Produk (tambah, edit, hapus)
- 📋 Kelola Pesanan (update status)
- 💳 Kelola Pembayaran
- 📊 Analytics & Report
- 🔔 Kirim Notifikasi

---

## 📁 Struktur Project

```
testing/
│
├── 📄 index.js                    # Bot entry point utama
├── 📄 install-vps.sh              # Auto-install script untuk VPS
├── 📄 install-linux.sh            # Auto-install script untuk Linux
├── 📄 package.json                # Node.js dependencies
├── 📄 requirements.txt             # Python dependencies
├── 📄 .env.example                # Template environment
├── 📄 .gitignore                  # Git ignore rules
│
├── 📁 config/
│   └── database.js                # SQLite configuration & schema
│
├── 📁 handlers/
│   ├── productHandler.js          # Katalog & detail produk
│   ├── orderHandler.js            # Keranjang & pesanan
│   ├── paymentHandler.js          # Midtrans payment
│   ├── trackingHandler.js         # Tracking pengiriman
│   └── adminHandler.js            # Admin panel
│
├── 📁 analytics/
│   ├── analytics.py               # Report & visualisasi
│   └── notifications.py           # Sistem notifikasi
│
├── 📁 database/
│   └── ecommerce.db               # SQLite database (auto-generated)
│
├── 📁 reports/                    # Output reports & charts
│   ├── analytics_report.json
│   ├── sales_report.csv
│   └── analytics_chart.png
│
├── 📁 logs/                       # Application logs
│
├── 📄 README.md                   # File ini
├── 📄 SETUP_GUIDE.md              # Setup guide lengkap
└── 📄 API_DOCS.md                 # API documentation
```

---

## 🔧 Konfigurasi

### File .env Configuration

```env
# ============ TELEGRAM ============
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# ============ MIDTRANS PAYMENT ============
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_CLIENT_KEY=your_midtrans_client_key

# ============ DATABASE ============
DATABASE_PATH=./database/ecommerce.db

# ============ SERVER ============
PORT=3000
NODE_ENV=production

# ============ ADMIN ============
ADMIN_ID=your_telegram_user_id
```

### Cara Mendapatkan Bot Token

1. Buka [@BotFather](https://t.me/botfather) di Telegram
2. Kirim command `/start`
3. Kirim command `/newbot`
4. Ikuti instruksi - berikan nama bot
5. Setelah bot dibuat, copy token yang diberikan
6. Paste ke file `.env` di variable `TELEGRAM_BOT_TOKEN`

### Cara Setup Midtrans

1. Buka [midtrans.com](https://midtrans.com)
2. Sign up & verify email
3. Login ke Midtrans Dashboard
4. Go to Settings → Access Keys
5. Copy `Server Key` dan `Client Key`
6. Paste ke file `.env`

---

## 📊 Database Schema

Bot menggunakan SQLite dengan 7 tabel utama:

### Users Table
```sql
- id (PK)
- telegram_id (UNIQUE)
- username
- first_name, last_name
- phone, address
- created_at
```

### Products Table
```sql
- id (PK)
- name
- description
- price
- stock
- image_url
- category
- created_at
```

### Cart Table
```sql
- id (PK)
- telegram_id (FK)
- product_id (FK)
- quantity
- added_at
```

### Orders Table
```sql
- id (PK)
- telegram_id (FK)
- order_number (UNIQUE)
- total_price
- status (pending|processing|shipped|delivered|cancelled)
- payment_status (unpaid|pending|paid)
- payment_id
- shipping_address
- created_at, updated_at
```

### Order Items Table
```sql
- id (PK)
- order_id (FK)
- product_id (FK)
- quantity
- price
```

### Shipping Table
```sql
- id (PK)
- order_id (FK - UNIQUE)
- courier
- tracking_number (UNIQUE)
- status
- location
- estimated_delivery
- updated_at
```

### Payments Table
```sql
- id (PK)
- order_id (FK - UNIQUE)
- amount
- payment_method
- transaction_id (UNIQUE)
- status (pending|success|failed)
- created_at, completed_at
```

---

## 💡 Contoh Penggunaan

### Menambah Produk (Admin)

Database akan dibuat otomatis. Untuk menambah produk, gunakan:

```sql
INSERT INTO products (name, description, price, stock, category)
VALUES ('Laptop Gaming', 'Laptop dengan spesifikasi tinggi', 15000000, 10, 'Elektronik');
```

### Generate Analytics Report

```bash
# Generate JSON report
python analytics/analytics.py

# Report akan tersimpan di folder 'reports/'
# - analytics_report.json
# - sales_report.csv
# - analytics_chart.png
```

### Development dengan Auto-Reload

```bash
npm run dev
# Bot akan restart otomatis saat ada perubahan file
```

---

## 🐛 Troubleshooting

### ❌ Bot tidak merespons

**Solusi:**
```bash
# Check apakah token sudah benar di .env
# Restart bot
npm start

# Atau jalankan dengan logging
DEBUG=telegraf:* npm start

# Jika menggunakan PM2:
pm2 restart telegram-bot
pm2 logs telegram-bot
```

### ❌ Error: "Cannot find module 'telegraf'"

**Solusi:**
```bash
npm install
# atau
npm install telegraf axios sqlite3 dotenv
```

### ❌ Database error

**Solusi:**
```bash
# Delete database yang corrupt
rm database/ecommerce.db

# Bot akan membuat database baru otomatis
npm start
```

### ❌ Pembayaran tidak terproses

**Solusi:**
1. Pastikan Midtrans keys sudah benar di `.env`
2. Cek status di Midtrans Dashboard
3. Verify akun Midtrans sudah lengkap
4. Pastikan server dapat terhubung ke internet

### ❌ Python analytics error

**Solusi:**
```bash
# Pastikan Python 3.8+ installed
python3 --version

# Install dependencies ulang
pip install -r requirements.txt
```

### ❌ VPS Deployment Issues

**Bot tidak start setelah reboot:**
```bash
# Cek PM2 status
pm2 list

# Re-save configuration
pm2 save

# Setup startup script
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

**Port sudah digunakan:**
```bash
# Cek port yang digunakan
lsof -i :3000

# Kill process yang mengunakan port
kill -9 <PID>

# Atau gunakan port lain di .env
# Ubah PORT=3001 di file .env
```

---

## 📈 Fitur Lanjutan

### Custom Notifications

Edit file `analytics/notifications.py` untuk customize pesan notifikasi.

### Custom Admin Commands

Edit file `handlers/adminHandler.js` untuk menambah admin commands.

### Custom Product Categories

Tambahkan kategori baru di database products table.

### Webhook Payment Notifications

Setup webhook di Midtrans Dashboard untuk notifikasi pembayaran real-time.

---

## 🚢 Deployment Options

### Option 1: VPS (Recommended)
```bash
# One-command deploy
curl -fsSL https://raw.githubusercontent.com/belaaprilindameme/testing/main/install-vps.sh | bash
```

### Option 2: Docker
```bash
docker build -t telegram-bot .
docker run -d --env-file .env telegram-bot
```

### Option 3: Heroku
```bash
heroku login
heroku create your-app-name
git push heroku main
```

---

## 🤝 Kontribusi

Kontribusi selalu welcome! 

**Cara berkontribusi:**

1. Fork repository ini
2. Buat branch fitur (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

---

## 📞 Support & Bantuan

- 📖 Baca [SETUP_GUIDE.md](./SETUP_GUIDE.md) untuk panduan lengkap
- 📚 Lihat [API_DOCS.md](./API_DOCS.md) untuk dokumentasi API
- 🐛 Buat issue untuk melaporkan bug
- 💬 Diskusi di Discussions tab

---

## 📝 License

Project ini menggunakan lisensi **MIT** - silakan lihat file [LICENSE](LICENSE) untuk detail.

---

## 👨‍💻 Author

**Mukarramah Hasaningsih** (@belaaprilindameme)

- GitHub: [@belaaprilindameme](https://github.com/belaaprilindameme)
- Telegram: [@belaaprilindameme](https://t.me/belaaprilindameme)

---

## 🙏 Terima Kasih

Terima kasih kepada:
- [Telegraf.js](https://telegraf.dev) - Telegram Bot API
- [Midtrans](https://midtrans.com) - Payment Gateway
- [SQLite](https://www.sqlite.org) - Database
- [PM2](https://pm2.keymetrics.io) - Process Manager
- Semua contributor yang membantu project ini

---

<div align="center">

### ⭐ Jika project ini membantu, jangan lupa beri star! ⭐

**Made with ❤️ for E-Commerce**

**🚀 Ready to Deploy!**

</div>
