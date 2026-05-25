const db = require('../config/database');
const backupService = require('../services/backupService');
const adminContactService = require('../services/adminContactService');
const adminNotifyService = require('../services/adminNotifyService');
const cleanupService = require('../services/cleanupService');

class AdminHandler {
  constructor() {
    this.pendingProductTypes = new Map();
    this.pendingRestoreAdmins = new Set();
    this.pendingRestoreConfirm = new Set();
    this.pendingBroadcastAdmins = new Set();
    this.broadcastDrafts = new Map();
  }

  formatPrice(value) { return Number(value || 0).toLocaleString('id-ID'); }
  async checkAdmin(telegramId) { return adminNotifyService.isAdmin(telegramId); }

  parseProductText(text = '') {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const data = {};
    for (const line of lines) {
      const separator = line.indexOf(':');
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (['nama','name','produk','product'].includes(key)) data.name = value;
      if (['harga','price'].includes(key)) data.price = Number(value.replace(/[^0-9]/g, ''));
      if (['stok','stock'].includes(key)) data.stock = Number(value.replace(/[^0-9]/g, ''));
      if (['kategori','category'].includes(key)) data.category = value;
      if (['deskripsi','description','desc'].includes(key)) data.description = value;
      if (['snk','s&k','syarat','syarat_ketentuan','terms','terms_conditions'].includes(key)) data.terms_conditions = value;
      if (['text','teks','delivery_text','isi'].includes(key)) data.delivery_text = value;
      if (['tipe','type','delivery'].includes(key)) data.delivery_type = this.normalizeDeliveryType(value);
    }
    if (!data.delivery_type) data.delivery_type = data.delivery_text ? 'text' : 'file_text';
    if (!data.stock) data.stock = 999;
    if (!data.category) data.category = 'Digital';
    return data;
  }

  normalizeDeliveryType(value = '') {
    const v = String(value).toLowerCase().replace(/\s+/g, '_');
    if (['file','document','dokumen'].includes(v)) return 'file';
    if (['text','teks','txt'].includes(v)) return 'text';
    return 'file_text';
  }

  statusLabel(order) {
    if (order.payment_status === 'paid' && order.digital_delivered) return '📦 Produk Terkirim';
    if (order.payment_status === 'paid') return '✅ Dibayar';
    if (order.payment_status === 'expired') return '⏱️ Expired';
    if (order.payment_status === 'failed') return '❌ Gagal';
    if (order.status === 'cancelled') return '🚫 Dibatalkan';
    return '⏳ Menunggu Pembayaran';
  }

