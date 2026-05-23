const db = require('../config/database');

class AdminHandler {
  async adminMenu(ctx) {
    try {
      // Check if user is admin
      const isAdmin = await this.checkAdmin(ctx.from.id);
      
      if (!isAdmin) {
        return ctx.reply('❌ Anda tidak memiliki akses admin.');
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '📦 Kelola Produk', callback_data: 'admin_products' }],
          [{ text: '📋 Kelola Pesanan', callback_data: 'admin_orders' }],
          [{ text: '💳 Kelola Pembayaran', callback_data: 'admin_payments' }],
          [{ text: '📊 Analytics & Report', callback_data: 'admin_analytics' }],
          [{ text: '🔔 Kirim Notifikasi', callback_data: 'admin_notify' }],
          [{ text: '⬅️ Kembali', callback_data: 'back_home' }]
        ]
      };

      const message = `
👨‍💼 PANEL ADMIN E-COMMERCE

Pilih menu untuk mengelola bot dan toko online Anda:
      `;

      await ctx.editMessageText(message, {
        reply_markup: keyboard
      }).catch(() => {
        ctx.reply(message, { reply_markup: keyboard });
      });
    } catch (error) {
      console.error('Admin menu error:', error);
      ctx.reply('❌ Gagal membuka menu admin.');
    }
  }

  async manageProducts(ctx) {
    try {
      const products = await db.getAllProducts();
      
      let message = '📦 KELOLA PRODUK\n\n';
      message += `Total Produk: ${products.length}\n\n`;

      products.forEach((product) => {
        message += `ID: ${product.id}\n`;
        message += `Nama: ${product.name}\n`;
        message += `Harga: Rp${product.price.toLocaleString('id-ID')}\n`;
        message += `Stok: ${product.stock}\n`;
        message += `─────────────────\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '➕ Tambah Produk', callback_data: 'admin_add_product' }],
          [{ text: '✏️ Edit Produk', callback_data: 'admin_edit_product' }],
          [{ text: '❌ Hapus Produk', callback_data: 'admin_delete_product' }],
          [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard
      }).catch(() => {
        ctx.reply(message, { reply_markup: keyboard });
      });
    } catch (error) {
      console.error('Manage products error:', error);
      ctx.reply('❌ Gagal memuat data produk.');
    }
  }

  async getAnalytics(ctx) {
    try {
      const stats = await db.getAnalytics();

      let message = `
📊 ANALYTICS & LAPORAN

📈 STATISTIK PENJUALAN:
Total Pesanan: ${stats.totalOrders}
Total Revenue: Rp${stats.totalRevenue.toLocaleString('id-ID')}
Pesanan Pending: ${stats.pendingOrders}
Pesanan Selesai: ${stats.completedOrders}

👥 PELANGGAN:
Total Pelanggan: ${stats.totalCustomers}
Pelanggan Baru (Hari Ini): ${stats.newCustomersToday}

💳 PEMBAYARAN:
Pembayaran Berhasil: Rp${stats.successfulPayments.toLocaleString('id-ID')}
Pembayaran Pending: Rp${stats.pendingPayments.toLocaleString('id-ID')}

📦 PRODUK:
Total Produk: ${stats.totalProducts}
Produk Terlaris: ${stats.topProduct?.name || 'N/A'}
      `;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📥 Download Report', callback_data: 'admin_download_report' }],
          [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard
      }).catch(() => {
        ctx.reply(message, { reply_markup: keyboard });
      });
    } catch (error) {
      console.error('Analytics error:', error);
      ctx.reply('❌ Gagal memuat analytics.');
    }
  }

  async manageOrders(ctx) {
    try {
      const orders = await db.getAllOrders();

      let message = '📋 KELOLA PESANAN\n\n';
      message += `Total Pesanan: ${orders.length}\n\n`;

      orders.slice(0, 10).forEach((order) => {
        message += `#${order.order_number}\n`;
        message += `Status: ${order.status}\n`;
        message += `Pembayaran: ${order.payment_status}\n`;
        message += `Total: Rp${order.total_price.toLocaleString('id-ID')}\n`;
        message += `─────────────────\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '✏️ Update Status Pesanan', callback_data: 'admin_update_order_status' }],
          [{ text: '📍 Update Pengiriman', callback_data: 'admin_update_shipping' }],
          [{ text: '❌ Batalkan Pesanan', callback_data: 'admin_cancel_order' }],
          [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard
      }).catch(() => {
        ctx.reply(message, { reply_markup: keyboard });
      });
    } catch (error) {
      console.error('Manage orders error:', error);
      ctx.reply('❌ Gagal memuat pesanan.');
    }
  }

  async sendNotification(ctx) {
    try {
      ctx.reply(`
🔔 KIRIM NOTIFIKASI

Pilih jenis notifikasi:
1. Ke semua pelanggan
2. Ke pelanggan tertentu
3. Notifikasi khusus pesanan

Balas pesan ini dengan format:
notif all: [pesan]
notif user [id]: [pesan]
      `);
    } catch (error) {
      console.error('Send notification error:', error);
      ctx.reply('❌ Gagal membuka menu notifikasi.');
    }
  }

  async checkAdmin(telegramId) {
    // Check if user is admin
    const adminId = process.env.ADMIN_ID;
    return telegramId === parseInt(adminId);
  }
}

module.exports = new AdminHandler();
