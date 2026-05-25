require('dotenv').config();
const axios = require('axios');
const db = require('../config/database');
const adminNotifyService = require('../services/adminNotifyService');

class PaymentHandler {
  constructor() {
    this.isCheckingQRISStatus = false;
    this.pollingStarted = false;
    this.paymentHttp = axios.create({
      timeout: Number(process.env.PAYMENT_REQUEST_TIMEOUT || 10000),
      validateStatus: () => true
    });
  }

  formatPrice(value) {
    return Number(value || 0).toLocaleString('id-ID');
  }

  getPaymentConfig() {
    return {
      payment: process.env.PAYMENT || 'GOPAY',
      gopayKey: process.env.GOPAY_KEY || '',
      qrisGenerateUrl: process.env.GOPAY_QRIS_GENERATE_URL || 'https://v1-gateway.autogopay.site/qris/generate',
      qrisStatusUrl: process.env.GOPAY_QRIS_STATUS_URL || 'https://v1-gateway.autogopay.site/qris/status',
      qrisExpiredMinutes: Number(process.env.QRIS_EXPIRED_MINUTES || 10),
      qrisCheckIntervalMs: Number(process.env.QRIS_CHECK_INTERVAL_MS || 5000),
      paymentNote: process.env.PAYMENT_NOTE || 'Scan QRIS, bayar sesuai nominal, lalu tunggu bot memverifikasi pembayaran otomatis.'
    };
  }