  async adminMenu(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      await this.replyOrEdit(ctx, '👨‍💼 PANEL ADMIN DIGITAL STORE\n\nPilih menu untuk mengelola produk digital, pesanan, backup, laporan, kupon, setting, dan maintenance.', {
        inline_keyboard: [
          [{ text: '📊 Dashboard Ringkas', callback_data: 'admin_dashboard' }],
          [{ text: '📦 Daftar / Edit Produk', callback_data: 'admin_products' }],
          [{ text: '➕ Tambah Produk Digital', callback_data: 'admin_add_product' }],
          [{ text: '📋 Kelola Pesanan', callback_data: 'admin_orders' }],
          [{ text: '📝 Pre Order Masuk', callback_data: 'admin_preorders' }],
          [{ text: '📊 Laporan Penjualan', callback_data: 'admin_analytics' }],
          [{ text: '🎟️ Kupon / Diskon', callback_data: 'admin_coupons' }],
          [{ text: '📥 Export Laporan', callback_data: 'admin_export' }],
          [{ text: '📣 Broadcast User', callback_data: 'admin_broadcast' }],
          [{ text: '⚙️ Pengaturan Bot', callback_data: 'admin_settings' }],
          [{ text: '🛠️ Maintenance Mode', callback_data: 'admin_maintenance' }],
          [{ text: '💾 Backup & Restore', callback_data: 'admin_backup' }],
          [{ text: '☎️ Auto Setting Hubungi Admin', callback_data: 'admin_sync_contact' }],
          [{ text: '⚠️ Log Error Terbaru', callback_data: 'admin_errors' }],
          [{ text: '🧾 Audit Log Admin', callback_data: 'admin_audit' }],
          [{ text: '🧹 Auto-Cleanup Data Lama', callback_data: 'admin_cleanup' }],
          [{ text: '⬅️ Kembali', callback_data: 'back_home' }]
        ]
      });
    } catch (error) { console.error('Admin menu error:', error); ctx.reply('❌ Gagal membuka menu admin.'); }
  }

  async manageProducts(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const products = await db.getAllProducts(true);
      let message = '📦 DAFTAR PRODUK ADMIN\n\n';
      message += 'Klik produk untuk melihat opsi edit/hapus.\n\n';
      const keyboard = [];
      products.forEach((p) => {
        message += `#${p.id} ${p.active ? '✅' : '❌'} ${p.name}\nRp${this.formatPrice(p.price)} | Stok: ${p.stock} | ${p.delivery_type || '-'}\n`;
        keyboard.push([{ text: `${p.active ? '✅' : '❌'} #${p.id} ${p.name}`.slice(0, 60), callback_data: `admin_product_${p.id}` }]);
      });
      if (!products.length) message += 'Belum ada produk.\n';
      keyboard.push([{ text: '➕ Tambah Produk Digital', callback_data: 'admin_add_product' }]);
      keyboard.push([{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]);
      await this.replyOrEdit(ctx, message, { inline_keyboard: keyboard });
    } catch (error) { console.error('Manage products error:', error); ctx.reply('❌ Gagal memuat data produk.'); }
  }

  async showAdminProduct(ctx) {
    try {
      await ctx.answerCbQuery().catch(() => {});
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const id = Number(ctx.match[1]);
      const p = await db.getProduct(id);
      if (!p) return ctx.reply('❌ Produk tidak ditemukan.');
      const msg = `📦 DETAIL PRODUK ADMIN\n\nID: ${p.id}\nStatus: ${p.active ? 'Aktif' : 'Nonaktif'}\nNama: ${p.name}\nHarga: Rp${this.formatPrice(p.price)}\nStok: ${p.stock}\nKategori: ${p.category || '-'}\nTipe: ${p.delivery_type || '-'}\nFile: ${p.digital_file_id ? (p.digital_file_name || 'Ada') : 'Tidak ada'}\nText: ${p.delivery_text ? 'Ada' : 'Tidak ada'}\n\nDeskripsi:\n${p.description || '-'}\n\nS&K:\n${p.terms_conditions || '-'}\n\nEdit cepat lewat chat:\neditprod ${p.id} harga 50000\neditprod ${p.id} stok 999\neditprod ${p.id} nama Nama Baru\neditprod ${p.id} deskripsi Isi deskripsi baru\neditprod ${p.id} snk Isi S&K baru\nhapusprod ${p.id}`;
      await ctx.reply(msg, { reply_markup: { inline_keyboard: [
        [{ text: p.active ? '❌ Nonaktifkan' : '✅ Aktifkan', callback_data: `admin_toggle_product_${p.id}` }],
        [{ text: '🗑️ Hapus / Nonaktifkan', callback_data: `admin_delete_product_${p.id}` }],
        [{ text: '⬅️ Daftar Produk', callback_data: 'admin_products' }]
      ] } });
    } catch (error) { console.error('Admin product detail error:', error); ctx.reply('❌ Gagal membuka detail produk.'); }
  }

  async toggleProduct(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const id = Number(ctx.match[1]); const p = await db.getProduct(id);
    if (!p) return ctx.reply('❌ Produk tidak ditemukan.');
    await db.setProductActive(id, !p.active);
    return ctx.reply(`✅ Produk #${id} sekarang ${!p.active ? 'aktif' : 'nonaktif'}.`);
  }

  async deleteProduct(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const id = Number(ctx.match[1]);
    await db.softDeleteProduct(id);
    return ctx.reply(`✅ Produk #${id} dinonaktifkan. Data transaksi lama tetap aman.`);
  }

  async promptAddProduct(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const message = `➕ TAMBAH PRODUK DIGITAL\n\nPilih dulu jenis produk yang mau ditambahkan supaya tidak salah format.\n\n📄 Text saja\n📁 File saja\n📁➕📄 File + Text`;
    await this.replyOrEdit(ctx, message, { inline_keyboard: [
      [{ text: '📄 Text Saja', callback_data: 'admin_add_type_text' }],
      [{ text: '📁 File Saja', callback_data: 'admin_add_type_file' }],
      [{ text: '📁➕📄 File + Text', callback_data: 'admin_add_type_file_text' }],
      [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
    ]});
  }

  async chooseProductType(ctx, deliveryType) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    this.pendingProductTypes.set(ctx.from.id, deliveryType);
    const typeLabels = { text: '📄 TEXT SAJA', file: '📁 FILE SAJA', file_text: '📁➕📄 FILE + TEXT' };
    let message = `✅ Jenis produk dipilih: ${typeLabels[deliveryType]}\n\n`;
    if (deliveryType === 'text') {
      message += `Kirim pesan biasa:\n\nNama: Produk Text Premium\nHarga: 25000\nStok: 999\nKategori: Digital\nDeskripsi: Jelaskan produk\nS&K: Ketentuan produk\nText: Isi produk yang dikirim otomatis`;
    } else if (deliveryType === 'file') {
      message += `Upload file sebagai dokumen dengan caption:\n\nNama: File Script Bot\nHarga: 75000\nStok: 999\nKategori: Script\nDeskripsi: Jelaskan isi file\nS&K: Ketentuan produk`;
    } else {
      message += `Upload file sebagai dokumen dengan caption:\n\nNama: Paket Premium Bot\nHarga: 100000\nStok: 999\nKategori: Script\nDeskripsi: Jelaskan isi produk\nS&K: Ketentuan produk\nText: Catatan/panduan tambahan yang dikirim ke pembeli`;
    }
    await this.replyOrEdit(ctx, message, { inline_keyboard: [[{ text: '🔄 Ganti Jenis Produk', callback_data: 'admin_add_product' }], [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]] });
  }

  async handleProductUpload(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return;
      if (this.pendingRestoreAdmins.has(ctx.from.id)) return this.handleRestoreUpload(ctx);
      if (this.pendingBroadcastAdmins.has(ctx.from.id)) return this.handleBroadcastDocument(ctx);
      if (this.pendingRestoreConfirm.has(ctx.from.id)) return ctx.reply('⚠️ Kamu sedang di mode konfirmasi restore. Ketik RESTORE SAYA SETUJU dulu, atau /admin untuk batal.');
      const document = ctx.message.document; const data = this.parseProductText(ctx.message.caption || '');
      const selectedType = this.pendingProductTypes.get(ctx.from.id); if (selectedType) data.delivery_type = selectedType;
      if (!data.name || !data.price) return ctx.reply('❌ Caption belum lengkap. Minimal wajib ada:\nNama: ...\nHarga: ...');
      data.digital_file_id = document.file_id; data.digital_file_name = document.file_name || 'produk-digital'; data.is_digital = true;
      if (data.delivery_type === 'text' && !data.delivery_text) return ctx.reply('❌ Produk Text Saja wajib memiliki Text:.');
      if (data.delivery_type === 'file') data.delivery_text = null;
      const result = await db.createProduct(data); this.pendingProductTypes.delete(ctx.from.id);
      await ctx.reply(`✅ Produk digital berhasil ditambahkan!\n\nID: ${result.id}\nNama: ${data.name}\nHarga: Rp${this.formatPrice(data.price)}\nTipe Kirim: ${data.delivery_type}\nFile: ${data.digital_file_name}`);
    } catch (error) { console.error('Product upload error:', error); ctx.reply(`❌ Gagal menyimpan produk digital: ${error.message}`); }
  }

  async handleProductText(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return false;
      const text = ctx.message.text || '';
      if (this.pendingBroadcastAdmins.has(ctx.from.id)) return this.handleBroadcastText(ctx);
      if (await this.handleAdminCommand(ctx, text)) return true;
      if (!/nama\s*:/i.test(text) || !/harga\s*:/i.test(text)) return false;
      const data = this.parseProductText(text); if (!data.name || !data.price) return false;
      const selectedType = this.pendingProductTypes.get(ctx.from.id);
      if (selectedType && selectedType !== 'text') { await ctx.reply('❌ Kamu memilih produk file. Upload file sebagai dokumen dengan caption.'); return true; }
      data.is_digital = true; data.delivery_type = 'text';
      if (!data.delivery_text) { await ctx.reply('❌ Produk Text Saja wajib memiliki bagian Text:.'); return true; }
      const result = await db.createProduct(data); this.pendingProductTypes.delete(ctx.from.id);
      await ctx.reply(`✅ Produk text digital berhasil ditambahkan!\n\nID: ${result.id}\nNama: ${data.name}\nHarga: Rp${this.formatPrice(data.price)}`);
      return true;
    } catch (error) { console.error('Product text error:', error); ctx.reply(`❌ Gagal menyimpan produk text: ${error.message}`); return true; }
  }

  async handleAdminCommand(ctx, text) {
    const t = text.trim();
    if (/^RESTORE SAYA SETUJU$/i.test(t) && this.pendingRestoreConfirm.has(ctx.from.id)) {
      this.pendingRestoreConfirm.delete(ctx.from.id); this.pendingRestoreAdmins.add(ctx.from.id);
      await ctx.reply('✅ Konfirmasi diterima. Sekarang upload file backup .tar.gz ke chat ini.'); return true;
    }
    let m;
    if ((m = t.match(/^editprod\s+(\d+)\s+(nama|harga|stok|kategori|deskripsi|snk|text|tipe)\s+([\s\S]+)/i))) {
      const id = Number(m[1]); const field = m[2].toLowerCase(); const value = m[3].trim();
      const map = { nama:'name', harga:'price', stok:'stock', kategori:'category', deskripsi:'description', snk:'terms_conditions', text:'delivery_text', tipe:'delivery_type' };
      const data = {}; data[map[field]] = ['harga','stok'].includes(field) ? Number(value.replace(/[^0-9]/g,'')) : field === 'tipe' ? this.normalizeDeliveryType(value) : value;
      await db.updateProduct(id, data); await db.logAudit(ctx.from.id,'edit_product',`product:${id}`,`${field} => ${value}`); await ctx.reply(`✅ Produk #${id} berhasil diupdate: ${field}`); return true;
    }
    if ((m = t.match(/^hapusprod\s+(\d+)/i))) { await db.softDeleteProduct(Number(m[1])); await db.logAudit(ctx.from.id,'soft_delete_product',`product:${m[1]}`,'via command'); await ctx.reply(`✅ Produk #${m[1]} dinonaktifkan.`); return true; }
    if ((m = t.match(/^aktifprod\s+(\d+)/i))) { await db.setProductActive(Number(m[1]), true); await ctx.reply(`✅ Produk #${m[1]} diaktifkan.`); return true; }
    if ((m = t.match(/^nonaktifprod\s+(\d+)/i))) { await db.setProductActive(Number(m[1]), false); await ctx.reply(`✅ Produk #${m[1]} dinonaktifkan.`); return true; }
    if ((m = t.match(/^coupon\s+(\S+)\s+(percent|fixed)\s+(\d+)(?:\s+(\d+))?/i))) { await db.saveCoupon(m[1], m[2], Number(m[3]), Number(m[4] || 0)); await db.logAudit(ctx.from.id,'save_coupon',m[1].toUpperCase(),`${m[2]} ${m[3]}`); await ctx.reply(`✅ Kupon ${m[1].toUpperCase()} disimpan.`); return true; }
    if ((m = t.match(/^delcoupon\s+(\S+)/i))) { await db.deleteCoupon(m[1]); await ctx.reply(`✅ Kupon ${m[1].toUpperCase()} dinonaktifkan.`); return true; }
    if ((m = t.match(/^cek\s+(ORD-[\w-]+)/i))) { await this.sendOrderCheck(ctx, m[1]); return true; }
    if ((m = t.match(/^resend\s+(ORD-[\w-]+)/i))) { await this.resendOrder(ctx, m[1]); return true; }
    if (/^maintenance_on$/i.test(t)) { await db.setSetting('maintenance_mode','on'); await ctx.reply('✅ Maintenance mode ON. User biasa akan dibatasi.'); return true; }
    if (/^maintenance_off$/i.test(t)) { await db.setSetting('maintenance_mode','off'); await db.logAudit(ctx.from.id,'maintenance_off','settings','Maintenance OFF'); await ctx.reply('✅ Maintenance mode OFF. Bot normal kembali.'); return true; }
    if ((m = t.match(/^refund\s+(ORD-[\w-]+)/i))) { await this.refundOrder(ctx, m[1]); return true; }
    if ((m = t.match(/^setgopaykey\s+([\s\S]+)/i))) { await db.setSetting('GOPAY_KEY', m[1].trim()); await db.logAudit(ctx.from.id,'set_setting','GOPAY_KEY','updated via bot'); await ctx.reply('✅ GOPAY_KEY disimpan di database settings. Restart bot diperlukan kalau kode masih memakai .env aktif.'); return true; }
    if ((m = t.match(/^setpaymenturl\s+([\s\S]+)/i))) { await db.setSetting('GOPAY_QRIS_GENERATE_URL', m[1].trim()); await db.logAudit(ctx.from.id,'set_setting','GOPAY_QRIS_GENERATE_URL',m[1].trim()); await ctx.reply('✅ URL generate QRIS disimpan.'); return true; }
    if ((m = t.match(/^setqrisexpired\s+(\d+)/i))) { await db.setSetting('QRIS_EXPIRED_MINUTES', m[1]); await db.logAudit(ctx.from.id,'set_setting','QRIS_EXPIRED_MINUTES',m[1]); await ctx.reply(`✅ Expired QRIS disimpan: ${m[1]} menit.`); return true; }
    if ((m = t.match(/^addcat\s+(.+)/i))) { await db.saveCategory(m[1]); await db.logAudit(ctx.from.id,'add_category','category',m[1]); await ctx.reply(`✅ Kategori ${m[1]} disimpan.`); return true; }
    return false;
  }

  async sendOrderCheck(ctx, orderNumber) {
    const detail = await db.getOrderDetailByNumber(orderNumber);
    if (!detail) return ctx.reply('❌ Order tidak ditemukan.');
    const { order, items, payment } = detail;
    let msg = `🔎 CEK ORDER\n\nOrder: ${order.order_number}\nUser ID: ${order.telegram_id}\nUsername: ${order.username ? '@'+order.username : '-'}\nNama: ${[order.first_name, order.last_name].filter(Boolean).join(' ') || '-'}\nStatus: ${this.statusLabel(order)}\nPayment: ${order.payment_status}\nDelivery: ${order.digital_delivered ? 'Sudah terkirim' : 'Belum'}\nTotal: Rp${this.formatPrice(order.total_price)}\nTransaksi: ${payment?.transaction_id || '-'}\n\nItem:\n`;
    items.forEach((i) => { msg += `- ${i.name} x${i.quantity} = Rp${this.formatPrice(i.price * i.quantity)}\n`; });
    return ctx.reply(msg);
  }

  async resendOrder(ctx, orderNumber) {
    const paymentHandler = require('./paymentHandler');
    const order = await db.getOrderByNumber(orderNumber);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');
    await db.run('UPDATE orders SET digital_delivered = 0, delivered_at = NULL WHERE id = ?', [order.id]);
    const result = await paymentHandler.deliverDigitalProducts(order.id, order.telegram_id, ctx.telegram);
    return ctx.reply(`✅ Resend ${order.order_number}: ${result.delivered ? 'terkirim' : result.reason}`);
  }

  async getAnalytics(ctx, period = 'today') {
    try {
      const stats = await db.getAnalytics(); const report = await db.getSalesReport(period);
      let message = `📊 ANALYTICS & LAPORAN\n\n📈 RINGKASAN TOTAL:\nTotal Pesanan: ${stats.totalOrders}\nTotal Revenue Paid: Rp${this.formatPrice(stats.totalRevenue)}\nPesanan Pending: ${stats.pendingOrders}\nPesanan Selesai: ${stats.completedOrders}\nTotal Pelanggan: ${stats.totalCustomers}\nTotal Produk: ${stats.totalProducts}\n\n📅 LAPORAN ${period.toUpperCase()}:\nTotal Order: ${report.totalOrders}\nOrder Paid: ${report.paidOrders}\nOrder Pending: ${report.pendingOrders}\nOmzet Paid: Rp${this.formatPrice(report.revenue)}\n\n🔥 Produk Terlaris:\n`;
      if (!report.topProducts.length) message += '- Belum ada data\n';
      report.topProducts.forEach((p, i) => { message += `${i+1}. ${p.name} - ${p.sold} terjual - Rp${this.formatPrice(p.revenue)}\n`; });
      await this.replyOrEdit(ctx, message, { inline_keyboard: [
        [{ text:'📊 Hari Ini', callback_data:'admin_report_today' }, { text:'📊 7 Hari', callback_data:'admin_report_week' }, { text:'📊 30 Hari', callback_data:'admin_report_month' }],
        [{ text:'⬅️ Kembali', callback_data:'admin_menu' }]
      ]});
    } catch (error) { console.error('Analytics error:', error); ctx.reply('❌ Gagal memuat analytics.'); }
  }

  async manageOrders(ctx) {
    try {
      const orders = await db.getAllOrders(); let message = '📋 KELOLA PESANAN\n\n';
      message += `Total Pesanan: ${orders.length}\n\n`;
      orders.slice(0, 10).forEach((o) => { message += `#${o.order_number}\nUser: ${o.telegram_id}\nStatus: ${this.statusLabel(o)}\nPembayaran: ${o.payment_status}\nTotal: Rp${this.formatPrice(o.total_price)}\n─────────────────\n`; });
      message += '\nCommand admin:\ncek ORD-xxx\nresend ORD-xxx\npaid ORD-xxx\nreject ORD-xxx';
      await this.replyOrEdit(ctx, message, { inline_keyboard: [[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
    } catch (error) { console.error('Manage orders error:', error); ctx.reply('❌ Gagal memuat pesanan.'); }
  }

  async couponMenu(ctx) {
    const coupons = await db.getCoupons(); let msg = '🎟️ KUPON / DISKON\n\n';
    msg += 'Buat kupon lewat chat admin:\ncoupon KODE percent 10 100\ncoupon KODE fixed 5000 50\ndelcoupon KODE\n\nDaftar kupon:\n';
    coupons.slice(0,20).forEach((c)=>{ msg += `${c.active?'✅':'❌'} ${c.code} - ${c.type} ${c.value} - used ${c.used_count}/${c.usage_limit || '∞'}\n`; });
    await this.replyOrEdit(ctx, msg, { inline_keyboard: [[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
  }

  async maintenanceMenu(ctx) {
    const on = await db.isMaintenanceMode();
    await this.replyOrEdit(ctx, `🛠️ MAINTENANCE MODE\n\nStatus sekarang: ${on ? 'ON' : 'OFF'}\n\nCommand cepat:\nmaintenance_on\nmaintenance_off`, { inline_keyboard: [
      [{ text:'✅ ON', callback_data:'admin_maintenance_on' }, { text:'❌ OFF', callback_data:'admin_maintenance_off' }],
      [{ text:'⬅️ Kembali', callback_data:'admin_menu' }]
    ]});
  }

  async setMaintenance(ctx, enabled) { await ctx.answerCbQuery().catch(()=>{}); await db.setSetting('maintenance_mode', enabled ? 'on':'off'); return this.maintenanceMenu(ctx); }

  async errorLogs(ctx) {
    const rows = await db.getRecentErrors(10); let msg = '⚠️ LOG ERROR TERBARU\n\n';
    if (!rows.length) msg += 'Belum ada error tersimpan.';
    rows.forEach((e)=>{ msg += `#${e.id} ${e.created_at}\nSource: ${e.source}\nError: ${e.message}\n──────────────\n`; });
    await this.replyOrEdit(ctx, msg, { inline_keyboard: [[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
  }

  async backupMenu(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const ids = adminNotifyService.getAdminIds().join(', ') || '-';
      const message = `💾 BACKUP & RESTORE DATA\n\nBackup otomatis aktif jam 00:00 WIB dan dikirim ke admin:\n${ids}\n\n⚠️ File backup rahasia. Restore sekarang memakai konfirmasi ganda agar tidak salah timpa data.`;
      await this.replyOrEdit(ctx, message, { inline_keyboard: [[{ text:'📤 Buat Backup Sekarang', callback_data:'admin_backup_now' }],[{ text:'📥 Restore dari File Backup', callback_data:'admin_restore_backup' }],[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
    } catch (error) { console.error('Backup menu error:', error); ctx.reply('❌ Gagal membuka menu backup.'); }
  }

  async createManualBackup(ctx) {
    try { await ctx.answerCbQuery('Membuat backup...').catch(()=>{}); if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.'); const backup = await backupService.createBackup('manual'); await ctx.replyWithDocument({ source: backup.path, filename: backup.name }, { caption: '✅ Backup manual berhasil dibuat. File ini rahasia.' }); }
    catch (error) { console.error('Manual backup error:', error); ctx.reply(`❌ Gagal membuat backup: ${error.message}`); }
  }

  async promptRestoreBackup(ctx) {
    try { await ctx.answerCbQuery().catch(()=>{}); if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.'); this.pendingRestoreConfirm.add(ctx.from.id); this.pendingRestoreAdmins.delete(ctx.from.id); await this.replyOrEdit(ctx, `📥 RESTORE BACKUP\n\n⚠️ Restore akan menimpa database aktif.\n\nUntuk lanjut, ketik persis:\nRESTORE SAYA SETUJU\n\nSetelah itu baru upload file backup .tar.gz.`, { inline_keyboard: [[{ text:'❌ Batal Restore', callback_data:'admin_cancel_restore' }],[{ text:'⬅️ Kembali', callback_data:'admin_backup' }]] }); }
    catch (error) { console.error('Prompt restore error:', error); ctx.reply('❌ Gagal membuka restore.'); }
  }

  async cancelRestore(ctx) { await ctx.answerCbQuery('Restore dibatalkan.').catch(()=>{}); this.pendingRestoreAdmins.delete(ctx.from.id); this.pendingRestoreConfirm.delete(ctx.from.id); return this.backupMenu(ctx); }

  async handleRestoreUpload(ctx) {
    try { if (!(await this.checkAdmin(ctx.from.id))) return; const document = ctx.message.document; if (!document || !(document.file_name || '').endsWith('.tar.gz')) return ctx.reply('❌ File restore harus backup .tar.gz.'); await ctx.reply('⏳ File backup diterima. Sedang restore data...'); const result = await backupService.restoreFromTelegramDocument(ctx.telegram, document); this.pendingRestoreAdmins.delete(ctx.from.id); await ctx.reply(`✅ Restore berhasil.\nBackup pengaman: ${result.safetyBackup.name}\n⚠️ Restart bot jika .env ikut direstore.`); }
    catch (error) { console.error('Restore upload error:', error); await ctx.reply(`❌ Restore gagal: ${error.message}`); }
  }

  async syncAdminContact(ctx) {
    try { await ctx.answerCbQuery('Mengecek username admin...').catch(()=>{}); if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.'); const result = await adminContactService.syncAdminContact(ctx.telegram); if (!result.ok) return ctx.reply(`❌ Gagal auto setting admin contact.\n${result.reason || ''}`); return ctx.reply(`✅ Admin contact berhasil disetting.\nID: ${result.adminId}\nNama: ${result.displayName || '-'}\n${result.hasUsername ? `Username: @${result.username}` : `Fallback: ${result.contactUrl}`}`); }
    catch (error) { console.error('Sync admin contact error:', error); return ctx.reply(`❌ Gagal setting kontak admin: ${error.message}`); }
  }


  async dashboard(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const d = await db.getDashboardStats();
      const maintenance = await db.isMaintenanceMode();
      const msg = `📊 DASHBOARD RINGKAS\n\nOrder Hari Ini: ${d.ordersToday}\nPayment Sukses: ${d.paidToday}\nPending: ${d.pendingToday}\nOmzet Hari Ini: Rp${this.formatPrice(d.revenueToday)}\nProduk Aktif: ${d.productActive}\nUser Terdaftar: ${d.users}\nBackup Terakhir: ${d.lastBackup}\nStatus Bot: Online\nMaintenance: ${maintenance ? 'ON' : 'OFF'}`;
      return this.replyOrEdit(ctx, msg, { inline_keyboard: [[{ text:'📊 Laporan Lengkap', callback_data:'admin_analytics' }],[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
    } catch (error) { console.error('Dashboard error:', error); return ctx.reply('❌ Gagal memuat dashboard.'); }
  }

  async settingsMenu(ctx) {
    const msg = `⚙️ PENGATURAN BOT\n\nCommand setting cepat:\nsetgopaykey TOKEN_PROVIDER\nsetpaymenturl https://url-generate-qris\nsetqrisexpired 10\naddcat Nama Kategori\nmaintenance_on\nmaintenance_off\n\nCatatan: setting API yang berpengaruh ke process.env tetap paling aman disimpan di .env dan restart PM2.`;
    return this.replyOrEdit(ctx, msg, { inline_keyboard: [[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
  }

  async exportMenu(ctx) {
    const msg = '📥 EXPORT LAPORAN\n\nPilih data yang ingin didownload.';
    return this.replyOrEdit(ctx, msg, { inline_keyboard: [
      [{ text:'Orders CSV', callback_data:'export_orders_csv' }, { text:'Payments CSV', callback_data:'export_payments_csv' }],
      [{ text:'Products CSV', callback_data:'export_products_csv' }, { text:'Users CSV', callback_data:'export_users_csv' }],
      [{ text:'Coupons JSON', callback_data:'export_coupons_json' }, { text:'Audit CSV', callback_data:'export_audit_csv' }],
      [{ text:'⬅️ Kembali', callback_data:'admin_menu' }]
    ]});
  }

  escapeCsv(value) {
    const s = value === null || value === undefined ? '' : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  async exportData(ctx, kind, format = 'csv') {
    try {
      await ctx.answerCbQuery('Membuat export...').catch(() => {});
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const fs = require('fs'); const path = require('path');
      const rows = await db.exportRows(kind);
      const dir = path.join(process.cwd(), 'reports'); fs.mkdirSync(dir, { recursive: true });
      const filename = `${kind}-${Date.now()}.${format}`; const filepath = path.join(dir, filename);
      if (format === 'json') fs.writeFileSync(filepath, JSON.stringify(rows, null, 2));
      else {
        const headers = rows[0] ? Object.keys(rows[0]) : ['empty'];
        const csv = [headers.map((h)=>this.escapeCsv(h)).join(','), ...rows.map((r)=>headers.map((h)=>this.escapeCsv(r[h])).join(','))].join('\n');
        fs.writeFileSync(filepath, csv);
      }
      await db.logAudit(ctx.from.id,'export_data',kind,format);
      return ctx.replyWithDocument({ source: filepath, filename }, { caption: `✅ Export ${kind} berhasil dibuat.` });
    } catch (error) { console.error('Export error:', error); return ctx.reply(`❌ Gagal export: ${error.message}`); }
  }

  async auditLogs(ctx) {
    const rows = await db.getAuditLogs(20); let msg = '🧾 AUDIT LOG ADMIN\n\n';
    if (!rows.length) msg += 'Belum ada audit log.';
    rows.forEach((a)=>{ msg += `#${a.id} ${a.created_at}\nAdmin: ${a.admin_id || '-'}\nAksi: ${a.action}\nTarget: ${a.target || '-'}\nDetail: ${a.details || '-'}\n──────────────\n`; });
    return this.replyOrEdit(ctx, msg, { inline_keyboard: [[{ text:'⬅️ Kembali', callback_data:'admin_menu' }]] });
  }

  async refundOrder(ctx, orderNumber) {
    const order = await db.refundOrder(orderNumber);
    await db.logAudit(ctx.from.id,'refund_order',orderNumber,'manual admin command');
    await ctx.telegram.sendMessage(order.telegram_id, `↩️ Pesanan #${order.order_number} ditandai refund oleh admin. Jika kamu belum menerima dana, silakan hubungi admin.`).catch(()=>{});
    return ctx.reply(`✅ Order ${orderNumber} ditandai REFUNDED.`);
  }

  async broadcastMenu(ctx) {
    try {
      if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
      const users = await db.getBroadcastUsers();
      const msg = `📣 BROADCAST USER\n\nTotal target: ${users.length} user terdaftar\n\nPilih jenis broadcast, lalu kirim kontennya ke bot.\n\n✅ Text: kirim pesan text biasa\n✅ Foto: kirim foto dengan caption opsional\n✅ Video: kirim video dengan caption opsional\n\nBot akan menampilkan preview dulu sebelum broadcast dikirim.`;
      return this.replyOrEdit(ctx, msg, { inline_keyboard: [
        [{ text: '📝 Broadcast Text', callback_data: 'broadcast_start_text' }],
        [{ text: '🖼️ Broadcast Foto', callback_data: 'broadcast_start_photo' }],
        [{ text: '🎬 Broadcast Video', callback_data: 'broadcast_start_video' }],
        [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
      ]});
    } catch (error) { console.error('Broadcast menu error:', error); return ctx.reply('❌ Gagal membuka menu broadcast.'); }
  }

  async startBroadcast(ctx, type) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    this.pendingBroadcastAdmins.add(ctx.from.id);
    this.broadcastDrafts.delete(ctx.from.id);
    const guide = type === 'text'
      ? 'Kirim isi pesan text yang ingin dibroadcast.'
      : type === 'photo'
        ? 'Kirim FOTO yang ingin dibroadcast. Caption boleh diisi.'
        : 'Kirim VIDEO yang ingin dibroadcast. Caption boleh diisi.';
    this.broadcastDrafts.set(ctx.from.id, { expectedType: type, status: 'waiting_content' });
    return ctx.reply(`📣 MODE BROADCAST ${type.toUpperCase()}\n\n${guide}\n\nKetik /admin untuk batal.`);
  }

  async handleBroadcastText(ctx) {
    if (!(await this.checkAdmin(ctx.from.id))) return false;
    const draft = this.broadcastDrafts.get(ctx.from.id) || {};
    const text = ctx.message.text || '';
    if (text === '/admin') { this.pendingBroadcastAdmins.delete(ctx.from.id); this.broadcastDrafts.delete(ctx.from.id); return false; }
    if (draft.expectedType && draft.expectedType !== 'text') {
      await ctx.reply(`❌ Kamu memilih broadcast ${draft.expectedType}. Kirim media yang sesuai, atau /admin untuk batal.`);
      return true;
    }
    this.broadcastDrafts.set(ctx.from.id, { type: 'text', text, status: 'preview' });
    await ctx.reply(`📣 PREVIEW BROADCAST TEXT\n\n${text}\n\nKirim ke semua user?`, { reply_markup: { inline_keyboard: [
      [{ text: '✅ Kirim Broadcast', callback_data: 'broadcast_confirm' }],
      [{ text: '❌ Batal', callback_data: 'broadcast_cancel' }]
    ] } });
    return true;
  }

  async handleBroadcastPhoto(ctx) {
    if (!(await this.checkAdmin(ctx.from.id))) return false;
    if (!this.pendingBroadcastAdmins.has(ctx.from.id)) return false;
    const draft = this.broadcastDrafts.get(ctx.from.id) || {};
    if (draft.expectedType && draft.expectedType !== 'photo') { await ctx.reply('❌ Kamu memilih jenis broadcast lain. Buka /admin untuk ulang.'); return true; }
    const photos = ctx.message.photo || [];
    const best = photos[photos.length - 1];
    if (!best?.file_id) { await ctx.reply('❌ Foto tidak valid.'); return true; }
    const caption = ctx.message.caption || '';
    this.broadcastDrafts.set(ctx.from.id, { type: 'photo', fileId: best.file_id, caption, status: 'preview' });
    await ctx.replyWithPhoto(best.file_id, { caption: `📣 PREVIEW BROADCAST FOTO\n\n${caption || '(tanpa caption)'}`, reply_markup: { inline_keyboard: [
      [{ text: '✅ Kirim Broadcast', callback_data: 'broadcast_confirm' }],
      [{ text: '❌ Batal', callback_data: 'broadcast_cancel' }]
    ] } });
    return true;
  }

  async handleBroadcastVideo(ctx) {
    if (!(await this.checkAdmin(ctx.from.id))) return false;
    if (!this.pendingBroadcastAdmins.has(ctx.from.id)) return false;
    const draft = this.broadcastDrafts.get(ctx.from.id) || {};
    if (draft.expectedType && draft.expectedType !== 'video') { await ctx.reply('❌ Kamu memilih jenis broadcast lain. Buka /admin untuk ulang.'); return true; }
    const video = ctx.message.video;
    if (!video?.file_id) { await ctx.reply('❌ Video tidak valid.'); return true; }
    const caption = ctx.message.caption || '';
    this.broadcastDrafts.set(ctx.from.id, { type: 'video', fileId: video.file_id, caption, status: 'preview' });
    await ctx.replyWithVideo(video.file_id, { caption: `📣 PREVIEW BROADCAST VIDEO\n\n${caption || '(tanpa caption)'}`, reply_markup: { inline_keyboard: [
      [{ text: '✅ Kirim Broadcast', callback_data: 'broadcast_confirm' }],
      [{ text: '❌ Batal', callback_data: 'broadcast_cancel' }]
    ] } });
    return true;
  }

  async handleBroadcastDocument(ctx) {
    if (!(await this.checkAdmin(ctx.from.id))) return false;
    if (!this.pendingBroadcastAdmins.has(ctx.from.id)) return false;
    await ctx.reply('❌ Broadcast saat ini mendukung text, foto, dan video. Untuk produk digital berbentuk file, gunakan menu Tambah Produk Digital.');
    return true;
  }

  async confirmBroadcast(ctx) {
    await ctx.answerCbQuery('Broadcast diproses...').catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const draft = this.broadcastDrafts.get(ctx.from.id);
    if (!draft || draft.status !== 'preview') return ctx.reply('❌ Tidak ada draft broadcast aktif.');
    const users = await db.getBroadcastUsers();
    let success = 0; let failed = 0;
    for (const user of users) {
      try {
        if (draft.type === 'text') await ctx.telegram.sendMessage(user.telegram_id, draft.text);
        else if (draft.type === 'photo') await ctx.telegram.sendPhoto(user.telegram_id, draft.fileId, { caption: draft.caption || undefined });
        else if (draft.type === 'video') await ctx.telegram.sendVideo(user.telegram_id, draft.fileId, { caption: draft.caption || undefined });
        success += 1;
        await new Promise((resolve) => setTimeout(resolve, Number(process.env.BROADCAST_DELAY_MS || 80)));
      } catch (error) {
        failed += 1;
        console.error(`Broadcast failed to ${user.telegram_id}:`, error.message);
      }
    }
    await db.logAudit(ctx.from.id, 'broadcast', draft.type, `success:${success}, failed:${failed}`);
    this.pendingBroadcastAdmins.delete(ctx.from.id);
    this.broadcastDrafts.delete(ctx.from.id);
    return ctx.reply(`✅ Broadcast selesai.\n\nJenis: ${draft.type}\nBerhasil: ${success}\nGagal: ${failed}\nTotal target: ${users.length}`);
  }

  async cancelBroadcast(ctx) {
    await ctx.answerCbQuery('Broadcast dibatalkan.').catch(() => {});
    this.pendingBroadcastAdmins.delete(ctx.from.id);
    this.broadcastDrafts.delete(ctx.from.id);
    return ctx.reply('❌ Broadcast dibatalkan.');
  }


  async cleanupMenu(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    const cfg = cleanupService.getConfig();
    const last = await db.getSetting('last_cleanup_at', '-').catch(() => '-');
    const message = `🧹 AUTO-CLEANUP DATA LAMA\n\n` +
      `Status: ${cleanupService.isEnabled() ? '✅ Aktif' : '❌ Nonaktif'}\n` +
      `Interval: ${Math.round(cfg.intervalMs / 60000)} menit\n` +
      `Cleanup QRIS expired: ${cfg.qrisDays} hari\n` +
      `Cleanup cart lama: ${cfg.cartDays} hari\n` +
      `Cleanup error log: ${cfg.errorLogDays} hari\n` +
      `Cleanup audit/delivery log: ${cfg.auditLogDays}/${cfg.deliveryLogDays} hari\n` +
      `Cleanup report lokal: ${cfg.reportDays} hari\n` +
      `Cleanup backup lokal: ${cfg.localBackupDays} hari\n\n` +
      `Cleanup terakhir: ${last}\n\n` +
      `Catatan: order paid/delivered, produk, user, dan data transaksi utama tidak dihapus.`;
    return this.replyOrEdit(ctx, message, { inline_keyboard: [
      [{ text: '🧹 Jalankan Cleanup Sekarang', callback_data: 'admin_cleanup_now' }],
      [{ text: '⬅️ Kembali', callback_data: 'admin_menu' }]
    ]});
  }

  async runCleanup(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Menjalankan cleanup...').catch(() => {});
    if (!(await this.checkAdmin(ctx.from.id))) return ctx.reply('❌ Anda tidak memiliki akses admin.');
    try {
      const result = await cleanupService.run(ctx.telegram, 'manual_admin');
      await db.logAudit(ctx.from.id, 'manual_cleanup', 'cleanup', JSON.stringify(result.database || {}));
      return ctx.reply(cleanupService.formatResult(result));
    } catch (error) {
      console.error('Manual cleanup error:', error);
      return ctx.reply(`❌ Cleanup gagal: ${error.message}`);
    }
  }

  async sendNotification(ctx) { return this.broadcastMenu(ctx); }
  async replyOrEdit(ctx, message, reply_markup) { if (ctx.callbackQuery) { await ctx.answerCbQuery().catch(()=>{}); return ctx.editMessageText(message,{reply_markup}).catch(()=>ctx.reply(message,{reply_markup})); } return ctx.reply(message,{reply_markup}); }
}

module.exports = new AdminHandler();
