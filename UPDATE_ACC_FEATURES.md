# Update Fitur ACC

Fitur yang ditambahkan sesuai ACC user, kecuali anti-spam checkout:

1. Edit / hapus / aktif-nonaktif produk dari menu admin dan command admin.
2. Daftar produk admin dengan tombol detail produk.
3. Proteksi restore backup dengan konfirmasi ganda `RESTORE SAYA SETUJU`.
4. Backup ke banyak admin memakai `ADMIN_IDS`.
5. QRIS expired otomatis: caption QRIS diedit jadi expired atau bisa dihapus dengan `QRIS_EXPIRED_ACTION=delete`.
6. Status order lebih jelas untuk user dan admin.
7. Notifikasi admin saat order baru.
8. Notifikasi admin saat pembayaran sukses.
9. Command `resend ORD-xxxx` untuk kirim ulang produk digital.
10. Command `cek ORD-xxxx` untuk cek detail order.
11. Kupon / diskon: `coupon`, `delcoupon`, user pakai `voucher KODE`.
12. Laporan penjualan dari `/admin`: hari ini, 7 hari, 30 hari.
13. Maintenance mode: tombol admin atau command `maintenance_on` / `maintenance_off`.
15. Error log ke admin melalui `bot.catch` dan menu log error.

Tidak diterapkan:
14. Anti-spam checkout, sesuai permintaan user.
