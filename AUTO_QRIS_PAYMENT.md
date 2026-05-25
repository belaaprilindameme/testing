# Payment QRIS Otomatis GOPAY

Payment sekarang mengikuti flow seperti contoh BotZIVPN:

1. User checkout.
2. Bot request QRIS ke endpoint GOPAY.
3. Bot mengirim detail pembayaran + link/gambar QRIS.
4. Bot mengecek status pembayaran otomatis setiap beberapa detik.
5. Jika status `settlement`, `paid`, atau `success`, order otomatis menjadi PAID.
6. Produk digital otomatis dikirim ke user.

## ENV wajib

```env
PAYMENT=GOPAY
GOPAY_KEY=isi_token_gopay_kamu
GOPAY_QRIS_GENERATE_URL=https://v1-gateway.autogopay.site/qris/generate
GOPAY_QRIS_STATUS_URL=https://v1-gateway.autogopay.site/qris/status
QRIS_EXPIRED_MINUTES=10
QRIS_CHECK_INTERVAL_MS=5000
```

## Catatan

- Tidak perlu lagi kirim QRIS statis di `.env`.
- Tidak perlu verifikasi manual, kecuali jika provider status sedang error.
- Command admin `paid NOMOR_ORDER` tetap tersedia sebagai backup manual.
- File backup berisi database order/payment termasuk transaksi QRIS pending.