  async createAutoQris(amount) {
    const cfg = this.getPaymentConfig();
    if (cfg.payment !== 'GOPAY') throw new Error('PAYMENT harus GOPAY untuk auto QRIS.');
    if (!cfg.gopayKey) throw new Error('GOPAY_KEY belum diisi di .env.');

    const res = await this.paymentHttp.post(
      cfg.qrisGenerateUrl,
      { amount: Number(amount) },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.gopayKey}`
        }
      }
    );

    if (res.status >= 400 || !res.data?.success) {
      throw new Error(res.data?.message || `Gagal membuat QRIS. HTTP ${res.status}`);
    }

    const data = res.data.data || {};
    if (!data.qr_url) throw new Error('QR URL kosong dari provider GOPAY/QRIS.');
    if (!data.transaction_id) throw new Error('transaction_id kosong dari provider GOPAY/QRIS.');

    return {
      transactionId: data.transaction_id,
      qrUrl: String(data.qr_url).trim()
    };
  }

  async buildQrPhotoInput(qrUrl) {
    const safeUrl = String(qrUrl || '').trim();
    if (!safeUrl) throw new Error('QR URL kosong.');

    const res = await this.paymentHttp.get(safeUrl, {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'image/png,image/jpeg,image/webp,image/*;q=0.8,*/*;q=0.5'
      }
    });

    if (res.status >= 400 || !res.data) {
      throw new Error(`Gagal mengunduh gambar QRIS. HTTP ${res.status}`);
    }

    const contentType = String(res.headers['content-type'] || '').toLowerCase();
    let ext = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('webp')) ext = 'webp';

    return { source: Buffer.from(res.data), filename: `qris-dinamis.${ext}` };
  }

  async checkout(ctx) {
    try {
      const telegramId = ctx.from.id;
      const cartItems = await db.getCart(telegramId);

      if (!cartItems.length) {
        return ctx.reply('🛒 Keranjang kosong! Tambahkan produk terlebih dahulu.');
      }

      const originalTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const coupon = await db.getUserCoupon(telegramId);
      const discount = db.calculateDiscount(originalTotal, coupon);
      const total = Math.max(0, originalTotal - discount);
      const cfg = this.getPaymentConfig();

      if (total > 0 && (cfg.payment !== 'GOPAY' || !cfg.gopayKey)) {
        return ctx.reply('❌ Payment auto QRIS belum aktif. Admin harus mengisi PAYMENT=GOPAY dan GOPAY_KEY di .env.');
      }

      const orderResult = await db.createOrder(telegramId, total, 'Produk digital - dikirim otomatis setelah pembayaran QRIS berhasil');

      for (const item of cartItems) {
        await db.addOrderItem(orderResult.id, item.product_id, item.quantity, item.price);
        await db.reduceStock(item.product_id, item.quantity);
      }

      const userLine = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();

      if (total <= 0) {
        await db.createPayment(orderResult.id, 0, 'coupon_free', `FREE-${orderResult.id}`, null);
        await db.updateOrderPaymentStatus(orderResult.orderNumber, 'paid');
        await adminNotifyService.sendToAdmins(ctx.telegram,
          `🛒 ORDER BARU / KUPON 100%\n\nOrder: ${orderResult.orderNumber}\nUser: ${userLine || '-'}\nUser ID: ${telegramId}\nTotal: Rp 0\nDiskon: Rp ${this.formatPrice(discount)} (${coupon?.code || '-'})\nStatus: Paid otomatis karena kupon`
        );
        await ctx.reply(`✅ Order ${orderResult.orderNumber} berhasil dibuat dengan total Rp 0. Produk akan dikirim otomatis.`);
        if (coupon && discount > 0) await db.markCouponUsed(coupon.code);
        await db.clearUserCoupon(telegramId).catch(() => {});
        await db.clearCart(telegramId);
        await this.deliverDigitalProducts(orderResult.id, telegramId, ctx.telegram);
        return;
      }

      const qris = await this.createAutoQris(total);
      const transactionId = qris.transactionId;
      const uniqueCode = `order-${orderResult.id}-${telegramId}-${Date.now()}`;
      const now = Date.now();
      const expiresAt = now + (cfg.qrisExpiredMinutes * 60 * 1000);

      await db.createPayment(orderResult.id, total, 'gopay_qris_auto', transactionId, qris.qrUrl);
      await db.createQrisPendingOrder({
        unique_code: uniqueCode,
        order_id: orderResult.id,
        order_number: orderResult.orderNumber,
        telegram_id: telegramId,
        amount: total,
        original_amount: originalTotal,
        transaction_id: transactionId,
        qr_url: qris.qrUrl,
        status: 'pending',
        created_at_ms: now,
        expires_at_ms: expiresAt
      });

      if (coupon && discount > 0) await db.markCouponUsed(coupon.code);
      await db.clearUserCoupon(telegramId).catch(() => {});
      await db.clearCart(telegramId);

      await adminNotifyService.sendToAdmins(ctx.telegram,
        `🛒 ORDER BARU\n\nOrder: ${orderResult.orderNumber}\nUser: ${userLine || '-'}\nUser ID: ${telegramId}\nTotal: Rp ${this.formatPrice(total)}${discount > 0 ? `\nDiskon: Rp ${this.formatPrice(discount)} (${coupon.code})` : ''}\nStatus: Menunggu pembayaran QRIS`
      );

      await this.sendAutoQrisPayment(ctx, {
        uniqueCode,
        orderNumber: orderResult.orderNumber,
        total,
        qrUrl: qris.qrUrl,
        expiresAt,
        expiredMinutes: cfg.qrisExpiredMinutes,
        transactionId
      });
    } catch (error) {
      console.error('Payment error:', error);
      ctx.reply(`❌ Gagal membuat pembayaran QRIS: ${error.message}`);
    }
  }

  buildAutoQrisMessage(data) {
    const cfg = this.getPaymentConfig();
    const expired = new Date(data.expiresAt).toLocaleString('id-ID', { timeZone: process.env.BACKUP_TIMEZONE || 'Asia/Jakarta' });

    return `📝 Detail Pembayaran

` +
      `📋 Order: ${data.orderNumber}
` +
      `💰 Total: Rp ${this.formatPrice(data.total)}
` +
      `⏱️ Expired: ${data.expiredMinutes} menit
` +
      `🕒 Batas Waktu: ${expired}

` +
      `📷 QRIS dinamis ditampilkan pada gambar di bawah ini.
` +
      `⚠️ Bayar harus sesuai nominal.
` +
      `${data.purpose === 'pre_order' ? '✅ Setelah pembayaran sukses, request kamu akan diproses admin.' : '✅ Setelah pembayaran sukses, bot akan cek otomatis dan produk digital langsung dikirim.'}

` +
      `${cfg.paymentNote}`;
  }

  async sendAutoQrisPayment(ctx, data) {
    const caption = this.buildAutoQrisMessage(data);
    const keyboard = {
      inline_keyboard: [
        [{ text: '📦 Lihat Pesanan', callback_data: 'show_orders' }],
        [{ text: '❓ Bantuan Pembayaran', callback_data: `payment_help_${data.orderNumber}` }]
      ]
    };

    let sent = null;
    try {
      const photoInput = await this.buildQrPhotoInput(data.qrUrl);
      sent = await ctx.replyWithPhoto(photoInput, {
        caption,
        reply_markup: keyboard
      });
    } catch (photoError) {
      console.error('QRIS photo send error:', photoError.message);
      await ctx.reply(`❌ QRIS dinamis gagal ditampilkan sebagai gambar.

${caption}` , { reply_markup: keyboard });
    }

    if (sent?.message_id) {
      await db.updateQrisMessageId(data.uniqueCode, sent.message_id).catch(() => {});
    }
  }

  async showPaymentHelp(ctx) {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const orderNumber = ctx.match?.[1] || 'NOMOR_ORDER';
      const message = `❓ CARA BAYAR QRIS OTOMATIS\n\n` +
        `1. Scan QRIS dinamis yang tampil sebagai foto.\n` +
        `2. Bayar sesuai total yang muncul.\n` +
        `3. Tunggu beberapa detik, bot akan cek pembayaran otomatis.\n` +
        `4. Jika pembayaran sukses, produk digital langsung dikirim.\n\n` +
        `Nomor pesanan:\n${orderNumber}\n\n` +
        `Jika sudah bayar tapi belum masuk, hubungi admin dan kirim nomor order ini.`;
      return ctx.reply(message);
    } catch (error) {
      console.error('Payment help error:', error);
      return ctx.reply('❌ Gagal menampilkan panduan pembayaran.');
    }
  }

  async createPreOrderPayment(ctx, preOrder) {
    const cfg = this.getPaymentConfig();
    const telegramId = ctx.from.id;
    const amount = Number(preOrder.amount || 0);
    if (amount <= 0) throw new Error('Harga pre order tidak valid.');
    if (cfg.payment !== 'GOPAY' || !cfg.gopayKey) throw new Error('Payment auto QRIS belum aktif. Admin harus mengisi GOPAY_KEY di .env.');

    const orderResult = await db.createOrder(telegramId, amount, `Pre Order ${preOrder.pre_order_number} - diproses admin setelah pembayaran berhasil`);
    const qris = await this.createAutoQris(amount);
    const transactionId = qris.transactionId;
    const uniqueCode = `preorder-${orderResult.id}-${telegramId}-${Date.now()}`;
    const now = Date.now();
    const expiresAt = now + (cfg.qrisExpiredMinutes * 60 * 1000);

    await db.createPayment(orderResult.id, amount, 'gopay_qris_preorder', transactionId, qris.qrUrl);
    await db.attachPreOrderPayment(preOrder.id, { order_id: orderResult.id, order_number: orderResult.orderNumber, transaction_id: transactionId });
    await db.createQrisPendingOrder({
      unique_code: uniqueCode,
      order_id: orderResult.id,
      order_number: orderResult.orderNumber,
      telegram_id: telegramId,
      amount,
      original_amount: amount,
      transaction_id: transactionId,
      qr_url: qris.qrUrl,
      status: 'pending',
      created_at_ms: now,
      expires_at_ms: expiresAt
    });

    await this.sendAutoQrisPayment(ctx, {
      uniqueCode,
      orderNumber: orderResult.orderNumber,
      total: amount,
      qrUrl: qris.qrUrl,
      expiresAt,
      expiredMinutes: cfg.qrisExpiredMinutes,
      transactionId,
      purpose: 'pre_order'
    });
  }


  async deliverDigitalProducts(orderId, telegramId, telegramApi) {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order tidak ditemukan');
    if (order.digital_delivered) return { delivered: false, reason: 'already_delivered' };

    const items = await db.getOrderItems(orderId);
    const digitalItems = items.filter((item) => Number(item.is_digital) === 1);
    if (!digitalItems.length) return { delivered: false, reason: 'no_digital_items' };

    await telegramApi.sendMessage(telegramId, `✅ Pembayaran berhasil. Produk digital untuk pesanan #${order.order_number} akan dikirim sekarang.`);

    for (const item of digitalItems) {
      const title = `📦 ${item.name} x${item.quantity}`;
      const type = item.delivery_type || 'file_text';
      const shouldSendFile = ['file', 'file_text'].includes(type) && item.digital_file_id;
      const shouldSendText = ['text', 'file_text'].includes(type) && item.delivery_text;

      if (shouldSendText) {
        await telegramApi.sendMessage(telegramId, `${title}\n\n${item.delivery_text}`);
        await db.logDelivery(orderId, telegramId, item.product_id, 'text', 'sent', item.name).catch(() => {});
      }
      if (shouldSendFile) {
        await telegramApi.sendDocument(telegramId, item.digital_file_id, {
          caption: shouldSendText ? `File produk: ${item.name}` : title
        });
        await db.logDelivery(orderId, telegramId, item.product_id, 'file', 'sent', item.name).catch(() => {});
      }
      if (!shouldSendText && !shouldSendFile) {
        await telegramApi.sendMessage(telegramId, `⚠️ Produk ${item.name} belum memiliki file/text delivery. Hubungi admin.`);
        await db.logDelivery(orderId, telegramId, item.product_id, 'missing', 'failed', 'missing file/text').catch(() => {});
      }
    }

    await db.markOrderDelivered(orderId);
    const ratingHelp = items.map((item) => `rating ${order.order_number} ${item.product_id} 5 komentar_opsional`).join('\n');
    await telegramApi.sendMessage(telegramId, `⭐ Produk sudah dikirim. Kamu bisa memberi rating dengan format:\n${ratingHelp}`).catch(() => {});
    return { delivered: true };
  }

