require('dotenv').config();
const db = require('../config/database');
const paymentHandler = require('./paymentHandler');
const adminNotifyService = require('../services/adminNotifyService');

class PreOrderHandler {
  constructor() {
    this.pendingUsers = new Set();
    this.pendingAdminDelivery = new Map();
  }

  formatPrice(value) { return Number(value || 0).toLocaleString('id-ID'); }
  statusLabel(status) {
    return {
      submitted: '📌 Request masuk, menunggu admin set harga',
      quoted: '💰 Penawaran dikirim, menunggu user setuju bayar',
      waiting_payment: '⏳ Menunggu pembayaran QRIS',
      process: '🔧 Sedang diproses admin',
      delivered: '📤 Hasil sudah dikirim',
      revision_requested: '🔁 User meminta revisi',
      revision_process: '🔧 Revisi sedang diproses',
      completed: '✅ Selesai',
      cancelled: '❌ Dibatalkan',
      expired: '⏱️ Expired'
    }[status] || status || '-';
  }

  termsText() {
    return `📜 S&K PRE ORDER\n\n` +
      `1. Pre Order adalah produk/request custom sesuai permintaan user.\n` +
      `2. User mengirim request dulu, lalu admin membaca dan menentukan harga.\n` +
      `3. Pembayaran baru dilakukan setelah user menerima penawaran dari admin.\n` +
      `4. Produk diproses setelah pembayaran berhasil.\n` +
      `5. Estimasi pengerjaan mengikuti jadwal yang ditentukan admin.\n` +
      `6. Revisi mengikuti batas yang ditentukan admin. Default: ${process.env.PREORDER_MAX_REVISION || 1}x.\n` +
      `7. Request yang tidak jelas bisa ditolak atau diminta diperjelas.\n\n` +
      `Klik tombol di bawah jika kamu paham dan ingin lanjut request.`;
  }

  requestTemplate() {
    return `📝 TEMPLATE REQUEST PRE ORDER\n\n` +
      `Silakan kirim request dalam format berikut, atau kirim foto/video/file dengan caption yang jelas:\n\n` +
      `Nama produk yang diminta:\n` +
      `Detail request:\n` +
      `Format hasil yang diinginkan:\n` +
      `Catatan tambahan:\n` +
      `Deadline jika ada:\n\n` +
      `Minimal request text/caption ${process.env.PREORDER_MIN_TEXT_LENGTH || 20} karakter agar admin tidak salah paham.`;
  }

  async start(ctx) {
    await db.addUser(ctx.from.id, ctx.from).catch(() => {});
    const keyboard = { inline_keyboard: [[{ text: '✅ Saya Paham, Lanjut Request', callback_data: 'preorder_accept_terms' }], [{ text: '📋 Pre Order Saya', callback_data: 'preorder_mine' }], [{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]] };
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
      return ctx.editMessageText(this.termsText(), { reply_markup: keyboard }).catch(() => ctx.reply(this.termsText(), { reply_markup: keyboard }));
    }
    return ctx.reply(this.termsText(), { reply_markup: keyboard });
  }

  async acceptTerms(ctx) {
    this.pendingUsers.add(ctx.from.id);
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(this.requestTemplate(), { reply_markup: { inline_keyboard: [[{ text: '❌ Batal Pre Order', callback_data: 'preorder_cancel' }]] } });
  }

  async cancel(ctx) {
    this.pendingUsers.delete(ctx.from.id);
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply('✅ Pre order dibatalkan.');
  }

  validateRequestPayload(payload) {
    if (!payload) return 'Format request belum didukung. Kirim text, foto, video, atau file/dokumen.';
    const min = Number(process.env.PREORDER_MIN_TEXT_LENGTH || 20);
    const text = payload.request_text || payload.request_caption || '';
    if (!text || text.trim().length < min) return `Request/caption terlalu pendek. Minimal ${min} karakter agar admin paham produk yang kamu minta.`;
    return null;
  }

  buildRequestFromMessage(ctx) {
    const msg = ctx.message || {};
    if (msg.text && !msg.text.startsWith('/')) return { request_type: 'text', request_text: msg.text };
    if (msg.photo?.length) return { request_type: 'photo', request_file_id: msg.photo[msg.photo.length - 1].file_id, request_caption: msg.caption || null };
    if (msg.video) return { request_type: 'video', request_file_id: msg.video.file_id, request_file_name: msg.video.file_name || null, request_caption: msg.caption || null };
    if (msg.document) return { request_type: 'document', request_file_id: msg.document.file_id, request_file_name: msg.document.file_name || null, request_caption: msg.caption || null };
    return null;
  }

