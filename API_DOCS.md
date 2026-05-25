# Bot Telegram E-Commerce - Dokumentasi API

Dokumentasi lengkap untuk semua fitur dan API di Bot Telegram E-Commerce.

## 📡 Base URL

```
Bot Telegram: @your_bot_name
Database: SQLite (Local)
Payment Gateway: QRIS/GoPay
```

## 🛍️ Product Endpoints

### Get All Products

**Handler:** `productHandler.showProducts(ctx)`

Menampilkan semua produk yang tersedia.

```javascript
// Triggered by:
// - Command: /products
// - Callback: show_products
```

**Response:**
```
Katalog produk dengan:
- Nama produk
- Harga (Rp)
- Stok tersedia
- Tombol tambah ke keranjang
```

### Get Product Detail

**Handler:** `productHandler.showProductDetail(ctx, productId)`

Menampilkan detail lengkap produk tertentu.

```javascript
// Parameters:
productId: Integer
```

**Response:**
```
Detail produk dengan:
- Nama & deskripsi
- Harga
- Stok
- Kategori
```

---

## 🛒 Cart & Order Endpoints

### Add to Cart

**Handler:** `orderHandler.addToCart(ctx)`

Menambah produk ke keranjang belanja.

```javascript
// Triggered by:
// Callback: add_to_cart_{productId}
```

**Response:**
```
✅ Produk ditambahkan ke keranjang!
```

### Show Cart

**Handler:** `orderHandler.showCart(ctx)`

Menampilkan isi keranjang belanja.

```javascript
// Triggered by:
// - Command: /cart
// - Callback: show_cart
```

**Response:**
```
Daftar item di keranjang dengan:
- Nama produk
- Harga & jumlah
- Subtotal per item
- Total keseluruhan
- Tombol checkout & lanjut belanja
```

### Remove from Cart

**Handler:** `orderHandler.removeFromCart(ctx)`

Menghapus item dari keranjang.

```javascript
// Triggered by:
// Callback: remove_cart_{cartId}
```

**Response:**
```
✅ Item dihapus dari keranjang
[Refresh tampilan keranjang]
```

### Show Orders

**Handler:** `orderHandler.showOrders(ctx)`

Menampilkan riwayat pesanan user.

```javascript
// Triggered by:
// - Command: /orders
// - Callback: show_orders
```

**Response:**
```
Daftar pesanan dengan:
- Nomor pesanan
- Total harga
- Status pesanan
- Status pembayaran
- Tanggal pesanan
```

---

## 💳 Payment Endpoints

### Checkout

**Handler:** `paymentHandler.checkout(ctx)`

Memproses checkout dan membuat link pembayaran.

```javascript
// Triggered by:
// Callback: checkout

// Process:
// 1. Get cart items
// 2. Calculate total
// 3. Create order in database
// 4. Generate QRIS/GoPay payment link
// 5. Send payment URL to user
```

**Response:**
```
✅ PESANAN BERHASIL DIBUAT!

Nomor Pesanan: ORD-{timestamp}
Total: Rp{amount}

[Tombol: Bayar Sekarang]
```

### Handle Payment Notification

**Handler:** `paymentHandler.handlePaymentNotification(req)`

Webhook dari QRIS/GoPay untuk notifikasi pembayaran.

```javascript
// Request body:
{
  order_id: "ORD-12345",
  transaction_status: "settlement|pending|deny",
  payment_type: "credit_card|bank_transfer|etc",
  amount: 50000
}

// Status codes:
// - settlement: Pembayaran berhasil
// - pending: Menunggu pembayaran
// - deny/cancel/expire: Pembayaran gagal
```

**Response:**
```json
{
  "success": true,
  "status": "paid|pending|failed"
}
```

---

## 📦 Tracking Endpoints

### Start Tracking

**Handler:** `trackingHandler.startTracking(ctx)`

Memulai proses tracking pesanan.

```javascript
// Triggered by:
// - Command: /tracking
// - Callback: show_tracking
```

**Response:**
```
Minta user memasukkan nomor pesanan
```

### Track Order

**Handler:** `trackingHandler.trackOrder(ctx, orderNumber)`

Menampilkan status tracking pesanan.

```javascript
// Parameters:
orderNumber: String (format: ORD-{timestamp})

// Usage:
// User send: #track_ORD-1234567890
```

**Response:**
```
📦 TRACKING PESANAN

Nomor Pesanan: ORD-xxxxx
Status: [pending|processing|shipped|delivered]

🚚 PENGIRIMAN
Kurir: [Nama kurir]
No Resi: [Tracking number]
Lokasi: [Current location]
Perkiraan Tiba: [Date]

💰 DETAIL
Total: Rp{amount}
Pembayaran: [Status]
```

---

## 👨‍💼 Admin Endpoints

### Admin Menu

**Handler:** `adminHandler.adminMenu(ctx)`

