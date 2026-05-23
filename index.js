const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const db = require('./config/database');
const productHandler = require('./handlers/productHandler');
const orderHandler = require('./handlers/orderHandler');
const paymentHandler = require('./handlers/paymentHandler');
const trackingHandler = require('./handlers/trackingHandler');
const adminHandler = require('./handlers/adminHandler');

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize database
db.init();

// ============ START COMMAND ============
bot.start((ctx) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🛍️ Katalog Produk', callback_data: 'show_products' }],
      [{ text: '🛒 Keranjang Saya', callback_data: 'show_cart' }],
      [{ text: '📦 Pesanan Saya', callback_data: 'show_orders' }],
      [{ text: '📍 Tracking Pesanan', callback_data: 'show_tracking' }],
      [{ text: '❓ Bantuan', callback_data: 'show_help' }]
    ]
  };
  
  ctx.reply('🎉 Selamat datang di Bot E-Commerce! 🎉\n\nPilih menu di bawah untuk memulai belanja:', {
    reply_markup: keyboard
  });
});

// ============ COMMAND HANDLERS ============
bot.command('products', (ctx) => productHandler.showProducts(ctx));
bot.command('cart', (ctx) => orderHandler.showCart(ctx));
bot.command('orders', (ctx) => orderHandler.showOrders(ctx));
bot.command('tracking', (ctx) => trackingHandler.startTracking(ctx));
bot.command('help', (ctx) => {
  ctx.reply(`
📖 PANDUAN PENGGUNAAN BOT

Perintah Tersedia:
/start - Menu utama
/products - Lihat semua produk
/cart - Lihat keranjang belanja
/orders - Riwayat pesanan
/tracking - Lacak pesanan
/help - Bantuan ini

💡 Tips:
- Gunakan tombol untuk navigasi yang lebih mudah
- Semua produk bisa ditambah ke keranjang
- Checkout hanya di menu Keranjang
- Pembayaran aman melalui Midtrans

Butuh bantuan? Hubungi admin: /admin
  `);
});

// ============ CALLBACK HANDLERS ============
// Produk
bot.action('show_products', (ctx) => productHandler.showProducts(ctx));
bot.action(/add_to_cart_(\d+)/, (ctx) => orderHandler.addToCart(ctx));

// Keranjang & Checkout
bot.action('show_cart', (ctx) => orderHandler.showCart(ctx));
bot.action(/remove_cart_(\d+)/, (ctx) => orderHandler.removeFromCart(ctx));
bot.action('checkout', (ctx) => paymentHandler.checkout(ctx));

// Pesanan
bot.action('show_orders', (ctx) => orderHandler.showOrders(ctx));
bot.action(/order_detail_(\d+)/, (ctx) => orderHandler.showOrderDetail(ctx));

// Tracking
bot.action('show_tracking', (ctx) => trackingHandler.startTracking(ctx));

// Admin
bot.command('admin', (ctx) => adminHandler.adminMenu(ctx));

// ============ TEXT HANDLERS ============
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('#track_')) {
    const orderID = ctx.message.text.replace('#track_', '');
    trackingHandler.trackOrder(ctx, orderID);
  }
});

// ============ ERROR HANDLER ============
bot.catch((err) => {
  console.error('Bot Error:', err);
});

// ============ START BOT ============
bot.launch();

console.log('🤖 Bot Telegram E-Commerce Started!');
console.log('📍 Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Loaded' : '❌ Missing');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
