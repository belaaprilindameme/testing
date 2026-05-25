const db = require('../config/database');

class ProductHandler {
  formatPrice(value) { return Number(value || 0).toLocaleString('id-ID'); }
  deliveryTypeLabel(type) { if (type === 'file') return 'File digital'; if (type === 'text') return 'Text digital'; return 'File + Text digital'; }

  async showProducts(ctx, page = 1, category = null, keyword = '') {
    try {
      await db.addUser(ctx.from.id, ctx.from);
      const pageSize = Number(process.env.PRODUCT_PAGE_SIZE || 6);
      const products = await db.searchProducts(keyword, page, pageSize, category);
      const total = await db.countProducts(keyword, category);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      if (!products.length) {
        return this.replyOrEdit(ctx, '📦 Produk tidak ditemukan.', { inline_keyboard: [[{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]] });
      }

      let message = '🛍️ KATALOG PRODUK\n\n';
      if (category) message += `Kategori: ${category}\n`;
      if (keyword) message += `Pencarian: ${keyword}\n`;
      message += `Halaman ${page}/${totalPages}\n\nKlik detail produk sebelum membeli agar tidak salah checkout.\n\n`;
      const keyboard = [];

      for (const product of products) {
        const rating = await db.getProductRating(product.id).catch(() => ({ average: 0, count: 0 }));
        message += `#${product.id} ${product.name}\n`;
        message += `💰 Rp${this.formatPrice(product.price)} | 📦 Stok: ${product.stock}\n`;
        message += `🏷️ ${product.category || '-'} | 📩 ${this.deliveryTypeLabel(product.delivery_type)}\n`;
        if (rating?.count) message += `⭐ ${Number(rating.average).toFixed(1)}/5 dari ${rating.count} rating\n`;
        message += `─────────────────\n`;
        keyboard.push([{ text: `ℹ️ Detail ${product.name}`.slice(0, 60), callback_data: `product_detail_${product.id}` }]);
      }

      const nav = [];
      if (page > 1) nav.push({ text: '⬅️ Sebelumnya', callback_data: `products_page_${page - 1}` });
      if (page < totalPages) nav.push({ text: '➡️ Berikutnya', callback_data: `products_page_${page + 1}` });
      if (nav.length) keyboard.push(nav);
      keyboard.push([{ text: '📁 Kategori', callback_data: 'show_categories' }, { text: '🔍 Cari Produk', callback_data: 'search_help' }]);
      keyboard.push([{ text: '🛒 Lihat Keranjang', callback_data: 'show_cart' }]);
      keyboard.push([{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]);
      await this.replyOrEdit(ctx, message, { inline_keyboard: keyboard });
    } catch (error) {
      console.error('Show products error:', error);
      ctx.reply('❌ Gagal memuat katalog produk.');
    }
  }

  async showCategories(ctx) {
    try {
      const categories = await db.getCategories();
      let message = '📁 KATEGORI PRODUK\n\nPilih kategori untuk melihat produk.';
      const keyboard = categories.map((c) => [{ text: `${c.name} (${c.total})`, callback_data: `category_${encodeURIComponent(c.name)}` }]);
      keyboard.push([{ text: '🛍️ Semua Produk', callback_data: 'show_products' }]);
      keyboard.push([{ text: '⬅️ Menu Utama', callback_data: 'back_home' }]);
      return this.replyOrEdit(ctx, message, { inline_keyboard: keyboard });
    } catch (error) { console.error('Category error:', error); return ctx.reply('❌ Gagal memuat kategori.'); }
  }

  async searchHelp(ctx) {
    const message = '🔍 CARI PRODUK\n\nKetik format:\n/search nama produk\n\nContoh:\n/search script bot';
    return this.replyOrEdit(ctx, message, { inline_keyboard: [[{ text: '⬅️ Katalog', callback_data: 'show_products' }]] });
  }

  async searchProducts(ctx, keyword) {
    return this.showProducts(ctx, 1, null, keyword);
  }

  async showProductDetail(ctx, productId = null) {
    try {
      const id = productId || Number(ctx.match?.[1]);
      const product = await db.getProduct(id);
      if (!product || Number(product.active) === 0) return ctx.reply('❌ Produk tidak ditemukan atau sedang nonaktif.');
      const rating = await db.getProductRating(product.id).catch(() => ({ average: 0, count: 0 }));
      const description = product.description || 'Belum ada deskripsi produk.';
      const terms = product.terms_conditions || 'Dengan membeli produk ini, user dianggap sudah membaca deskripsi produk. Produk digital yang sudah dikirim tidak bisa dibatalkan kecuali ada kesalahan dari admin.';
      const hasFile = product.digital_file_id ? 'Ada' : 'Tidak ada';
      const hasText = product.delivery_text ? 'Ada' : 'Tidak ada';
      const message = `🛍️ DETAIL PRODUK\n\n` +
        `🆔 ID: ${product.id}\n📦 Nama: ${product.name}\n💰 Harga: Rp${this.formatPrice(product.price)}\n📊 Stok: ${product.stock}\n🏷️ Kategori: ${product.category || '-'}\n📩 Jenis Produk: ${this.deliveryTypeLabel(product.delivery_type)}\n📎 File Delivery: ${hasFile}\n📝 Text Delivery: ${hasText}\n⭐ Rating: ${rating?.count ? `${Number(rating.average).toFixed(1)}/5 dari ${rating.count} pembeli` : 'Belum ada rating'}\n\n` +
        `📖 DESKRIPSI PRODUK\n${description}\n\n⚠️ SYARAT & KETENTUAN PRODUK\n${terms}\n\nPastikan produk, jenis delivery, deskripsi, dan S&K sudah sesuai sebelum menambahkan ke keranjang.`;
      await this.replyOrEdit(ctx, message, { inline_keyboard: [[{ text: '✅ Saya Paham, Tambah ke Keranjang', callback_data: `add_to_cart_${product.id}` }],[{ text: '⬅️ Kembali ke Katalog', callback_data: 'show_products' }]] });
    } catch (error) { console.error('Product detail error:', error); ctx.reply('❌ Gagal memuat detail produk.'); }
  }

  async replyOrEdit(ctx, message, reply_markup) {
    if (ctx.callbackQuery) { await ctx.answerCbQuery().catch(() => {}); return ctx.editMessageText(message, { reply_markup }).catch(() => ctx.reply(message, { reply_markup })); }
    return ctx.reply(message, { reply_markup });
  }
}

module.exports = new ProductHandler();
