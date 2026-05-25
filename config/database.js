const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../database/ecommerce.db');
const DB_DIR = path.dirname(DB_PATH);

class Database {
  constructor() {
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    fs.mkdirSync(DB_DIR, { recursive: true });

    await new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) return reject(err);
        console.log('✅ Connected to SQLite database');
        resolve();
      });
    });

    await this.createTables();
    await this.migrateTables();
    await this.seedProducts();
  }

  rawRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  rawGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  rawAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  run(sql, params = []) {
    return this.ready.then(() => this.rawRun(sql, params));
  }

  get(sql, params = []) {
    return this.ready.then(() => this.rawGet(sql, params));
  }

  all(sql, params = []) {
    return this.ready.then(() => this.rawAll(sql, params));
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        category TEXT,
        is_digital INTEGER DEFAULT 1,
        delivery_type TEXT DEFAULT 'file_text',
        digital_file_id TEXT,
        digital_file_name TEXT,
        delivery_text TEXT,
        terms_conditions TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        payment_id TEXT,
        shipping_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        digital_delivered INTEGER DEFAULT 0,
        delivered_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS shipping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        courier TEXT DEFAULT 'Belum ditentukan',
        tracking_number TEXT UNIQUE,
        status TEXT DEFAULT 'processing',
        location TEXT DEFAULT 'Gudang',
        estimated_delivery DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        transaction_id TEXT UNIQUE,
        token TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS qris_pending_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_code TEXT UNIQUE NOT NULL,
        order_id INTEGER NOT NULL,
        order_number TEXT NOT NULL,
        telegram_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        original_amount REAL NOT NULL,
        transaction_id TEXT,
        qr_url TEXT,
        qr_message_id INTEGER,
        status TEXT DEFAULT 'pending',
        created_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS pre_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pre_order_number TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        order_number TEXT,
        telegram_id INTEGER NOT NULL,
        request_type TEXT NOT NULL,
        request_text TEXT,
        request_file_id TEXT,
        request_file_name TEXT,
        request_caption TEXT,
        amount REAL NOT NULL DEFAULT 0,
        base_amount REAL DEFAULT 0,
        additional_fee REAL DEFAULT 0,
        work_start_date TEXT,
        work_end_date TEXT,
        work_estimate TEXT,
        quote_expires_at DATETIME,
        status TEXT DEFAULT 'submitted',
        transaction_id TEXT,
        admin_note TEXT,
        revision_count INTEGER DEFAULT 0,
        max_revision INTEGER DEFAULT 1,
        revision_note TEXT,
        cancel_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        quoted_at DATETIME,
        paid_at DATETIME,
        processed_at DATETIME,
        delivered_at DATETIME,
        completed_at DATETIME,
        cancelled_at DATETIME,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS pre_order_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pre_order_id INTEGER,
        actor_type TEXT,
        actor_id TEXT,
        action TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(pre_order_id) REFERENCES pre_orders(id)
      )`,

      `CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        type TEXT DEFAULT 'percent',
        value REAL NOT NULL DEFAULT 0,
        active INTEGER DEFAULT 1,
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_coupons (
        telegram_id INTEGER PRIMARY KEY,
        coupon_code TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        message TEXT,
        stack TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS product_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        telegram_id INTEGER,
        rating INTEGER,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, product_id, telegram_id)
      )`,
      `CREATE TABLE IF NOT EXISTS delivery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        telegram_id INTEGER,
        product_id INTEGER,
        delivery_type TEXT,
        status TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        action TEXT,
        target TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        type TEXT,
        message TEXT,
        status TEXT DEFAULT 'created',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.rawRun(table);
    }
  }


  async addMissingColumn(table, column, definition) {
    const columns = await this.rawAll(`PRAGMA table_info(${table})`);
    const exists = columns.some((col) => col.name === column);
    if (!exists) {
      await this.rawRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  async migrateTables() {
    // Safe migrations for VPS that already ran an older database schema.
    await this.addMissingColumn('products', 'is_digital', 'INTEGER DEFAULT 1');
    await this.addMissingColumn('products', 'delivery_type', "TEXT DEFAULT 'file_text'");
    await this.addMissingColumn('products', 'digital_file_id', 'TEXT');
    await this.addMissingColumn('products', 'digital_file_name', 'TEXT');
    await this.addMissingColumn('products', 'delivery_text', 'TEXT');
    await this.addMissingColumn('products', 'terms_conditions', 'TEXT');
    await this.addMissingColumn('products', 'active', 'INTEGER DEFAULT 1');
    await this.addMissingColumn('orders', 'digital_delivered', 'INTEGER DEFAULT 0');
    await this.addMissingColumn('orders', 'delivered_at', 'DATETIME');
    await this.addMissingColumn('orders', 'refunded_at', 'DATETIME');
    await this.addMissingColumn('orders', 'reminder_sent', 'INTEGER DEFAULT 0');
    await this.addMissingColumn('orders', 'coupon_code', 'TEXT');
    await this.addMissingColumn('orders', 'discount_amount', 'REAL DEFAULT 0');
    await this.addMissingColumn('pre_orders', 'transaction_id', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'admin_note', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'base_amount', 'REAL DEFAULT 0').catch(() => {});
    await this.addMissingColumn('pre_orders', 'additional_fee', 'REAL DEFAULT 0').catch(() => {});
    await this.addMissingColumn('pre_orders', 'work_start_date', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'work_end_date', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'work_estimate', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'quote_expires_at', 'DATETIME').catch(() => {});
    await this.addMissingColumn('pre_orders', 'quoted_at', 'DATETIME').catch(() => {});
    await this.addMissingColumn('pre_orders', 'revision_count', 'INTEGER DEFAULT 0').catch(() => {});
    await this.addMissingColumn('pre_orders', 'max_revision', 'INTEGER DEFAULT 1').catch(() => {});
    await this.addMissingColumn('pre_orders', 'revision_note', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'cancel_reason', 'TEXT').catch(() => {});
    await this.addMissingColumn('pre_orders', 'completed_at', 'DATETIME').catch(() => {});
    await this.addMissingColumn('pre_orders', 'cancelled_at', 'DATETIME').catch(() => {});
  }

  async seedProducts() {
    const row = await this.rawGet('SELECT COUNT(*) AS count FROM products');
    if (row.count > 0) return;

    const products = [
      ['Contoh Produk Digital', 'Produk contoh. Upload produk asli lewat menu Admin > Tambah Produk Digital.', 10000, 999, 'Digital', 1, 'text', null, null, 'Ini contoh teks delivery. Ganti/tambah produk digital lewat admin.', 'Produk digital dikirim otomatis setelah pembayaran berhasil. Pastikan membaca deskripsi sebelum checkout. Produk digital yang sudah dikirim tidak dapat dibatalkan kecuali ada kesalahan dari admin.']
    ];

    for (const p of products) {
      await this.rawRun(
        `INSERT INTO products (name, description, price, stock, category, is_digital, delivery_type, digital_file_id, digital_file_name, delivery_text, terms_conditions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }
  }

  addUser(telegramId, userData = {}) {
    const { username, first_name, last_name } = userData;
    return this.run(
      `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)`,
      [telegramId, username || null, first_name || null, last_name || null]
    );
  }

  getUser(telegramId) {
    return this.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
  }

  getAllProducts(includeInactive = false) {
    if (includeInactive) return this.all('SELECT * FROM products ORDER BY id ASC');
    return this.all('SELECT * FROM products WHERE COALESCE(active, 1) = 1 ORDER BY id ASC');
  }

  getProduct(productId) {
    return this.get('SELECT * FROM products WHERE id = ?', [productId]);
  }

  async addToCart(telegramId, productId, quantity = 1) {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Produk tidak ditemukan');
    if (product.stock < quantity) throw new Error('Stok produk tidak cukup');

    const existing = await this.get('SELECT * FROM cart WHERE telegram_id = ? AND product_id = ?', [telegramId, productId]);
    if (existing) {
      if ((existing.quantity + quantity) > product.stock) throw new Error('Jumlah keranjang melebihi stok produk');
      return this.run('UPDATE cart SET quantity = quantity + ?, added_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, existing.id]);
    }
    return this.run('INSERT INTO cart (telegram_id, product_id, quantity) VALUES (?, ?, ?)', [telegramId, productId, quantity]);
  }

  getCart(telegramId) {
    return this.all(
      `SELECT c.*, p.name, p.description, p.price, p.stock, p.image_url, p.category, p.delivery_type, p.terms_conditions, (p.price * c.quantity) AS subtotal
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.telegram_id = ? ORDER BY c.added_at DESC`,
      [telegramId]
    );
  }

  removeFromCart(cartId, telegramId = null) {
    if (telegramId) return this.run('DELETE FROM cart WHERE id = ? AND telegram_id = ?', [cartId, telegramId]);
    return this.run('DELETE FROM cart WHERE id = ?', [cartId]);
  }

  clearCart(telegramId) {
    return this.run('DELETE FROM cart WHERE telegram_id = ?', [telegramId]);
  }

  createOrder(telegramId, totalPrice, shippingAddress = 'Alamat belum diisi') {
    const orderNumber = `ORD-${Date.now()}-${telegramId}`;
    return this.run(
      `INSERT INTO orders (telegram_id, order_number, total_price, shipping_address) VALUES (?, ?, ?, ?)`,
      [telegramId, orderNumber, totalPrice, shippingAddress]
    ).then(result => ({ id: result.id, orderNumber }));
  }

  addOrderItem(orderId, productId, quantity, price) {
    return this.run(
      `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`,
      [orderId, productId, quantity, price]
    );
  }

  async reduceStock(productId, quantity) {
    const product = await this.getProduct(productId);
    if (!product) throw new Error('Produk tidak ditemukan');
    if (product.stock < quantity) throw new Error(`Stok ${product.name} tidak cukup`);
    return this.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [quantity, productId, quantity]);
  }

  getOrders(telegramId) {
    return this.all('SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC', [telegramId]);
  }

  getAllOrders() {
    return this.all('SELECT * FROM orders ORDER BY created_at DESC');
  }

  getOrderById(orderId) {
    return this.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  }

  getOrderByNumber(orderNumber) {
    return this.get('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
  }

  getOrderItems(orderId) {
    return this.all(
      `SELECT oi.*, p.name, p.description, p.is_digital, p.delivery_type, p.digital_file_id, p.digital_file_name, p.delivery_text, p.terms_conditions
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [orderId]
    );
  }

  createPayment(orderId, amount, paymentMethod = 'manual', transactionId = null, token = null) {
    return this.run(
      `INSERT OR REPLACE INTO payments (order_id, amount, payment_method, transaction_id, token, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [orderId, amount, paymentMethod, transactionId || `MANUAL-${orderId}`, token]
    );
  }

  async updateOrderPaymentStatus(orderNumberOrId, paymentStatus) {
    const order = Number.isInteger(Number(orderNumberOrId))
      ? await this.getOrderById(Number(orderNumberOrId))
      : await this.getOrderByNumber(orderNumberOrId);
    if (!order) throw new Error('Order tidak ditemukan');

    const orderStatus = paymentStatus === 'paid' ? 'processing' : order.status;
    await this.run(
      `UPDATE orders SET payment_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [paymentStatus, orderStatus, order.id]
    );
    await this.run(
      `UPDATE payments SET status = ?, completed_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE order_id = ?`,
      [paymentStatus, paymentStatus, order.id]
    );
    return order;
  }

  async createShipping(orderId, data = {}) {
    return this.run(
      `INSERT OR REPLACE INTO shipping (order_id, courier, tracking_number, status, location, estimated_delivery, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [orderId, data.courier || 'Belum ditentukan', data.tracking_number || `TRK${orderId}${Date.now()}`,
       data.status || 'processing', data.location || 'Gudang', data.estimated_delivery || null]
    );
  }

  getShipping(orderId) {
    return this.get('SELECT * FROM shipping WHERE order_id = ?', [orderId]);
  }


  createProduct(data) {
    return this.run(
      `INSERT INTO products (name, description, price, stock, image_url, category, is_digital, delivery_type, digital_file_id, digital_file_name, delivery_text, terms_conditions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        Number(data.price || 0),
        Number(data.stock || 999),
        data.image_url || null,
        data.category || 'Digital',
        data.is_digital === false ? 0 : 1,
        data.delivery_type || 'file_text',
        data.digital_file_id || null,
        data.digital_file_name || null,
        data.delivery_text || null,
        data.terms_conditions || null
      ]
    );
  }

  updateProduct(productId, data) {
    return this.run(
      `UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price),
       stock = COALESCE(?, stock), category = COALESCE(?, category), delivery_type = COALESCE(?, delivery_type),
       digital_file_id = COALESCE(?, digital_file_id), digital_file_name = COALESCE(?, digital_file_name),
       delivery_text = COALESCE(?, delivery_text), terms_conditions = COALESCE(?, terms_conditions) WHERE id = ?`,
      [data.name ?? null, data.description ?? null, data.price ?? null, data.stock ?? null, data.category ?? null,
       data.delivery_type ?? null, data.digital_file_id ?? null, data.digital_file_name ?? null, data.delivery_text ?? null, data.terms_conditions ?? null, productId]
    );
  }

  deleteProduct(productId) {
    return this.run('DELETE FROM products WHERE id = ?', [productId]);
  }

  markOrderDelivered(orderId) {
    return this.run(
      `UPDATE orders SET digital_delivered = 1, delivered_at = CURRENT_TIMESTAMP, status = CASE WHEN status = 'processing' THEN 'completed' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [orderId]
    );
  }



  createQrisPendingOrder(data) {
    return this.run(
      `INSERT OR REPLACE INTO qris_pending_orders
       (unique_code, order_id, order_number, telegram_id, amount, original_amount, transaction_id, qr_url, qr_message_id, status, created_at_ms, expires_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.unique_code,
        data.order_id,
        data.order_number,
        data.telegram_id,
        data.amount,
        data.original_amount,
        data.transaction_id || null,
        data.qr_url || null,
        data.qr_message_id || null,
        data.status || 'pending',
        data.created_at_ms,
        data.expires_at_ms
      ]
    );
  }

  updateQrisMessageId(uniqueCode, messageId) {
    return this.run('UPDATE qris_pending_orders SET qr_message_id = ? WHERE unique_code = ?', [messageId, uniqueCode]);
  }

  getPendingQrisOrders() {
    return this.all("SELECT * FROM qris_pending_orders WHERE status = 'pending' ORDER BY created_at_ms ASC");
  }

  async markQrisPendingStatus(uniqueCode, status) {
    await this.run('UPDATE qris_pending_orders SET status = ? WHERE unique_code = ?', [status, uniqueCode]);
    if (status !== 'pending') {
      await this.run('DELETE FROM qris_pending_orders WHERE unique_code = ?', [uniqueCode]);
    }
  }



  setProductActive(productId, active) {
    return this.run('UPDATE products SET active = ? WHERE id = ?', [active ? 1 : 0, productId]);
  }

  async softDeleteProduct(productId) {
    return this.setProductActive(productId, false);
  }

  getOrderWithUser(orderNumber) {
    return this.get(
      `SELECT o.*, u.username, u.first_name, u.last_name
       FROM orders o LEFT JOIN users u ON u.telegram_id = o.telegram_id
       WHERE o.order_number = ?`,
      [orderNumber]
    );
  }

  async getOrderDetailByNumber(orderNumber) {
    const order = await this.getOrderWithUser(orderNumber);
    if (!order) return null;
    const items = await this.getOrderItems(order.id);
    const payment = await this.get('SELECT * FROM payments WHERE order_id = ?', [order.id]);
    return { order, items, payment };
  }

  async saveCoupon(code, type, value, usageLimit = 0) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) throw new Error('Kode kupon wajib diisi');
    return this.run(
      `INSERT INTO coupons (code, type, value, usage_limit, active)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(code) DO UPDATE SET type=excluded.type, value=excluded.value, usage_limit=excluded.usage_limit, active=1`,
      [normalized, type || 'percent', Number(value || 0), Number(usageLimit || 0)]
    );
  }

  deleteCoupon(code) {
    return this.run('UPDATE coupons SET active = 0 WHERE code = ?', [String(code || '').trim().toUpperCase()]);
  }

  getCoupon(code) {
    return this.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [String(code || '').trim().toUpperCase()]);
  }

  getCoupons() {
    return this.all('SELECT * FROM coupons ORDER BY created_at DESC');
  }

  async applyUserCoupon(telegramId, code) {
    const coupon = await this.getCoupon(code);
    if (!coupon) throw new Error('Kupon tidak ditemukan atau tidak aktif');
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) throw new Error('Limit kupon sudah habis');
    await this.run(
      `INSERT INTO user_coupons (telegram_id, coupon_code, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(telegram_id) DO UPDATE SET coupon_code=excluded.coupon_code, applied_at=CURRENT_TIMESTAMP`,
      [telegramId, coupon.code]
    );
    return coupon;
  }

  clearUserCoupon(telegramId) {
    return this.run('DELETE FROM user_coupons WHERE telegram_id = ?', [telegramId]);
  }

  async getUserCoupon(telegramId) {
    const row = await this.get('SELECT coupon_code FROM user_coupons WHERE telegram_id = ?', [telegramId]);
    if (!row) return null;
    return this.getCoupon(row.coupon_code);
  }

  calculateDiscount(total, coupon) {
    if (!coupon) return 0;
    let discount = 0;
    if (coupon.type === 'fixed') discount = Number(coupon.value || 0);
    else discount = Math.floor(Number(total || 0) * Number(coupon.value || 0) / 100);
    return Math.max(0, Math.min(Number(total || 0), discount));
  }

  async markCouponUsed(code) {
    if (!code) return;
    await this.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [String(code).toUpperCase()]);
  }

  async getSetting(key, fallback = null) {
    const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : fallback;
  }

  setSetting(key, value) {
    return this.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
      [key, String(value)]
    );
  }

  async isMaintenanceMode() {
    return (await this.getSetting('maintenance_mode', 'off')) === 'on';
  }

  logError(source, error) {
    return this.run(
      'INSERT INTO error_logs (source, message, stack) VALUES (?, ?, ?)',
      [source || 'unknown', error?.message || String(error), error?.stack || null]
    );
  }

  getRecentErrors(limit = 10) {
    return this.all('SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  async getSalesReport(period = 'today') {
    let where = "DATE(created_at) = DATE('now')";
    if (period === 'week') where = "created_at >= DATETIME('now', '-7 days')";
    if (period === 'month') where = "created_at >= DATETIME('now', '-30 days')";
    const totalOrders = await this.get(`SELECT COUNT(*) AS count FROM orders WHERE ${where}`);
    const paidOrders = await this.get(`SELECT COUNT(*) AS count FROM orders WHERE ${where} AND payment_status = 'paid'`);
    const pendingOrders = await this.get(`SELECT COUNT(*) AS count FROM orders WHERE ${where} AND payment_status NOT IN ('paid','expired','failed')`);
    const revenue = await this.get(`SELECT COALESCE(SUM(total_price),0) AS total FROM orders WHERE ${where} AND payment_status = 'paid'`);
    const topProducts = await this.all(
      `SELECT p.name, SUM(oi.quantity) AS sold, SUM(oi.price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE ${where} AND o.payment_status = 'paid'
       GROUP BY p.id ORDER BY sold DESC LIMIT 5`
    );
    return { period, totalOrders: totalOrders.count, paidOrders: paidOrders.count, pendingOrders: pendingOrders.count, revenue: revenue.total, topProducts };
  }


  async getDashboardStats() {
    const ordersToday = await this.get("SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = DATE('now')");
    const paidToday = await this.get("SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = DATE('now') AND payment_status = 'paid'");
    const pendingToday = await this.get("SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = DATE('now') AND payment_status NOT IN ('paid','expired','failed','refunded')");
    const revenueToday = await this.get("SELECT COALESCE(SUM(total_price),0) AS total FROM orders WHERE DATE(created_at) = DATE('now') AND payment_status = 'paid'");
    const productActive = await this.get('SELECT COUNT(*) AS count FROM products WHERE COALESCE(active,1)=1');
    const users = await this.get('SELECT COUNT(*) AS count FROM users');
    const lastBackup = await this.getSetting('last_backup_at', '-');
    return { ordersToday: ordersToday.count, paidToday: paidToday.count, pendingToday: pendingToday.count, revenueToday: revenueToday.total, productActive: productActive.count, users: users.count, lastBackup };
  }

  searchProducts(keyword, page = 1, pageSize = 8, category = null) {
    const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize || 8);
    const params = [];
    let where = 'WHERE COALESCE(active, 1) = 1';
    if (keyword) { where += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (category) { where += ' AND category = ?'; params.push(category); }
    return this.all(`SELECT * FROM products ${where} ORDER BY id ASC LIMIT ? OFFSET ?`, [...params, Number(pageSize || 8), offset]);
  }

  async countProducts(keyword = '', category = null) {
    const params = [];
    let where = 'WHERE COALESCE(active, 1) = 1';
    if (keyword) { where += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (category) { where += ' AND category = ?'; params.push(category); }
    const row = await this.get(`SELECT COUNT(*) AS count FROM products ${where}`, params);
    return row.count || 0;
  }

  async getCategories() {
    const rows = await this.all("SELECT category AS name, COUNT(*) AS total FROM products WHERE COALESCE(active,1)=1 AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY category ASC");
    return rows;
  }

  async saveCategory(name) {
    return this.run('INSERT OR IGNORE INTO categories (name, active) VALUES (?, 1)', [String(name || '').trim()]);
  }

  async saveRating(orderId, productId, telegramId, rating, comment = null) {
    return this.run(
      `INSERT INTO product_ratings (order_id, product_id, telegram_id, rating, comment) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(order_id, product_id, telegram_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=CURRENT_TIMESTAMP`,
      [orderId, productId, telegramId, Number(rating), comment]
    );
  }

  getProductRating(productId) {
    return this.get('SELECT COALESCE(AVG(rating),0) AS average, COUNT(*) AS count FROM product_ratings WHERE product_id = ?', [productId]);
  }

  logDelivery(orderId, telegramId, productId, deliveryType, status, message = null) {
    return this.run('INSERT INTO delivery_logs (order_id, telegram_id, product_id, delivery_type, status, message) VALUES (?, ?, ?, ?, ?, ?)', [orderId, telegramId, productId, deliveryType, status, message]);
  }

  getDeliveryLogs(orderId) {
    return this.all('SELECT * FROM delivery_logs WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
  }

  logAudit(adminId, action, target = null, details = null) {
    return this.run('INSERT INTO audit_logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)', [adminId || null, action, target, details]);
  }

  getAuditLogs(limit = 20) {
    return this.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [Number(limit || 20)]);
  }

  async refundOrder(orderNumber) {
    const order = await this.getOrderByNumber(orderNumber);
    if (!order) throw new Error('Order tidak ditemukan');
    await this.run("UPDATE orders SET payment_status='refunded', status='refunded', refunded_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?", [order.id]);
    await this.run("UPDATE payments SET status='refunded' WHERE order_id=?", [order.id]).catch(() => {});
    return order;
  }

  getPendingPaymentReminders() {
    const minutes = Number(process.env.PAYMENT_REMINDER_AFTER_MINUTES || 5);
    return this.all(
      `SELECT * FROM orders WHERE payment_status IN ('unpaid','pending') AND COALESCE(reminder_sent,0)=0 AND created_at <= DATETIME('now', '-' || ? || ' minutes') ORDER BY created_at ASC LIMIT 25`,
      [minutes]
    );
  }

  markReminderSent(orderId) {
    return this.run('UPDATE orders SET reminder_sent = 1 WHERE id = ?', [orderId]);
  }

  async exportRows(kind = 'orders') {
    const allowed = {
      orders: 'SELECT * FROM orders ORDER BY created_at DESC',
      products: 'SELECT * FROM products ORDER BY id ASC',
      users: 'SELECT * FROM users ORDER BY created_at DESC',
      payments: 'SELECT * FROM payments ORDER BY created_at DESC',
      coupons: 'SELECT * FROM coupons ORDER BY created_at DESC',
      ratings: 'SELECT * FROM product_ratings ORDER BY created_at DESC',
      delivery: 'SELECT * FROM delivery_logs ORDER BY created_at DESC',
      audit: 'SELECT * FROM audit_logs ORDER BY created_at DESC'
    };
    return this.all(allowed[kind] || allowed.orders);
  }


  createPreOrder(data) {
    const preOrderNumber = `PO-${Date.now()}-${data.telegram_id}`;
    return this.run(
      `INSERT INTO pre_orders (pre_order_number, telegram_id, request_type, request_text, request_file_id, request_file_name, request_caption, amount, status, max_revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [preOrderNumber, data.telegram_id, data.request_type, data.request_text || null, data.request_file_id || null, data.request_file_name || null, data.request_caption || null, Number(data.amount || 0), Number(process.env.PREORDER_MAX_REVISION || 1)]
    ).then((result) => ({ id: result.id, preOrderNumber }));
  }

  getPreOrderById(id) {
    return this.get('SELECT * FROM pre_orders WHERE id = ?', [id]);
  }

  getPreOrderByOrderId(orderId) {
    return this.get('SELECT * FROM pre_orders WHERE order_id = ?', [orderId]);
  }

  getPreOrderByReference(reference) {
    return this.get(
      `SELECT * FROM pre_orders WHERE pre_order_number = ? OR order_number = ? OR transaction_id = ? ORDER BY id DESC LIMIT 1`,
      [reference, reference, reference]
    );
  }

  getPreOrders(status = null, limit = 20) {
    if (status) return this.all('SELECT * FROM pre_orders WHERE status = ? ORDER BY created_at DESC LIMIT ?', [status, Number(limit || 20)]);
    return this.all('SELECT * FROM pre_orders ORDER BY created_at DESC LIMIT ?', [Number(limit || 20)]);
  }

  attachPreOrderPayment(preOrderId, data) {
    return this.run(
      `UPDATE pre_orders SET order_id = ?, order_number = ?, transaction_id = ?, status = 'waiting_payment' WHERE id = ?`,
      [data.order_id, data.order_number, data.transaction_id || null, preOrderId]
    );
  }

  markPreOrderPaid(orderId, transactionId = null) {
    return this.run(
      `UPDATE pre_orders SET status = 'process', paid_at = CURRENT_TIMESTAMP, processed_at = CURRENT_TIMESTAMP, transaction_id = COALESCE(?, transaction_id) WHERE order_id = ?`,
      [transactionId, orderId]
    );
  }

  markPreOrderDelivered(reference, adminNote = null) {
    return this.run(
      `UPDATE pre_orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, admin_note = COALESCE(?, admin_note) WHERE pre_order_number = ? OR order_number = ? OR transaction_id = ?`,
      [adminNote, reference, reference, reference]
    );
  }

  markPreOrderExpired(orderId) {
    return this.run(`UPDATE pre_orders SET status = 'expired' WHERE order_id = ? AND status = 'waiting_payment'`, [orderId]);
  }


  logPreOrder(preOrderId, actorType, actorId, action, details = '') {
    return this.run(
      `INSERT INTO pre_order_logs (pre_order_id, actor_type, actor_id, action, details) VALUES (?, ?, ?, ?, ?)`,
      [preOrderId, actorType, String(actorId || ''), action, details || '']
    );
  }

  getPreOrderLogs(preOrderId, limit = 30) {
    return this.all('SELECT * FROM pre_order_logs WHERE pre_order_id = ? ORDER BY created_at DESC LIMIT ?', [preOrderId, Number(limit || 30)]);
  }

  getPreOrdersByUser(telegramId, limit = 10) {
    return this.all('SELECT * FROM pre_orders WHERE telegram_id = ? ORDER BY created_at DESC LIMIT ?', [telegramId, Number(limit || 10)]);
  }

  quotePreOrder(reference, data) {
    const quoteHours = Number(process.env.PREORDER_QUOTE_EXPIRED_HOURS || 24);
    return this.run(
      `UPDATE pre_orders
       SET amount = ?, base_amount = ?, additional_fee = ?, work_start_date = ?, work_end_date = ?, work_estimate = ?, admin_note = ?, quote_expires_at = DATETIME('now', '+' || ? || ' hours'), status = 'quoted', quoted_at = CURRENT_TIMESTAMP
       WHERE (pre_order_number = ? OR order_number = ? OR transaction_id = ?) AND status IN ('submitted','quoted')`,
      [Number(data.amount || 0), Number(data.base_amount ?? data.amount ?? 0), Number(data.additional_fee || 0), data.work_start_date || null, data.work_end_date || null, data.work_estimate || null, data.admin_note || null, quoteHours, reference, reference, reference]
    );
  }

  editPreOrderQuote(reference, field, value) {
    const allowed = {
      harga: 'amount', amount: 'amount', base: 'base_amount', tambahan: 'additional_fee', fee: 'additional_fee',
      mulai: 'work_start_date', selesai: 'work_end_date', estimasi: 'work_estimate', catatan: 'admin_note', note: 'admin_note'
    };
    const column = allowed[field];
    if (!column) return Promise.resolve({ changes: 0 });
    const numeric = ['amount','base_amount','additional_fee'].includes(column);
    return this.run(
      `UPDATE pre_orders SET ${column} = ? WHERE (pre_order_number = ? OR order_number = ? OR transaction_id = ?) AND status IN ('submitted','quoted')`,
      [numeric ? Number(value || 0) : value, reference, reference, reference]
    );
  }

  cancelPreOrder(reference, reason = null, allowedStatuses = ['submitted','quoted','waiting_payment','process','revision_requested','revision_process']) {
    const placeholders = allowedStatuses.map(() => '?').join(',');
    return this.run(
      `UPDATE pre_orders SET status = 'cancelled', cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE (pre_order_number = ? OR order_number = ? OR transaction_id = ?) AND status IN (${placeholders})`,
      [reason || null, reference, reference, reference, ...allowedStatuses]
    );
  }

  completePreOrder(reference) {
    return this.run(
      `UPDATE pre_orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE (pre_order_number = ? OR order_number = ? OR transaction_id = ?) AND status IN ('delivered','revision_process')`,
      [reference, reference, reference]
    );
  }

  requestPreOrderRevision(reference, telegramId, note) {
    return this.run(
      `UPDATE pre_orders SET status = 'revision_requested', revision_count = COALESCE(revision_count,0) + 1, revision_note = ? WHERE (pre_order_number = ? OR order_number = ? OR transaction_id = ?) AND telegram_id = ? AND status = 'delivered' AND COALESCE(revision_count,0) < COALESCE(max_revision,1)`,
      [note || null, reference, reference, reference, telegramId]
    );
  }

  markPreOrderRevisionProcess(reference) {
    return this.run(
      `UPDATE pre_orders SET status = 'revision_process' WHERE pre_order_number = ? OR order_number = ? OR transaction_id = ?`,
      [reference, reference, reference]
    );
  }

  getExpiredPreOrderQuotes() {
    return this.all(`SELECT * FROM pre_orders WHERE status = 'quoted' AND quote_expires_at IS NOT NULL AND quote_expires_at <= DATETIME('now') LIMIT 25`);
  }

  expirePreOrderQuote(preOrderId) {
    return this.run(`UPDATE pre_orders SET status = 'expired' WHERE id = ? AND status = 'quoted'`, [preOrderId]);
  }



  async cleanupOldData(cfg = {}) {
    await this.ready;
    const result = {};
    const qrisCutoffMs = Date.now() - (Number(cfg.qrisDays || 7) * 24 * 60 * 60 * 1000);

    const qris = await this.run(
      `DELETE FROM qris_pending_orders
       WHERE status IN ('expired','paid','done','failed','cancelled')
       AND created_at_ms < ?`,
      [qrisCutoffMs]
    );
    result.qris = qris.changes || 0;

    const cart = await this.run(
      `DELETE FROM cart WHERE added_at < DATETIME('now', '-' || ? || ' days')`,
      [Number(cfg.cartDays || 14)]
    );
    result.cart = cart.changes || 0;

    const errorLogs = await this.run(
      `DELETE FROM error_logs WHERE created_at < DATETIME('now', '-' || ? || ' days')`,
      [Number(cfg.errorLogDays || 30)]
    );
    result.errorLogs = errorLogs.changes || 0;

    const auditLogs = await this.run(
      `DELETE FROM audit_logs WHERE created_at < DATETIME('now', '-' || ? || ' days')`,
      [Number(cfg.auditLogDays || 180)]
    );
    result.auditLogs = auditLogs.changes || 0;

    const deliveryLogs = await this.run(
      `DELETE FROM delivery_logs WHERE created_at < DATETIME('now', '-' || ? || ' days')`,
      [Number(cfg.deliveryLogDays || 180)]
    );
    result.deliveryLogs = deliveryLogs.changes || 0;

    const notifications = await this.run(
      `DELETE FROM notifications WHERE created_at < DATETIME('now', '-' || ? || ' days')`,
      [Number(cfg.notificationDays || 30)]
    );
    result.notifications = notifications.changes || 0;

    const preOrderLogs = await this.run(
      `DELETE FROM pre_order_logs
       WHERE created_at < DATETIME('now', '-' || ? || ' days')
       AND pre_order_id NOT IN (
         SELECT id FROM pre_orders WHERE status IN ('submitted','quoted','waiting_payment','process','revision_requested','revision_process')
       )`,
      [Number(cfg.auditLogDays || 180)]
    );
    result.preOrderLogs = preOrderLogs.changes || 0;

    return result;
  }


  getBroadcastUsers() {
    return this.all('SELECT telegram_id, username, first_name, last_name FROM users ORDER BY created_at ASC');
  }

  getDatabasePath() {
    return DB_PATH;
  }

  async close() {
    await this.ready;
    if (!this.db) return;
    await new Promise((resolve, reject) => {
      this.db.close((err) => (err ? reject(err) : resolve()));
    });
    this.db = null;
  }

  async reconnect() {
    if (this.db) {
      await this.close();
    }
    this.ready = this.init();
    await this.ready;
  }

  async getAnalytics() {
    const totalOrders = await this.get('SELECT COUNT(*) AS count FROM orders');
    const totalRevenue = await this.get("SELECT COALESCE(SUM(total_price), 0) AS total FROM orders WHERE payment_status = 'paid'");
    const pendingOrders = await this.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'");
    const completedOrders = await this.get("SELECT COUNT(*) AS count FROM orders WHERE status IN ('completed','delivered')");
    const totalCustomers = await this.get('SELECT COUNT(*) AS count FROM users');
    const newCustomersToday = await this.get("SELECT COUNT(*) AS count FROM users WHERE DATE(created_at) = DATE('now')");
    const successfulPayments = await this.get("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid'");
    const pendingPayments = await this.get("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'pending'");
    const totalProducts = await this.get('SELECT COUNT(*) AS count FROM products');
    const topProduct = await this.get(
      `SELECT p.name, SUM(oi.quantity) AS sold FROM order_items oi
       JOIN products p ON p.id = oi.product_id GROUP BY p.id ORDER BY sold DESC LIMIT 1`
    );

    return {
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total,
      pendingOrders: pendingOrders.count,
      completedOrders: completedOrders.count,
      totalCustomers: totalCustomers.count,
      newCustomersToday: newCustomersToday.count,
      successfulPayments: successfulPayments.total,
      pendingPayments: pendingPayments.total,
      totalProducts: totalProducts.count,
      topProduct
    };
  }
}

module.exports = new Database();