  async markPaidAndDeliver(ctx, orderNumber) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) {
      return ctx.reply('❌ Anda tidak memiliki akses admin.');
    }
    const order = await db.getOrderByNumber(orderNumber);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');
    if (order.payment_status === 'paid' && order.digital_delivered) {
      return ctx.reply(`ℹ️ Order ${order.order_number} sudah paid dan produk sudah pernah dikirim.`);
    }
    await db.updateOrderPaymentStatus(order.order_number, 'paid');
    await db.logAudit(ctx.from.id, 'manual_paid', order.order_number, 'paid command').catch(() => {});
    const preOrder = await db.getPreOrderByOrderId(order.id).catch(() => null);
    if (preOrder) {
      await db.markPreOrderPaid(order.id, order.payment_id || null);
      const preOrderHandler = require('./preOrderHandler');
      const updatedPreOrder = await db.getPreOrderByOrderId(order.id).catch(() => preOrder);
      await preOrderHandler.notifyAdminPaid(ctx.telegram, updatedPreOrder || preOrder, updatedPreOrder?.transaction_id || null);
      await ctx.telegram.sendMessage(order.telegram_id, `✅ Pembayaran pre order berhasil.\nOrder: ${order.order_number}\nStatus: PROSES`).catch(() => {});
      return ctx.reply(`✅ Pre order ${order.order_number} ditandai PAID dan request dikirim ke admin.`);
    }
    const result = await this.deliverDigitalProducts(order.id, order.telegram_id, ctx.telegram);
    return ctx.reply(`✅ Order ${order.order_number} ditandai PAID. Delivery: ${result.delivered ? 'terkirim' : result.reason}`);
  }

  async rejectPayment(ctx, orderNumber) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) {
      return ctx.reply('❌ Anda tidak memiliki akses admin.');
    }
    const order = await db.getOrderByNumber(orderNumber);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');
    await db.updateOrderPaymentStatus(order.order_number, 'failed');
    await db.logAudit(ctx.from.id, 'reject_payment', order.order_number, 'reject command').catch(() => {});
    await ctx.telegram.sendMessage(order.telegram_id, `❌ Pembayaran untuk pesanan #${order.order_number} ditolak/belum valid. Silakan hubungi admin.`).catch(() => {});
    return ctx.reply(`✅ Order ${order.order_number} ditandai FAILED.`);
  }

  async checkQRISStatus(telegramApi) {
    if (this.isCheckingQRISStatus) return;
    this.isCheckingQRISStatus = true;

    try {
      const cfg = this.getPaymentConfig();
      if (cfg.payment !== 'GOPAY' || !cfg.gopayKey) return;

      const pending = await db.getPendingQrisOrders();
      const now = Date.now();

      for (const item of pending) {
        try {
          if (now > Number(item.expires_at_ms || 0)) {
            await db.markQrisPendingStatus(item.unique_code, 'expired');
            await db.updateOrderPaymentStatus(item.order_number, 'expired').catch(() => {});
            await db.markPreOrderExpired(item.order_id).catch(() => {});
            const expiredText = `⏱️ QRIS EXPIRED

Order: ${item.order_number}
Total: Rp ${this.formatPrice(item.amount)}

Silakan checkout ulang untuk mendapatkan QRIS baru.`;
            if (item.qr_message_id) {
              const action = String(process.env.QRIS_EXPIRED_ACTION || 'edit').toLowerCase();
              if (action === 'delete') await telegramApi.deleteMessage(item.telegram_id, item.qr_message_id).catch(() => {});
              else await telegramApi.editMessageCaption(item.telegram_id, item.qr_message_id, undefined, expiredText).catch(() => {});
            }
            await telegramApi.sendMessage(item.telegram_id, expiredText).catch(() => {});
            continue;
          }

          if (!item.transaction_id) continue;

          const res = await this.paymentHttp.post(
            cfg.qrisStatusUrl,
            { transaction_id: item.transaction_id },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.gopayKey}`
              }
            }
          );

          if (res.status >= 400) continue;
          const data = res.data?.data || {};
          const status = data.transaction_status || data.status;

          if (status !== 'settlement' && status !== 'paid' && status !== 'success') continue;

          await db.updateOrderPaymentStatus(item.order_number, 'paid');
          await db.markQrisPendingStatus(item.unique_code, 'paid');

          const preOrder = await db.getPreOrderByOrderId(item.order_id).catch(() => null);
          if (preOrder) {
            await db.markPreOrderPaid(item.order_id, item.transaction_id);
            await telegramApi.sendMessage(item.telegram_id, `✅ Pembayaran pre order berhasil.\n\nOrder: ${item.order_number}\nTransaction ID: ${item.transaction_id}\nStatus: PROSES\n\nRequest kamu sudah dikirim ke admin dan akan diproses.`).catch(() => {});
            const updatedPreOrder = await db.getPreOrderByOrderId(item.order_id).catch(() => preOrder);
            const preOrderHandler = require('./preOrderHandler');
            await preOrderHandler.notifyAdminPaid(telegramApi, updatedPreOrder || preOrder, item.transaction_id);
          } else {
            await this.deliverDigitalProducts(item.order_id, item.telegram_id, telegramApi);
            await adminNotifyService.sendToAdmins(
              telegramApi,
              `✅ PAYMENT SUKSES\n\nOrder: ${item.order_number}\nUser ID: ${item.telegram_id}\nTotal: Rp ${this.formatPrice(item.amount)}\nTransaction ID: ${item.transaction_id}\nProduk digital sudah dikirim otomatis.`
            );
          }

          if (item.qr_message_id) {
            await telegramApi.deleteMessage(item.telegram_id, item.qr_message_id).catch(() => {});
          }
        } catch (err) {
          console.error(`[QRIS] Gagal cek ${item.order_number}:`, err.message);
        }
      }
    } finally {
      this.isCheckingQRISStatus = false;
    }
  }

  startAutoQrisPolling(bot) {
    if (this.pollingStarted) return;
    this.pollingStarted = true;
    const cfg = this.getPaymentConfig();
    const interval = Math.max(3000, cfg.qrisCheckIntervalMs);

    setInterval(() => {
      this.checkQRISStatus(bot.telegram).catch((err) => console.error('[QRIS] Polling error:', err.message));
    }, interval);

    setTimeout(() => {
      this.checkQRISStatus(bot.telegram).catch((err) => console.error('[QRIS] Initial check error:', err.message));
    }, 5000);
  }

  async handlePaymentNotification() {
    return { success: true, message: 'Webhook tidak dipakai. Bot mengecek status QRIS otomatis melalui polling GOPAY.' };
  }
}

module.exports = new PaymentHandler();