Menampilkan menu admin panel.

```javascript
// Triggered by:
// Command: /admin

// Checks:
// - Verify user is admin (ADMIN_ID)
```

**Response:**
```
Menu dengan pilihan:
- Kelola Produk
- Kelola Pesanan
- Kelola Pembayaran
- Analytics & Report
- Kirim Notifikasi
```

### Manage Products

**Handler:** `adminHandler.manageProducts(ctx)`

Admin dapat mengelola katalog produk.

**Actions:**
- Tambah produk baru
- Edit produk
- Hapus produk
- View stok

### Manage Orders

**Handler:** `adminHandler.manageOrders(ctx)`

Admin dapat mengelola pesanan.

**Actions:**
- Update status pesanan
- Update info pengiriman
- Batalkan pesanan
- View detail pesanan

### Get Analytics

**Handler:** `adminHandler.getAnalytics(ctx)`

Menampilkan analytics dan laporan penjualan.

**Data:**
```
- Total pesanan
- Total revenue
- Pesanan pending/selesai
- Total pelanggan
- Produk terlaris
- Pembayaran berhasil/pending
```

---

## 📊 Analytics Endpoints (Python)

### Generate JSON Report

```python
from analytics.analytics import Analytics

analytics = Analytics()
report = analytics.generate_json_report()
# Output: reports/analytics_report.json
```

**Response:**
```json
{
  "generated_at": "2024-05-23T10:30:00",
  "sales_report": [...],
  "product_stats": [...],
  "customer_stats": {...},
  "payment_stats": {...},
  "order_distribution": {...}
}
```

### Generate CSV Report

```python
analytics.generate_csv_report()
# Output: reports/sales_report.csv
```

### Generate Visualizations

```python
analytics.generate_visualization()
# Output: reports/analytics_chart.png
```

---

## 🔔 Notifications (Python)

### Send Order Confirmation

```python
from analytics.notifications import Notifications

notifications = Notifications()
message = notifications.send_order_confirmation(
    telegram_id=12345,
    order_data={...}
)
```

### Send Payment Confirmation

```python
message = notifications.send_payment_confirmation(
    telegram_id=12345,
    payment_data={...}
)
```

### Send Shipping Update

```python
message = notifications.send_shipping_update(
    telegram_id=12345,
    shipping_data={...}
)
```

### Send Promotional Message

```python
message = notifications.send_promotional_message(
    telegram_id=12345,
    promo_data={
        'title': 'Diskon 50%',
        'description': 'Untuk semua produk...',
        'code': 'PROMO50',
        'discount': 50,
        'valid_until': '2024-06-30'
    }
)
```

---

## 🗄️ Database Methods

### User Methods

```javascript
db.addUser(telegramId, userData)
db.getUser(telegramId)
```

### Product Methods

```javascript
db.getAllProducts()
db.getProduct(productId)
```

### Cart Methods

```javascript
db.addToCart(telegramId, productId, quantity)
db.getCart(telegramId)
db.removeFromCart(cartId)
db.clearCart(telegramId)
```

### Order Methods

```javascript
db.createOrder(telegramId, totalPrice, shippingAddress)
db.getOrders(telegramId)
```

---

## 🔐 Environment Variables

```env
TELEGRAM_BOT_TOKEN=xxxxx          # Bot token dari BotFather
QRIS_FILE_ID=                 # Telegram file_id gambar QRIS
QRIS_IMAGE_URL=                # Alternatif link gambar QRIS
GOPAY_NUMBER=08xxxxxxxxxx      # Nomor GoPay
GOPAY_NAME=Nama Pemilik GoPay
DATABASE_PATH=./database/ecommerce.db
PORT=3000
NODE_ENV=development
ADMIN_ID=your_telegram_user_id
```

---

## ✅ Status Codes

**Order Status:**
- `pending` - Menunggu pembayaran
- `processing` - Sedang diproses
- `shipped` - Dalam pengiriman
- `delivered` - Sudah diterima
- `cancelled` - Dibatalkan

**Payment Status:**
- `unpaid` - Belum dibayar
- `pending` - Menunggu konfirmasi
- `paid` - Sudah dibayar

**Shipping Status:**
- `processing` - Sedang dikemas
- `shipped` - Sudah dikirim
- `in_transit` - Dalam perjalanan
- `delivered` - Sudah diterima

---

**API Documentation v1.0**


## Pembayaran QRIS/GoPay

Versi ini memakai pembayaran QRIS/GoPay dengan verifikasi admin. Setelah user checkout, bot menampilkan nomor order, total bayar, QRIS/GoPay, dan instruksi kirim bukti pembayaran. Admin mengetik `paid NOMOR_ORDER` untuk menandai pembayaran berhasil dan bot otomatis mengirim produk digital. Admin dapat mengetik `reject NOMOR_ORDER` untuk menolak pembayaran.
