const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../database/ecommerce.db');

class Database {
  constructor() {
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          this.createTables();
          resolve();
        }
      });
    });
  }

  createTables() {
    const tables = [
      // Users table
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

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Shopping Cart table
      `CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`,

      // Orders table
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Order Items table
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`,

      // Shipping/Tracking table
      `CREATE TABLE IF NOT EXISTS shipping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        courier TEXT,
        tracking_number TEXT UNIQUE,
        status TEXT DEFAULT 'processing',
        location TEXT,
        estimated_delivery DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`,

      // Payment Transactions table
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        transaction_id TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`
    ];

    tables.forEach(table => {
      this.db.run(table, (err) => {
        if (err) console.error('Error creating table:', err);
      });
    });
  }

  // User methods
  addUser(telegramId, userData) {
    return new Promise((resolve, reject) => {
      const { username, first_name, last_name } = userData;
      this.db.run(
        `INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name) 
         VALUES (?, ?, ?, ?)`,
        [telegramId, username, first_name, last_name],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getUser(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Product methods
  getAllProducts() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM products', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  getProduct(productId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Cart methods
  addToCart(telegramId, productId, quantity) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO cart (telegram_id, product_id, quantity) VALUES (?, ?, ?)`,
        [telegramId, productId, quantity],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getCart(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT c.*, p.name, p.price, p.image_url FROM cart c 
         JOIN products p ON c.product_id = p.id 
         WHERE c.telegram_id = ?`,
        [telegramId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  removeFromCart(cartId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cart WHERE id = ?', [cartId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  clearCart(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cart WHERE telegram_id = ?', [telegramId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Order methods
  createOrder(telegramId, totalPrice, shippingAddress) {
    return new Promise((resolve, reject) => {
      const orderNumber = 'ORD-' + Date.now();
      this.db.run(
        `INSERT INTO orders (telegram_id, order_number, total_price, shipping_address) 
         VALUES (?, ?, ?, ?)`,
        [telegramId, orderNumber, totalPrice, shippingAddress],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, orderNumber });
        }
      );
    });
  }

  getOrders(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC`,
        [telegramId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // More methods will be added...
}

const database = new Database();
database.init().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = database;
