import sqlite3
import json
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

class Analytics:
    def __init__(self, db_path='database/ecommerce.db'):
        self.db_path = db_path
        self.conn = None
        self.connect()
    
    def connect(self):
        """Connect to SQLite database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            print("✅ Connected to database")
        except sqlite3.Error as e:
            print(f"❌ Database connection error: {e}")
    
    def get_sales_report(self, start_date=None, end_date=None):
        """Generate sales report"""
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        query = """
            SELECT 
                DATE(o.created_at) as date,
                COUNT(o.id) as total_orders,
                SUM(o.total_price) as total_revenue,
                AVG(o.total_price) as avg_order_value
            FROM orders o
            WHERE DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY DATE(o.created_at)
            ORDER BY date DESC
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query, (start_date, end_date))
        results = cursor.fetchall()
        
        report = []
        for row in results:
            report.append({
                'date': row[0],
                'total_orders': row[1],
                'total_revenue': row[2],
                'avg_order_value': row[3]
            })
        
        return report
    
    def get_product_stats(self):
        """Get product sales statistics"""
        query = """
            SELECT 
                p.id,
                p.name,
                COUNT(oi.id) as total_sold,
                SUM(oi.price * oi.quantity) as revenue,
                p.stock
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            GROUP BY p.id
            ORDER BY total_sold DESC
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        
        stats = []
        for row in results:
            stats.append({
                'product_id': row[0],
                'product_name': row[1],
                'total_sold': row[2] or 0,
                'revenue': row[3] or 0,
                'stock': row[4]
            })
        
        return stats
    
    def get_customer_stats(self):
        """Get customer statistics"""
        query = """
            SELECT 
                COUNT(DISTINCT u.id) as total_customers,
                COUNT(CASE WHEN DATE(u.created_at) = DATE('now') THEN 1 END) as new_today,
                COUNT(CASE WHEN DATE(u.created_at) >= DATE('now', '-30 days') THEN 1 END) as new_30days
            FROM users u
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        result = cursor.fetchone()
        
        return {
            'total_customers': result[0],
            'new_today': result[1],
            'new_30_days': result[2]
        }
    
    def get_payment_stats(self):
        """Get payment statistics"""
        query = """
            SELECT 
                status,
                COUNT(id) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM payments
            GROUP BY status
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        
        stats = {}
        for row in results:
            stats[row[0]] = {
                'count': row[1],
                'total_amount': row[2]
            }
        
        return stats
    
    def get_order_status_distribution(self):
        """Get order status distribution"""
        query = """
            SELECT 
                status,
                COUNT(id) as count,
                ROUND(COUNT(id) * 100.0 / (SELECT COUNT(id) FROM orders), 2) as percentage
            FROM orders
            GROUP BY status
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        
        distribution = {}
        for row in results:
            distribution[row[0]] = {
                'count': row[1],
                'percentage': row[2]
            }
        
        return distribution
    
    def generate_json_report(self, output_path='reports/analytics_report.json'):
        """Generate JSON report"""
        Path('reports').mkdir(exist_ok=True)
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'sales_report': self.get_sales_report(),
            'product_stats': self.get_product_stats(),
            'customer_stats': self.get_customer_stats(),
            'payment_stats': self.get_payment_stats(),
            'order_distribution': self.get_order_status_distribution()
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"✅ Report generated: {output_path}")
        return report
    
    def generate_csv_report(self, output_path='reports/sales_report.csv'):
        """Generate CSV report"""
        Path('reports').mkdir(exist_ok=True)
        
        sales_data = self.get_sales_report()
        df = pd.DataFrame(sales_data)
        
        df.to_csv(output_path, index=False)
        print(f"✅ CSV report generated: {output_path}")
    
    def generate_visualization(self):
        """Generate visualization charts"""
        Path('reports').mkdir(exist_ok=True)
        
        # Sales trend
        sales_data = self.get_sales_report()
        df = pd.DataFrame(sales_data)
        
        if df.empty:
            df = pd.DataFrame([{
                'date': datetime.now().strftime('%Y-%m-%d'),
                'total_revenue': 0,
                'total_orders': 0,
                'avg_order_value': 0
            }])

        plt.figure(figsize=(12, 6))
        plt.subplot(1, 2, 1)
        plt.plot(df['date'], df['total_revenue'], marker='o', label='Revenue')
        plt.xlabel('Date')
        plt.ylabel('Revenue (Rp)')
        plt.title('Daily Revenue Trend')
        plt.xticks(rotation=45)
        plt.grid(True)
        
        # Product sales
        plt.subplot(1, 2, 2)
        product_stats = self.get_product_stats()[:5]
        if not product_stats:
            products = ['No product data']
            sales = [0]
        else:
            products = [p['product_name'] for p in product_stats]
            sales = [p['total_sold'] for p in product_stats]
        
        plt.bar(products, sales)
        plt.xlabel('Product')
        plt.ylabel('Units Sold')
        plt.title('Top 5 Products')
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        plt.savefig('reports/analytics_chart.png', dpi=300, bbox_inches='tight')
        print("✅ Charts generated: reports/analytics_chart.png")
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("✅ Database connection closed")

if __name__ == '__main__':
    analytics = Analytics()
    
    # Generate all reports
    analytics.generate_json_report()
    analytics.generate_csv_report()
    analytics.generate_visualization()
    
    analytics.close()
