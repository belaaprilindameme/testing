const midtransClient = require('midtrans-client');
const db = require('../config/database');

class PaymentHandler {
  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });
  }

  async checkout(ctx) {
    try {
      const telegramId = ctx.from.id;
      const cartItems = await db.getCart(telegramId);

      if (!cartItems || cartItems.length === 0) {
        return ctx.reply('🛒 Keranjang kosong! Tambahkan produk terlebih dahulu.');
      }

      // Calculate total
      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create order
      const orderResult = await db.createOrder(telegramId, total, 'Alamat akan ditentukan nanti');

      // Add order items
      for (const item of cartItems) {
        await db.addOrderItem(orderResult.id, item.product_id, item.quantity, item.price);
      }

      // Create payment transaction
      const transactionDetails = {
        order_id: orderResult.orderNumber,
        gross_amount: Math.round(total)
      };

      const itemDetails = cartItems.map(item => ({
        id: item.product_id,
        price: Math.round(item.price),
        quantity: item.quantity,
        name: item.name
      }));

      const customerDetails = {
        first_name: ctx.from.first_name || 'Customer',
        last_name: ctx.from.last_name || '',
        email: `user_${telegramId}@telegram.local`,
        phone: '08123456789'
      };

      const parameter = {
        transaction_details: transactionDetails,
        item_details: itemDetails,
        customer_details: customerDetails
      };

      // Get payment link
      const transaction = await this.snap.createTransaction(parameter);
      const paymentUrl = transaction.redirect_url;

      // Save payment info to database
      await db.createPayment(orderResult.id, total, 'midtrans', transaction.token);

      // Clear cart after checkout
      await db.clearCart(telegramId);

      // Send payment link to user
      const message = `
✅ PESANAN BERHASIL DIBUAT!

📋 Nomor Pesanan: *${orderResult.orderNumber}*
💰 Total: *Rp${total.toLocaleString('id-ID')}*

🔐 Silakan lakukan pembayaran dengan mengklik tombol di bawah:
      `;

      const keyboard = {
        inline_keyboard: [
          [{ text: '💳 Bayar Sekarang', url: paymentUrl }],
          [{ text: '📦 Lihat Pesanan', callback_data: 'show_orders' }]
        ]
      };

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }).catch(() => {
        ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      });
    } catch (error) {
      console.error('Payment error:', error);
      ctx.reply('❌ Gagal memproses pembayaran. Silakan coba lagi.');
    }
  }

  async handlePaymentNotification(req) {
    try {
      const orderId = req.body.order_id;
      const status = req.body.transaction_status;
      const paymentType = req.body.payment_type;

      let paymentStatus = 'pending';
      if (status === 'settlement') {
        paymentStatus = 'paid';
      } else if (status === 'pending') {
        paymentStatus = 'pending';
      } else if (status === 'deny' || status === 'cancel' || status === 'expire') {
        paymentStatus = 'failed';
      }

      // Update order payment status
      await db.updateOrderPaymentStatus(orderId, paymentStatus);

      // Send notification to user
      // This would typically be done through a notification system

      return { success: true, status: paymentStatus };
    } catch (error) {
      console.error('Payment notification error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PaymentHandler();
