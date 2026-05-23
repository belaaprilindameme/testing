import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import json

class Notifications:
    def __init__(self, db_path='database/ecommerce.db'):
        self.db_path = db_path
        self.conn = None
        self.connect()
    
    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
    
    def get_pending_notifications(self):
        """Get orders that need notification"""
        query = """
            SELECT o.*, u.telegram_id 
            FROM orders o
            JOIN users u ON o.telegram_id = u.telegram_id
            WHERE o.status IN ('shipped', 'delivered')
            AND o.updated_at > datetime('now', '-1 hour')
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        return cursor.fetchall()
    
    def send_order_confirmation(self, telegram_id, order_data):
        """Send order confirmation notification"""
        message = f"""
✅ PESANAN DIKONFIRMASI

Nomor Pesanan: {order_data['order_number']}
Total: Rp{order_data['total_price']:,.0f}
Status: {order_data['status']}

Terima kasih atas pembelian Anda!
        """
        return message
    
    def send_payment_confirmation(self, telegram_id, payment_data):
        """Send payment confirmation"""
        message = f"""
💳 PEMBAYARAN BERHASIL

Nomor Pesanan: {payment_data['order_id']}
Jumlah: Rp{payment_data['amount']:,.0f}
Status: DIBAYAR ✅

Pesanan Anda sedang diproses...
        """
        return message
    
    def send_shipping_update(self, telegram_id, shipping_data):
        """Send shipping status update"""
        message = f"""
📦 UPDATE PENGIRIMAN

Nomor Pesanan: {shipping_data['order_number']}
Status: {shipping_data['status']}
Kurir: {shipping_data['courier']}
No Resi: {shipping_data['tracking_number']}
Lokasi: {shipping_data['location']}

Perkiraan Tiba: {shipping_data['estimated_delivery']}
        """
        return message
    
    def send_delivery_confirmation(self, telegram_id, order_data):
        """Send delivery confirmation"""
        message = f"""
✅ PESANAN DITERIMA

Nomor Pesanan: {order_data['order_number']}
Status: SELESAI ✅

Terima kasih telah berbelanja dengan kami!
Berikan rating untuk pesanan ini: /rate_{order_data['id']}
        """
        return message
    
    def send_promotional_message(self, telegram_id, promo_data):
        """Send promotional message"""
        message = f"""
🎉 PROMO SPESIAL UNTUK ANDA!

{promo_data['title']}

{promo_data['description']}

Kode Promo: {promo_data['code']}
Diskon: {promo_data['discount']}%
Berlaku hingga: {promo_data['valid_until']}

Belanja Sekarang: /products
        """
        return message
    
    def send_abandoned_cart_reminder(self, telegram_id, cart_items):
        """Send abandoned cart reminder"""
        items_text = "\n".join([f"- {item['name']}: Rp{item['price']:,.0f}" for item in cart_items])
        
        message = f"""
🛒 ADA BARANG YANG DITINGGALKAN!

Item di keranjang Anda:
{items_text}

Total: Rp{sum(item['price'] * item['quantity'] for item in cart_items):,.0f}

Selesaikan pembelian sekarang: /cart
        """
        return message
    
    def send_restock_notification(self, product_name, stock):
        """Send restock notification to interested customers"""
        message = f"""
📦 PRODUK KEMBALI TERSEDIA!

{product_name} sudah kembali tersedia!
Stok Terbaru: {stock} unit

Pesan sekarang sebelum kehabisan: /products
        """
        return message
    
    def send_low_stock_alert(self, product_name, stock):
        """Admin alert for low stock"""
        message = f"""
⚠️ PERINGATAN STOK RENDAH

Produk: {product_name}
Stok Tersisa: {stock} unit

Segera lakukan restocking!
        """
        return message
    
    def get_notification_history(self, telegram_id, limit=10):
        """Get notification history for user"""
        query = """
            SELECT * FROM notifications
            WHERE telegram_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query, (telegram_id, limit))
        return cursor.fetchall()
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

if __name__ == '__main__':
    notifications = Notifications()
    print("✅ Notifications module initialized")
    notifications.close()
