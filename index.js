const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { Telegraf } = require('telegraf');
const db = require('./config/database');
const productHandler = require('./handlers/productHandler');
const orderHandler = require('./handlers/orderHandler');
const paymentHandler = require('./handlers/paymentHandler');
const trackingHandler = require('./handlers/trackingHandler');
const adminHandler = require('./handlers/adminHandler');
const backupService = require('./services/backupService');
const adminContactService = require('./services/adminContactService');
const adminNotifyService = require('./services/adminNotifyService');
const preOrderHandler = require('./handlers/preOrderHandler');
const cleanupService = require('./services/cleanupService');

if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.includes('your_')) {
  console.error('❌ TELEGRAM_BOT_TOKEN belum diisi. Edit file .env terlebih dahulu.');
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use(async (ctx, next) => {
  try {
    const isAdmin = ctx.from?.id && adminNotifyService.isAdmin(ctx.from.id);
    const maintenance = await db.isMaintenanceMode().catch(() => false);
    if (maintenance && !isAdmin) {
      return ctx.reply('⚠️ Bot sedang maintenance. Silakan coba lagi nanti.');
    }
    return next();
  } catch (error) {
    console.error('Maintenance middleware error:', error);
    return next();
  }
});

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🛍️ Katalog Produk', callback_data: 'show_products' }],
      [{ text: '📝 Pre Order / Request Produk', callback_data: 'preorder_start' }],
      [{ text: '📋 Pre Order Saya', callback_data: 'preorder_mine' }],
      [{ text: '🛒 Keranjang Saya', callback_data: 'show_cart' }],
      [{ text: '📦 Pesanan Saya', callback_data: 'show_orders' }],
      [{ text: '📍 Tracking Pesanan', callback_data: 'show_tracking' }],
      [{ text: '☎️ Hubungi Admin', callback_data: 'contact_admin' }],
      [{ text: '❓ Bantuan', callback_data: 'show_help' }]
    ]
  };
}

async function showHome(ctx) {
  await db.addUser(ctx.from.id, ctx.from);
  const message = '🎉 Selamat datang di Bot E-Commerce! 🎉\n\nPilih menu di bawah untuk memulai belanja:';
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(message, { reply_markup: mainKeyboard() }).catch(() => ctx.reply(message, { reply_markup: mainKeyboard() }));
  }
  return ctx.reply(message, { reply_markup: mainKeyboard() });
}


function getAdminContactInfo() {
  const username = (process.env.ADMIN_USERNAME || '').replace('@', '').trim();
  const displayName = (process.env.ADMIN_DISPLAY_NAME || '').trim();
  const contactUrl = (process.env.ADMIN_CONTACT_URL || '').trim();
  const adminId = String(process.env.ADMIN_ID || '').trim();
  const contactText = process.env.ADMIN_CONTACT_TEXT || 'Silakan hubungi admin untuk bantuan pembayaran, kendala produk, atau pertanyaan sebelum membeli.';

  let url = contactUrl;
  if (!url && username) url = `https://t.me/${username}`;
  if (!url && /^\d+$/.test(adminId)) url = `tg://user?id=${adminId}`;

  return { username, displayName, url, contactText };
}

