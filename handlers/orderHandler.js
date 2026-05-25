const db = require('../config/database');

class OrderHandler {
  formatPrice(value) {
    return Number(value || 0).toLocaleString('id-ID');
  }

  paymentLabel(order) {
    if (order.payment_status === 'paid' && order.digital_delivered) return '📦 Produk Terkirim';
    if (order.payment_status === 'paid') return '✅ Dibayar';
    if (order.payment_status === 'expired') return '⏱️ Expired';
    if (order.payment_status === 'failed') return '❌ Gagal';
    return '⏳ Menunggu Pembayaran';
  }

  async addToCart(ctx) {
    try {
      await ctx.answerCbQuery().catch(() => {});
      await db.addUser(ctx.from.id, ctx.from);
      const productId = Number(ctx.match[1]);
      await db.addToCart(ctx.from.id, productId, 1);
      await ctx.reply('✅ Produk berhasil ditambahkan ke keranjang.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Lihat Keranjang', callback_data: 'show_cart' }],
            [{ text: '🛍️ Lanjut Belanja', callback_data: 'show_products' }]
          ]
        }
      });
    } catch (error) {
      console.error('Add to cart error:', error);
      ctx.reply(`❌ ${error.message || 'Gagal menambah produk ke keranjang.'}`);
    }
  }

  async showCart(ctx) {
    try {
      await db.addUser(ctx.from.id, ctx.from);
      const items = await db.getCart(ctx.from.id);

      if (!items.length) {
        return this.replyOrEdit(ctx, '🛒 Keranjang kamu masih kosong.', {
          inline_keyboard: [[{ text: '🛍️ Lihat Produk', callback_data: 'show_products' }]]
        });
      }

      let total = 0;
      let message = '🛒 KERANJANG BELANJA\n\n';
      const keyboard = [];

      items.forEach((item) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        message += `${item.name}\n`;
        message += `${item.quantity} x Rp${this.formatPrice(item.price)} = Rp${this.formatPrice(subtotal)}\n`;
        message += `─────────────────\n`;
        keyboard.push([{ text: `❌ Hapus ${item.name}`, callback_data: `remove_cart_${item.id}` }]);
      });

      message += `\n💰 Total: Rp${this.formatPrice(total)}`;
      message += `\n🎟️ Punya kupon? Ketik: voucher KODE` ;
      message += `\n\n⚠️ Sebelum checkout, kamu akan melihat ringkasan deskripsi dan S&K produk terlebih dahulu.`;
      keyboard.push([{ text: '✅ Lanjut Review Checkout', callback_data: 'checkout_review' }]);
      keyboard.push([{ text: '🛍️ Lanjut Belanja', callback_data: 'show_products' }]);

      await this.replyOrEdit(ctx, message, { inline_keyboard: keyboard });
    } catch (error) {
      console.error('Show cart error:', error);
      ctx.reply('❌ Gagal memuat keranjang.');
    }
  }


  async showCheckoutReview(ctx) {
    try {
      await db.addUser(ctx.from.id, ctx.from);
      const items = await db.getCart(ctx.from.id);

      if (!items.length) {
        return this.replyOrEdit(ctx, '🛒 Keranjang kamu masih kosong.', {
          inline_keyboard: [[{ text: '🛍️ Lihat Produk', callback_data: 'show_products' }]]
        });
      }

      let total = 0;
      let message = '✅ REVIEW SEBELUM CHECKOUT\n\n';
      message += 'Baca ulang nama produk, jenis barang, deskripsi, dan S&K di bawah ini sebelum membuat pesanan.\n\n';

      items.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        const description = item.description || 'Belum ada deskripsi produk.';
        const terms = item.terms_conditions || 'Produk digital dikirim setelah pembayaran berhasil. Produk yang sudah dikirim tidak bisa dibatalkan kecuali ada kesalahan dari admin.';
        const type = item.delivery_type === 'file' ? 'File digital' : item.delivery_type === 'text' ? 'Text digital' : 'File + Text digital';

        message += `${index + 1}. ${item.name}\n`;
        message += `Jenis: ${type}\n`;
        message += `Kategori: ${item.category || '-'}\n`;
        message += `Jumlah: ${item.quantity}\n`;
        message += `Harga: Rp${this.formatPrice(item.price)}\n`;
        message += `Subtotal: Rp${this.formatPrice(subtotal)}\n`;
        message += `Deskripsi: ${description}\n`;
        message += `S&K: ${terms}\n`;
        message += `─────────────────\n`;
      });

      message += `\n💰 Total Checkout: Rp${this.formatPrice(total)}\n\n`;
      message += 'Dengan menekan tombol di bawah, kamu menyatakan sudah membaca deskripsi dan S&K produk.';

      await this.replyOrEdit(ctx, message, {
        inline_keyboard: [
          [{ text: '✅ Saya Setuju, Buat Pesanan', callback_data: 'checkout' }],
          [{ text: '⬅️ Kembali ke Keranjang', callback_data: 'show_cart' }]
        ]
      });
    } catch (error) {
      console.error('Checkout review error:', error);
      ctx.reply('❌ Gagal memuat review checkout.');
    }
  }

  async removeFromCart(ctx) {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const cartId = Number(ctx.match[1]);
      await db.removeFromCart(cartId, ctx.from.id);
      await this.showCart(ctx);
    } catch (error) {
      console.error('Remove cart error:', error);
      ctx.reply('❌ Gagal menghapus item.');
    }
  }

  async showOrders(ctx) {
    try {
      const orders = await db.getOrders(ctx.from.id);
      if (!orders.length) {
        return this.replyOrEdit(ctx, '📦 Kamu belum memiliki pesanan.', {
          inline_keyboard: [[{ text: '🛍️ Mulai Belanja', callback_data: 'show_products' }]]
        });
      }

      let message = '📦 PESANAN SAYA\n\n';
      const keyboard = [];
      orders.slice(0, 10).forEach((order) => {
        message += `#${order.order_number}\n`;
        message += `Status: ${this.paymentLabel(order)}\n`;
        message += `Pembayaran: ${order.payment_status}\n`;
        message += `Total: Rp${this.formatPrice(order.total_price)}\n`;
        message += `─────────────────\n`;
        keyboard.push([{ text: `Detail ${order.order_number}`, callback_data: `order_detail_${order.id}` }]);
      });
      keyboard.push([{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]);

      await this.replyOrEdit(ctx, message, { inline_keyboard: keyboard });
    } catch (error) {
      console.error('Show orders error:', error);
      ctx.reply('❌ Gagal memuat pesanan.');
    }
  }

  async showOrderDetail(ctx) {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const orderId = Number(ctx.match[1]);
      const order = await db.getOrderById(orderId);
      if (!order || order.telegram_id !== ctx.from.id) return ctx.reply('❌ Pesanan tidak ditemukan.');

      const items = await db.getOrderItems(orderId);
      let message = `📋 DETAIL PESANAN\n\n#${order.order_number}\n`;
      message += `Status: ${this.paymentLabel(order)}\nPembayaran: ${order.payment_status}\n`;
      message += `Alamat: ${order.shipping_address || '-'}\n\nItem:\n`;
      items.forEach((item) => {
        message += `- ${item.name} x${item.quantity} = Rp${this.formatPrice(item.price * item.quantity)}\n`;
      });
      message += `\n💰 Total: Rp${this.formatPrice(order.total_price)}`;

      await this.replyOrEdit(ctx, message, {
        inline_keyboard: [
          [{ text: '📍 Tracking', callback_data: `track_order_${order.id}` }],
          [{ text: '⬅️ Kembali', callback_data: 'show_orders' }]
        ]
      });
    } catch (error) {
      console.error('Order detail error:', error);
      ctx.reply('❌ Gagal memuat detail pesanan.');
    }
  }


  async applyVoucher(ctx, code) {
    try {
      const coupon = await db.applyUserCoupon(ctx.from.id, code);
      return ctx.reply(`✅ Kupon ${coupon.code} berhasil dipasang. Buka keranjang/review checkout untuk melihat diskon.`);
    } catch (error) {
      return ctx.reply(`❌ ${error.message}`);
    }
  }

  async replyOrEdit(ctx, message, reply_markup) {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
      return ctx.editMessageText(message, { reply_markup }).catch(() => ctx.reply(message, { reply_markup }));
    }
    return ctx.reply(message, { reply_markup });
  }
}

module.exports = new OrderHandler();
