const db = require('../config/database');

class TrackingHandler {
  async startTracking(ctx) {
    try {
      const orders = await db.getOrders(ctx.from.id);
      if (!orders.length) {
        return this.replyOrEdit(ctx, '📍 Belum ada pesanan yang bisa dilacak.', {
          inline_keyboard: [[{ text: '🛍️ Belanja Sekarang', callback_data: 'show_products' }]]
        });
      }

      const keyboard = orders.slice(0, 10).map(order => ([
        { text: `📍 ${order.order_number}`, callback_data: `track_order_${order.id}` }
      ]));
      keyboard.push([{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]);

      await this.replyOrEdit(ctx, 'Pilih pesanan yang ingin dilacak:', { inline_keyboard: keyboard });
    } catch (error) {
      console.error('Start tracking error:', error);
      ctx.reply('❌ Gagal membuka tracking.');
    }
  }

  async trackOrder(ctx, orderIdOrNumber = null) {
    try {
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
      const value = orderIdOrNumber || ctx.match?.[1];
      const order = String(value).startsWith('ORD-') ? await db.getOrderByNumber(value) : await db.getOrderById(Number(value));
      if (!order || order.telegram_id !== ctx.from.id) return ctx.reply('❌ Pesanan tidak ditemukan.');

      let shipping = await db.getShipping(order.id);
      if (!shipping) {
        await db.createShipping(order.id, { status: order.status || 'processing' });
        shipping = await db.getShipping(order.id);
      }

      const message = `📍 TRACKING PESANAN\n\n` +
        `Nomor Pesanan: ${order.order_number}\n` +
        `Status Pesanan: ${order.status}\n` +
        `Status Pembayaran: ${order.payment_status}\n` +
        `Kurir: ${shipping.courier || '-'}\n` +
        `Resi: ${shipping.tracking_number || '-'}\n` +
        `Lokasi: ${shipping.location || '-'}\n` +
        `Status Kirim: ${shipping.status || '-'}\n` +
        `Update: ${shipping.updated_at || '-'}`;

      await this.replyOrEdit(ctx, message, {
        inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'show_tracking' }]]
      });
    } catch (error) {
      console.error('Track order error:', error);
      ctx.reply('❌ Gagal melacak pesanan.');
    }
  }

  async replyOrEdit(ctx, message, reply_markup) {
    if (ctx.callbackQuery) {
      return ctx.editMessageText(message, { reply_markup }).catch(() => ctx.reply(message, { reply_markup }));
    }
    return ctx.reply(message, { reply_markup });
  }
}

module.exports = new TrackingHandler();