async function showContactAdmin(ctx) {
  const { username, displayName, url, contactText } = getAdminContactInfo();
  const adminLine = username ? `👤 Admin: @${username}` : `👤 Admin: ${displayName || 'belum disetel username publik.'}`;
  const message = `☎️ HUBUNGI ADMIN\n\n${contactText}\n\n${adminLine}\n\nGunakan menu ini jika kamu butuh bantuan pembayaran QRIS/GoPay, produk belum terkirim, atau ingin bertanya sebelum checkout.`;
  const keyboard = [];
  if (url) keyboard.push([{ text: '💬 Chat Admin', url }]);
  keyboard.push([{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(message, { reply_markup: { inline_keyboard: keyboard } }).catch(() => ctx.reply(message, { reply_markup: { inline_keyboard: keyboard } }));
  }
  return ctx.reply(message, { reply_markup: { inline_keyboard: keyboard } });
}

function helpMessage() {
  return `📖 PANDUAN PENGGUNAAN BOT\n\n` +
    `/start - Menu utama\n` +
    `/products - Lihat semua produk\n` +
    `/cart - Lihat keranjang belanja\n` +
    `/orders - Riwayat pesanan\n` +
    `/preorder - Request produk pre order\n` +
    `/tracking - Lacak pesanan\n` +
    `/contact - Hubungi admin\n` +
    `/help - Bantuan ini\n\n` +
    `💡 Tips:\n` +
    `- Gunakan tombol untuk navigasi yang lebih mudah\n` +
    `- Semua produk bisa ditambah ke keranjang\n` +
    `- Checkout hanya di menu Keranjang\n` +
    `- Pembayaran menggunakan QRIS/GoPay otomatis. Setelah sukses, produk digital langsung dikirim`;
}

bot.start(showHome);
bot.command('products', (ctx) => productHandler.showProducts(ctx));
bot.command('search', (ctx) => { const q = (ctx.message.text || '').replace('/search','').trim(); if (!q) return ctx.reply('Kirim format: /search nama produk'); return productHandler.searchProducts(ctx, q); });
bot.command('cart', (ctx) => orderHandler.showCart(ctx));
bot.command('preorder', (ctx) => preOrderHandler.start(ctx));
bot.command('preordersaya', (ctx) => preOrderHandler.listMine(ctx));
bot.command('orders', (ctx) => orderHandler.showOrders(ctx));
bot.command('tracking', (ctx) => trackingHandler.startTracking(ctx));
bot.command('help', (ctx) => ctx.reply(helpMessage()));
bot.command('contact', showContactAdmin);
bot.command('admin', (ctx) => adminHandler.adminMenu(ctx));
bot.command('cleanup', (ctx) => adminHandler.runCleanup(ctx));
bot.command('broadcast', async (ctx) => {
  const text = (ctx.message.text || '').replace('/broadcast', '').trim();
  if (!text) return adminHandler.broadcastMenu(ctx);
  if (!(await adminHandler.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
  adminHandler.pendingBroadcastAdmins.add(ctx.from.id);
  adminHandler.broadcastDrafts.set(ctx.from.id, { type: 'text', text, status: 'preview' });
  return ctx.reply(`📣 PREVIEW BROADCAST TEXT\n\n${text}\n\nKirim ke semua user?`, { reply_markup: { inline_keyboard: [[{ text: '✅ Kirim Broadcast', callback_data: 'broadcast_confirm' }], [{ text: '❌ Batal', callback_data: 'broadcast_cancel' }]] } });
});
bot.command('voucher', (ctx) => {
  const code = (ctx.message.text || '').replace('/voucher', '').trim();
  if (!code) return ctx.reply('Kirim format: /voucher KODE');
  return orderHandler.applyVoucher(ctx, code);
});

bot.action('back_home', showHome);
bot.action('contact_admin', showContactAdmin);
bot.action('preorder_start', (ctx) => preOrderHandler.start(ctx));
bot.action('preorder_accept_terms', (ctx) => preOrderHandler.acceptTerms(ctx));
bot.action('preorder_mine', (ctx) => preOrderHandler.listMine(ctx));
bot.action(/preorder_pay_(\d+)/, (ctx) => preOrderHandler.userPay(ctx));
bot.action(/preorder_user_cancel_(\d+)/, (ctx) => preOrderHandler.userCancel(ctx));
bot.action('preorder_cancel', (ctx) => preOrderHandler.cancel(ctx));

bot.action('show_help', (ctx) => ctx.answerCbQuery().catch(() => {}).then(() => ctx.editMessageText(helpMessage(), { reply_markup: { inline_keyboard: [[{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]] } }).catch(() => ctx.reply(helpMessage()))));

bot.action('show_products', (ctx) => productHandler.showProducts(ctx));
bot.action(/products_page_(\d+)/, (ctx) => productHandler.showProducts(ctx, Number(ctx.match[1])));
bot.action('show_categories', (ctx) => productHandler.showCategories(ctx));
bot.action('search_help', (ctx) => productHandler.searchHelp(ctx));
bot.action(/category_(.+)/, (ctx) => productHandler.showProducts(ctx, 1, decodeURIComponent(ctx.match[1])));
bot.action(/product_detail_(\d+)/, (ctx) => productHandler.showProductDetail(ctx));
bot.action(/add_to_cart_(\d+)/, (ctx) => orderHandler.addToCart(ctx));

bot.action('show_cart', (ctx) => orderHandler.showCart(ctx));
bot.action(/remove_cart_(\d+)/, (ctx) => orderHandler.removeFromCart(ctx));
bot.action('checkout_review', (ctx) => orderHandler.showCheckoutReview(ctx));
bot.action('checkout', (ctx) => paymentHandler.checkout(ctx));
bot.action(/payment_help_(.+)/, (ctx) => paymentHandler.showPaymentHelp(ctx));

bot.action('show_orders', (ctx) => orderHandler.showOrders(ctx));
bot.action(/order_detail_(\d+)/, (ctx) => orderHandler.showOrderDetail(ctx));

bot.action('show_tracking', (ctx) => trackingHandler.startTracking(ctx));
bot.action(/track_order_(\d+)/, (ctx) => trackingHandler.trackOrder(ctx));

bot.action('admin_menu', (ctx) => adminHandler.adminMenu(ctx));
bot.action('admin_dashboard', (ctx) => adminHandler.dashboard(ctx));
bot.action('admin_preorders', (ctx) => preOrderHandler.listAdmin(ctx));
bot.action(/admin_preorders_(submitted|quoted|waiting_payment|process|revision_requested|delivered)/, (ctx) => preOrderHandler.listAdmin(ctx, ctx.match[1]));
bot.action('admin_products', (ctx) => adminHandler.manageProducts(ctx));
bot.action(/admin_product_(\d+)/, (ctx) => adminHandler.showAdminProduct(ctx));
bot.action(/admin_toggle_product_(\d+)/, (ctx) => adminHandler.toggleProduct(ctx));
bot.action(/admin_delete_product_(\d+)/, (ctx) => adminHandler.deleteProduct(ctx));
bot.action('admin_add_product', (ctx) => adminHandler.promptAddProduct(ctx));
bot.action('admin_add_type_text', (ctx) => adminHandler.chooseProductType(ctx, 'text'));
bot.action('admin_add_type_file', (ctx) => adminHandler.chooseProductType(ctx, 'file'));
bot.action('admin_add_type_file_text', (ctx) => adminHandler.chooseProductType(ctx, 'file_text'));
bot.action('admin_orders', (ctx) => adminHandler.manageOrders(ctx));
bot.action('admin_analytics', (ctx) => adminHandler.getAnalytics(ctx));
bot.action('admin_report_today', (ctx) => adminHandler.getAnalytics(ctx, 'today'));
bot.action('admin_report_week', (ctx) => adminHandler.getAnalytics(ctx, 'week'));
bot.action('admin_report_month', (ctx) => adminHandler.getAnalytics(ctx, 'month'));
bot.action('admin_coupons', (ctx) => adminHandler.couponMenu(ctx));
bot.action('admin_export', (ctx) => adminHandler.exportMenu(ctx));
bot.action(/export_(orders|payments|products|users|coupons|audit)_(csv|json)/, (ctx) => adminHandler.exportData(ctx, ctx.match[1], ctx.match[2]));
bot.action('admin_settings', (ctx) => adminHandler.settingsMenu(ctx));
bot.action('admin_broadcast', (ctx) => adminHandler.broadcastMenu(ctx));
bot.action('broadcast_start_text', (ctx) => adminHandler.startBroadcast(ctx, 'text'));
bot.action('broadcast_start_photo', (ctx) => adminHandler.startBroadcast(ctx, 'photo'));
bot.action('broadcast_start_video', (ctx) => adminHandler.startBroadcast(ctx, 'video'));
bot.action('broadcast_confirm', (ctx) => adminHandler.confirmBroadcast(ctx));
bot.action('broadcast_cancel', (ctx) => adminHandler.cancelBroadcast(ctx));
bot.action('admin_maintenance', (ctx) => adminHandler.maintenanceMenu(ctx));
bot.action('admin_maintenance_on', (ctx) => adminHandler.setMaintenance(ctx, true));
bot.action('admin_maintenance_off', (ctx) => adminHandler.setMaintenance(ctx, false));
bot.action('admin_errors', (ctx) => adminHandler.errorLogs(ctx));
bot.action('admin_audit', (ctx) => adminHandler.auditLogs(ctx));
bot.action('admin_cleanup', (ctx) => adminHandler.cleanupMenu(ctx));
bot.action('admin_cleanup_now', (ctx) => adminHandler.runCleanup(ctx));
bot.action('admin_backup', (ctx) => adminHandler.backupMenu(ctx));
bot.action('admin_backup_now', (ctx) => adminHandler.createManualBackup(ctx));
bot.action('admin_restore_backup', (ctx) => adminHandler.promptRestoreBackup(ctx));
bot.action('admin_cancel_restore', (ctx) => adminHandler.cancelRestore(ctx));
bot.action('admin_sync_contact', (ctx) => adminHandler.syncAdminContact(ctx));
bot.action('admin_notify', (ctx) => adminHandler.sendNotification(ctx));
bot.action(/admin_.*/, (ctx) => ctx.answerCbQuery('Fitur admin ini belum dibuat interaktif.').catch(() => {}));

bot.on('photo', async (ctx) => {
  const handledPoDelivery = await preOrderHandler.handleAdminDelivery(ctx);
  if (handledPoDelivery) return;
  const handledPo = await preOrderHandler.handleUserRequest(ctx);
  if (handledPo) return;
  const handled = await adminHandler.handleBroadcastPhoto(ctx);
  if (!handled) return ctx.reply('Gunakan /start untuk membuka menu utama.');
});

bot.on('video', async (ctx) => {
  const handledPoDelivery = await preOrderHandler.handleAdminDelivery(ctx);
  if (handledPoDelivery) return;
  const handledPo = await preOrderHandler.handleUserRequest(ctx);
  if (handledPo) return;
  const handled = await adminHandler.handleBroadcastVideo(ctx);
  if (!handled) return ctx.reply('Gunakan /start untuk membuka menu utama.');
});

bot.on('document', async (ctx) => {
  const handledPoDelivery = await preOrderHandler.handleAdminDelivery(ctx);
  if (handledPoDelivery) return;
  const handledPo = await preOrderHandler.handleUserRequest(ctx);
  if (handledPo) return;
  return adminHandler.handleProductUpload(ctx);
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text || '';

  const handledPoDelivery = await preOrderHandler.handleAdminDelivery(ctx);
  if (handledPoDelivery) return;

  const handledPo = await preOrderHandler.handleUserRequest(ctx);
  if (handledPo) return;

  const ratingMatch = text.match(/^rating\s+(ORD-[\w-]+)\s+(\d+)\s+(\d)(?:\s+([\s\S]+))?/i);
  if (ratingMatch) {
    const order = await db.getOrderByNumber(ratingMatch[1]);
    if (!order || order.telegram_id !== ctx.from.id) return ctx.reply('❌ Order tidak ditemukan.');
    await db.saveRating(order.id, Number(ratingMatch[2]), ctx.from.id, Number(ratingMatch[3]), ratingMatch[4] || null);
    return ctx.reply('✅ Terima kasih, rating produk berhasil disimpan.');
  }

  if (/^setpo\s+/i.test(text)) {
    return preOrderHandler.setQuote(ctx, text);
  }

  if (/^editpo\s+/i.test(text)) {
    return preOrderHandler.editQuote(ctx, text);
  }

  if (/^cancelpo\s+/i.test(text)) {
    return preOrderHandler.cancelByAdmin(ctx, text);
  }

  if (/^invoicepo\s+/i.test(text)) {
    const ref = text.replace(/^invoicepo\s+/i, '').trim();
    return preOrderHandler.invoice(ctx, ref);
  }

  if (/^revision\s+/i.test(text)) {
    return preOrderHandler.requestRevision(ctx, text);
  }

  if (/^completepo\s+/i.test(text)) {
    return preOrderHandler.complete(ctx, text);
  }

  if (/^cekpo\s+/i.test(text)) {
    const ref = text.replace(/^cekpo\s+/i, '').trim();
    return preOrderHandler.check(ctx, ref);
  }

  if (/^sendpo\s+/i.test(text)) {
    const ref = text.replace(/^sendpo\s+/i, '').trim();
    return preOrderHandler.beginSendResult(ctx, ref);
  }

  const handledPreOrderDelivery = await preOrderHandler.handleAdminDelivery(ctx);
  if (handledPreOrderDelivery) return;

  if (/^paid\s+/i.test(text)) {
    const orderNumber = text.replace(/^paid\s+/i, '').trim();
    return paymentHandler.markPaidAndDeliver(ctx, orderNumber);
  }

  if (/^voucher\s+/i.test(text)) {
    const code = text.replace(/^voucher\s+/i, '').trim();
    return orderHandler.applyVoucher(ctx, code);
  }

  if (/^reject\s+/i.test(text)) {
    const orderNumber = text.replace(/^reject\s+/i, '').trim();
    return paymentHandler.rejectPayment(ctx, orderNumber);
  }

  const handledProductText = await adminHandler.handleProductText(ctx);
  if (handledProductText) return;

  if (text.startsWith('#track_')) {
    const orderId = text.replace('#track_', '').trim();
    return trackingHandler.trackOrder(ctx, orderId);
  }
  return ctx.reply('Gunakan /start untuk membuka menu utama.');
});

bot.catch(async (err, ctx) => {
  console.error('Bot Error:', err);
  await db.logError('bot.catch', err).catch(() => {});
  await adminNotifyService.sendToAdmins(bot.telegram, `⚠️ BOT ERROR\n\nSource: bot.catch\nUser: ${ctx?.from?.id || '-'}\nError: ${err.message || err}`).catch(() => {});
});

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'ok', service: 'telegram-ecommerce-bot' }));
app.get('/health', async (req, res) => {
  try {
    await db.get('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'ok', qris: process.env.PAYMENT || 'GOPAY', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'error', message: error.message });
  }
});
app.post('/payment/notification', async (req, res) => {
  res.json({ status: 'ok', message: 'Pembayaran memakai GOPAY QRIS otomatis via polling status.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🌐 Webhook server listening on port ${port}`));


function startPaymentReminder(botInstance) {
  const intervalMs = Math.max(60000, Number(process.env.PAYMENT_REMINDER_INTERVAL_MS || 120000));
  setInterval(async () => {
    try {
      const rows = await db.getPendingPaymentReminders();
      for (const order of rows) {
        await botInstance.telegram.sendMessage(order.telegram_id, `⏳ Kamu masih punya pembayaran pending.

Order: ${order.order_number}
Total: Rp ${Number(order.total_price || 0).toLocaleString('id-ID')}

Silakan bayar sebelum QRIS expired. Jika QRIS sudah expired, checkout ulang.`).catch(() => {});
        await db.markReminderSent(order.id).catch(() => {});
      }
    } catch (error) {
      console.error('Payment reminder error:', error.message);
    }
  }, intervalMs);
}

bot.launch();
adminContactService.syncAdminContact(bot.telegram).then((result) => {
  if (result.ok) {
    console.log('☎️ Admin contact synced:', result.hasUsername ? `@${result.username}` : result.contactUrl);
  } else {
    console.log('⚠️ Admin contact sync skipped:', result.reason);
  }
}).catch((err) => console.error('Admin contact sync error:', err));
paymentHandler.startAutoQrisPolling(bot);
preOrderHandler.startQuoteExpiryWatcher(bot);
startPaymentReminder(bot);
backupService.startAutoBackup(bot);
cleanupService.start(bot);
console.log('🤖 Bot Telegram E-Commerce Started!');
console.log('📍 Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Loaded' : '❌ Missing');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