  async handleUserRequest(ctx) {
    if (!this.pendingUsers.has(ctx.from.id)) return false;
    const payload = this.buildRequestFromMessage(ctx);
    const validation = this.validateRequestPayload(payload);
    if (validation) { await ctx.reply(`❌ ${validation}\n\n${this.requestTemplate()}`); return true; }

    try {
      this.pendingUsers.delete(ctx.from.id);
      const created = await db.createPreOrder({ telegram_id: ctx.from.id, amount: 0, ...payload });
      const preOrder = await db.getPreOrderById(created.id);
      await db.logPreOrder(preOrder.id, 'user', ctx.from.id, 'submitted', 'request submitted').catch(() => {});
      await ctx.reply(`✅ Request pre order diterima.\n\nID Pre Order: ${created.preOrderNumber}\nStatus: ${this.statusLabel('submitted')}\n\nRequest kamu sudah dikirim ke admin. Admin akan membaca request, lalu mengirim harga dan estimasi pengerjaan. Setelah kamu setuju, tombol pembayaran akan muncul.`);
      await this.notifyAdminsSubmitted(ctx.telegram, preOrder);
      return true;
    } catch (error) {
      console.error('Pre order request error:', error);
      await db.logError('preorder_request', error).catch(() => {});
      await ctx.reply(`❌ Gagal membuat pre order: ${error.message}`);
      return true;
    }
  }

  async notifyAdminsSubmitted(telegramApi, preOrder) {
    const message = `📌 REQUEST PRE ORDER BARU\n\n` +
      `ID: ${preOrder.pre_order_number}\n` +
      `User ID: ${preOrder.telegram_id}\n` +
      `Tipe: ${preOrder.request_type}\n` +
      `Status: ${this.statusLabel(preOrder.status)}\n\n` +
      `Set harga dengan format:\n` +
      `setpo ${preOrder.pre_order_number} 75000 2026-05-25 2026-05-27 2 hari | Catatan admin\n\n` +
      `Opsional biaya tambahan:\n` +
      `setpo ${preOrder.pre_order_number} 50000+25000 2026-05-25 2026-05-27 2 hari | Catatan admin`;
    await adminNotifyService.sendToAdmins(telegramApi, message);
    await this.forwardRequestToAdmins(telegramApi, preOrder);
  }

  async forwardRequestToAdmins(telegramApi, preOrder) {
    const ids = adminNotifyService.getAdminIds();
    const caption = `📌 REQUEST PRE ORDER\nID: ${preOrder.pre_order_number}\nUser ID: ${preOrder.telegram_id}\nTipe: ${preOrder.request_type}` + (preOrder.request_caption ? `\n\nCaption:\n${preOrder.request_caption}` : '');
    for (const id of ids) {
      try {
        if (preOrder.request_type === 'photo') await telegramApi.sendPhoto(id, preOrder.request_file_id, { caption });
        else if (preOrder.request_type === 'video') await telegramApi.sendVideo(id, preOrder.request_file_id, { caption });
        else if (preOrder.request_type === 'document') await telegramApi.sendDocument(id, preOrder.request_file_id, { caption });
        else await telegramApi.sendMessage(id, `${caption}\n\nRequest:\n${preOrder.request_text || '-'}`);
      } catch (err) { console.error('Forward preorder request error:', err.message); }
    }
  }

  parseQuoteText(text) {
    const raw = text.replace(/^setpo\s+/i, '').trim();
    const [left, noteRaw = ''] = raw.split('|');
    const parts = left.trim().split(/\s+/);
    if (parts.length < 5) return null;
    const [reference, priceRaw, start, end, ...estimateParts] = parts;
    let base = 0, fee = 0, amount = 0;
    if (priceRaw.includes('+')) { const nums = priceRaw.split('+').map((n) => Number(String(n).replace(/\D/g, ''))); base = nums[0] || 0; fee = nums[1] || 0; amount = base + fee; }
    else { amount = Number(String(priceRaw).replace(/\D/g, '')); base = amount; }
    return { reference, amount, base_amount: base, additional_fee: fee, work_start_date: start, work_end_date: end, work_estimate: estimateParts.join(' '), admin_note: noteRaw.trim() };
  }

