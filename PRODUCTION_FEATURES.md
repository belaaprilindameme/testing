# Production Features Update

Fitur yang ditambahkan pada versi ini:

1. PM2 auto-restart via `ecosystem.config.js` dan installer.
2. Menu pengaturan bot dari `/admin`.
3. Command setting payment: `setgopaykey`, `setpaymenturl`, `setqrisexpired`.
4. Dashboard ringkas admin.
5. Export laporan CSV/JSON dari `/admin`.
6. Kategori produk.
7. Search produk dengan `/search kata_kunci`.
8. Pagination katalog produk.
9. Rating/testimoni produk dengan format `rating ORD-xxx PRODUCT_ID 5 komentar`.
10. Delivery log produk digital.
11. Reminder pending payment.
12. Refund/manual adjustment dengan `refund ORD-xxx`.
13. Audit log admin.
14. Health check endpoint `/health`.
15. Maintenance mode tetap tersedia.

Catatan: Security hardening/enkripsi backup tidak ditambahkan sesuai instruksi.