  buildQuoteMessage(po) {
    return `🧾 INVOICE / PENAWARAN PRE ORDER\n\n` +
      `ID Pre Order: ${po.pre_order_number}\n` +
      `Harga Dasar: Rp ${this.formatPrice(po.base_amount || po.amount)}\n` +
      `Biaya Tambahan: Rp ${this.formatPrice(po.additional_fee || 0)}\n` +
      `Total Bayar: Rp ${this.formatPrice(po.amount)}\n` +
      `Tanggal Pengerjaan: ${po.work_start_date || '-'} s/d ${po.work_end_date || '-'}\n` +
      `Estimasi: ${po.work_estimate || '-'}\n` +
      `Expired Penawaran: ${po.quote_expires_at || '-'}\n` +
      `Catatan Admin: ${po.admin_note || '-'}\n\n` +
      `Jika setuju, klik tombol pembayaran. Harga tidak bisa diubah oleh user.`;
  }

  async setQuote(ctx, text) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const data = this.parseQuoteText(text);
    if (!data || !data.amount || data.amount <= 0) return ctx.reply('❌ Format salah. Contoh:\nsetpo PO-xxx 75000 2026-05-25 2026-05-27 2 hari | Catatan admin');
    const poBefore = await db.getPreOrderByReference(data.reference);
    if (!poBefore) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (!['submitted','quoted'].includes(poBefore.status)) return ctx.reply(`❌ Harga hanya bisa diset sebelum user bayar. Status sekarang: ${poBefore.status}`);
    await db.quotePreOrder(data.reference, data);
    const po = await db.getPreOrderByReference(data.reference);
    await db.logPreOrder(po.id, 'admin', ctx.from.id, 'quoted', JSON.stringify(data)).catch(() => {});
    await db.logAudit(ctx.from.id, 'preorder_quote', po.pre_order_number, `amount ${po.amount}`).catch(() => {});
    const keyboard = { inline_keyboard: [[{ text: '💳 Setuju & Bayar', callback_data: `preorder_pay_${po.id}` }], [{ text: '❌ Batalkan Pre Order', callback_data: `preorder_user_cancel_${po.id}` }]] };
    await ctx.telegram.sendMessage(po.telegram_id, this.buildQuoteMessage(po), { reply_markup: keyboard }).catch(() => {});
    return ctx.reply(`✅ Penawaran dikirim ke user.\n\n${this.buildQuoteMessage(po)}`);
  }

  async editQuote(ctx, text) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const parts = text.replace(/^editpo\s+/i, '').trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply('Format: editpo PO-xxx harga 85000');
    const [reference, field, ...rest] = parts;
    const po = await db.getPreOrderByReference(reference);
    if (!po) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (!['submitted','quoted'].includes(po.status)) return ctx.reply('❌ Quote tidak bisa diedit setelah user bayar/proses.');
    const result = await db.editPreOrderQuote(reference, field.toLowerCase(), rest.join(' '));
    if (!result.changes) return ctx.reply('❌ Field tidak valid atau tidak ada perubahan. Field: harga, base, tambahan, mulai, selesai, estimasi, catatan');
    const updated = await db.getPreOrderByReference(reference);
    await db.logPreOrder(updated.id, 'admin', ctx.from.id, 'quote_edited', `${field}=${rest.join(' ')}`).catch(() => {});
    await ctx.telegram.sendMessage(updated.telegram_id, `✏️ Penawaran pre order diperbarui admin.\n\n${this.buildQuoteMessage(updated)}`, { reply_markup: { inline_keyboard: [[{ text: '💳 Setuju & Bayar', callback_data: `preorder_pay_${updated.id}` }], [{ text: '❌ Batalkan Pre Order', callback_data: `preorder_user_cancel_${updated.id}` }]] } }).catch(() => {});
    return ctx.reply('✅ Quote berhasil diedit dan dikirim ulang ke user.');
  }

  async userPay(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const poId = Number(ctx.match[1]);
    const po = await db.getPreOrderById(poId);
    if (!po || po.telegram_id !== ctx.from.id) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (po.status !== 'quoted') return ctx.reply(`❌ Pre order tidak bisa dibayar. Status: ${po.status}`);
    if (po.quote_expires_at && new Date(po.quote_expires_at).getTime() < Date.now()) { await db.expirePreOrderQuote(po.id); return ctx.reply('⏱️ Penawaran pre order sudah expired. Silakan request ulang.'); }
    await ctx.reply('✅ Kamu menyetujui penawaran. Bot sedang membuat QRIS pembayaran...');
    return paymentHandler.createPreOrderPayment(ctx, po);
  }

  async userCancel(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    const po = await db.getPreOrderById(Number(ctx.match[1]));
    if (!po || po.telegram_id !== ctx.from.id) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (!['submitted','quoted','waiting_payment'].includes(po.status)) return ctx.reply('❌ Pre order ini tidak bisa dibatalkan dari user.');
    await db.cancelPreOrder(po.pre_order_number, 'Dibatalkan oleh user', ['submitted','quoted','waiting_payment']);
    await db.logPreOrder(po.id, 'user', ctx.from.id, 'cancelled', 'cancelled by user').catch(() => {});
    await adminNotifyService.sendToAdmins(ctx.telegram, `❌ PRE ORDER DIBATALKAN USER\n\nID: ${po.pre_order_number}\nUser ID: ${po.telegram_id}`).catch(() => {});
    return ctx.reply('✅ Pre order berhasil dibatalkan.');
  }

  async notifyAdminPaid(telegramApi, preOrder, transactionId) {
    const user = await db.getUser(preOrder.telegram_id).catch(() => null);
    const userLine = user?.username ? `@${user.username}` : `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || '-';
    const message = `🧾 PRE ORDER DIBAYAR\n\n` +
      `ID Pre Order: ${preOrder.pre_order_number}\nOrder: ${preOrder.order_number}\nTransaction ID: ${transactionId || preOrder.transaction_id || '-'}\nUser: ${userLine}\nTelegram ID: ${preOrder.telegram_id}\nTotal: Rp ${this.formatPrice(preOrder.amount)}\nStatus: PROSES\n\nUntuk kirim hasil: sendpo ${preOrder.order_number}`;
    await adminNotifyService.sendToAdmins(telegramApi, message);
    await this.forwardRequestToAdmins(telegramApi, preOrder);
  }

  async listMine(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const rows = await db.getPreOrdersByUser(ctx.from.id, 10);
    if (!rows.length) return ctx.reply('Belum ada pre order.');
    const text = rows.map((r) => `• ${r.pre_order_number}\n  Status: ${this.statusLabel(r.status)}\n  Harga: Rp ${this.formatPrice(r.amount)}\n  Estimasi: ${r.work_estimate || '-'}\n  Order: ${r.order_number || '-'}`).join('\n\n');
    return ctx.reply(`📋 PRE ORDER SAYA\n\n${text}\n\nCommand revisi setelah produk dikirim:\nrevision ID alasan\n\nTandai selesai:\ncompletepo ID`);
  }

  async listAdmin(ctx, status = null) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const rows = await db.getPreOrders(status, 10);
    const keyboard = { inline_keyboard: [[{ text: '📌 Request Baru', callback_data: 'admin_preorders_submitted' }, { text: '💰 Quoted', callback_data: 'admin_preorders_quoted' }], [{ text: '⏳ Payment', callback_data: 'admin_preorders_waiting_payment' }, { text: '🔧 Proses', callback_data: 'admin_preorders_process' }], [{ text: '🔁 Revisi', callback_data: 'admin_preorders_revision_requested' }, { text: '✅ Dikirim', callback_data: 'admin_preorders_delivered' }], [{ text: '⬅️ Admin', callback_data: 'admin_menu' }]] };
    if (!rows.length) return ctx.reply(`Belum ada pre order${status ? ` status ${status}` : ''}.`, { reply_markup: keyboard });
    const text = rows.map((r) => `• ${r.pre_order_number}\n  User: ${r.telegram_id}\n  Status: ${this.statusLabel(r.status)}\n  Harga: Rp ${this.formatPrice(r.amount)}\n  Estimasi: ${r.work_estimate || '-'}\n  Command: cekpo ${r.pre_order_number}`).join('\n\n');
    return ctx.reply(`📝 DAFTAR PRE ORDER${status ? ` - ${status}` : ''}\n\n${text}`, { reply_markup: keyboard });
  }

  async check(ctx, reference) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const po = await db.getPreOrderByReference(reference);
    if (!po) return ctx.reply('❌ Pre order tidak ditemukan.');
    const logs = await db.getPreOrderLogs(po.id, 8).catch(() => []);
    const logText = logs.map((l) => `- ${l.created_at}: ${l.action} (${l.actor_type})`).join('\n') || '-';
    return ctx.reply(`🧾 DETAIL PRE ORDER\n\nID: ${po.pre_order_number}\nOrder: ${po.order_number || '-'}\nTransaction ID: ${po.transaction_id || '-'}\nUser ID: ${po.telegram_id}\nTipe Request: ${po.request_type}\nHarga: Rp ${this.formatPrice(po.amount)}\nTanggal: ${po.work_start_date || '-'} s/d ${po.work_end_date || '-'}\nEstimasi: ${po.work_estimate || '-'}\nCatatan: ${po.admin_note || '-'}\nStatus: ${this.statusLabel(po.status)}\nRevisi: ${po.revision_count || 0}/${po.max_revision || 1}\nDibuat: ${po.created_at}\nPaid: ${po.paid_at || '-'}\nDelivered: ${po.delivered_at || '-'}\n\nLog:\n${logText}`);
  }

  async beginSendResult(ctx, reference) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const po = await db.getPreOrderByReference(reference);
    if (!po) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (!['process','paid','revision_requested','revision_process','delivered'].includes(po.status)) return ctx.reply(`❌ Pre order belum siap dikirim. Status saat ini: ${po.status}`);
    if (po.status === 'revision_requested') await db.markPreOrderRevisionProcess(reference).catch(() => {});
    this.pendingAdminDelivery.set(ctx.from.id, { reference, preOrder: po });
    return ctx.reply(`✅ Mode kirim hasil pre order aktif.\n\nTarget: ${po.pre_order_number}\nOrder: ${po.order_number}\nUser ID: ${po.telegram_id}\n\nSekarang kirim hasil produk berupa text, foto, video, atau file/dokumen.`);
  }

  async handleAdminDelivery(ctx) {
    const pending = this.pendingAdminDelivery.get(ctx.from.id);
    if (!pending || !adminNotifyService.isAdmin(ctx.from.id)) return false;
    const po = pending.preOrder;
    const msg = ctx.message || {};
    try {
      const prefix = `✅ Hasil Pre Order\nOrder: ${po.order_number || po.pre_order_number}\n\n`;
      if (msg.text && !msg.text.startsWith('/')) await ctx.telegram.sendMessage(po.telegram_id, `${prefix}${msg.text}`);
      else if (msg.photo?.length) await ctx.telegram.sendPhoto(po.telegram_id, msg.photo[msg.photo.length - 1].file_id, { caption: msg.caption || prefix.trim() });
      else if (msg.video) await ctx.telegram.sendVideo(po.telegram_id, msg.video.file_id, { caption: msg.caption || prefix.trim() });
      else if (msg.document) await ctx.telegram.sendDocument(po.telegram_id, msg.document.file_id, { caption: msg.caption || prefix.trim() });
      else { await ctx.reply('❌ Format hasil belum didukung.'); return true; }
      await db.markPreOrderDelivered(pending.reference, `delivered_by:${ctx.from.id}`);
      const updated = await db.getPreOrderByReference(pending.reference).catch(() => po);
      await db.logPreOrder((updated || po).id, 'admin', ctx.from.id, 'delivered', 'result sent').catch(() => {});
      this.pendingAdminDelivery.delete(ctx.from.id);
      await ctx.telegram.sendMessage(po.telegram_id, `📌 Jika hasil sudah sesuai, ketik:\ncompletepo ${po.pre_order_number}\n\nJika butuh revisi, ketik:\nrevision ${po.pre_order_number} alasan revisi`).catch(() => {});
      await ctx.reply(`✅ Hasil pre order berhasil dikirim ke user.\nID: ${po.pre_order_number}`);
      return true;
    } catch (error) { console.error('Pre order delivery error:', error); await ctx.reply(`❌ Gagal kirim hasil: ${error.message}`); return true; }
  }

  async requestRevision(ctx, text) {
    const [, ref, note = ''] = text.match(/^revision\s+(\S+)\s*([\s\S]*)/i) || [];
    if (!ref) return ctx.reply('Format: revision PO-xxx alasan revisi');
    const po = await db.getPreOrderByReference(ref);
    if (!po || po.telegram_id !== ctx.from.id) return ctx.reply('❌ Pre order tidak ditemukan.');
    const result = await db.requestPreOrderRevision(ref, ctx.from.id, note || 'User meminta revisi');
    if (!result.changes) return ctx.reply('❌ Revisi tidak bisa diajukan. Pastikan status delivered dan batas revisi belum habis.');
    await db.logPreOrder(po.id, 'user', ctx.from.id, 'revision_requested', note).catch(() => {});
    await adminNotifyService.sendToAdmins(ctx.telegram, `🔁 REVISI PRE ORDER\n\nID: ${po.pre_order_number}\nUser ID: ${ctx.from.id}\nAlasan:\n${note || '-' }\n\nKirim revisi dengan: sendpo ${po.pre_order_number}`);
    return ctx.reply('✅ Permintaan revisi dikirim ke admin.');
  }

  async complete(ctx, text) {
    const ref = text.replace(/^completepo\s+/i, '').trim();
    const po = await db.getPreOrderByReference(ref);
    if (!po || po.telegram_id !== ctx.from.id) return ctx.reply('❌ Pre order tidak ditemukan.');
    const result = await db.completePreOrder(ref);
    if (!result.changes) return ctx.reply('❌ Pre order belum bisa ditandai selesai.');
    await db.logPreOrder(po.id, 'user', ctx.from.id, 'completed', 'accepted by user').catch(() => {});
    await adminNotifyService.sendToAdmins(ctx.telegram, `✅ PRE ORDER SELESAI\n\nID: ${po.pre_order_number}\nUser ID: ${ctx.from.id}`).catch(() => {});
    return ctx.reply('✅ Pre order ditandai selesai. Terima kasih.');
  }

  async cancelByAdmin(ctx, text) {
    if (!adminNotifyService.isAdmin(ctx.from.id)) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const raw = text.replace(/^cancelpo\s+/i, '').trim();
    const [ref, ...reasonParts] = raw.split(/\s+/);
    const reason = reasonParts.join(' ');
    if (!ref || !reason) return ctx.reply('❌ Format wajib pakai alasan: cancelpo PO-xxx alasan pembatalan');
    const po = await db.getPreOrderByReference(ref);
    if (!po) return ctx.reply('❌ Pre order tidak ditemukan.');
    await db.cancelPreOrder(ref, reason);
    await db.logPreOrder(po.id, 'admin', ctx.from.id, 'cancelled', reason).catch(() => {});
    await ctx.telegram.sendMessage(po.telegram_id, `❌ Pre order dibatalkan admin.\n\nID: ${po.pre_order_number}\nAlasan: ${reason}`).catch(() => {});
    return ctx.reply('✅ Pre order dibatalkan dan user sudah diberi tahu.');
  }

  async invoice(ctx, reference) {
    const po = await db.getPreOrderByReference(reference);
    if (!po) return ctx.reply('❌ Pre order tidak ditemukan.');
    if (!adminNotifyService.isAdmin(ctx.from.id) && po.telegram_id !== ctx.from.id) return ctx.reply('❌ Tidak punya akses.');
    return ctx.reply(this.buildQuoteMessage(po));
  }

  startQuoteExpiryWatcher(bot) {
    const intervalMs = Math.max(60000, Number(process.env.PREORDER_QUOTE_EXPIRE_CHECK_MS || 300000));
    setInterval(async () => {
      try {
        const rows = await db.getExpiredPreOrderQuotes();
        for (const po of rows) {
          await db.expirePreOrderQuote(po.id);
          await db.logPreOrder(po.id, 'system', 'bot', 'quote_expired', 'quote expired').catch(() => {});
          await bot.telegram.sendMessage(po.telegram_id, `⏱️ Penawaran pre order expired.\n\nID: ${po.pre_order_number}\nSilakan request ulang jika masih berminat.`).catch(() => {});
        }
      } catch (e) { console.error('Pre order quote watcher error:', e.message); }
    }, intervalMs);
  }
}

module.exports = new PreOrderHandler();
