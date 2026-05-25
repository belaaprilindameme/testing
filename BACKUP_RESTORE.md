# Backup & Restore Bot

Bot sudah dilengkapi backup otomatis dan restore lewat menu `/admin`.

## Backup otomatis

Backup otomatis berjalan setiap jam `00:00` zona waktu `Asia/Jakarta` dan dikirim ke Telegram admin berdasarkan `ADMIN_ID`.

Konfigurasi di `.env`:

```env
BACKUP_AUTO_ENABLED=true
BACKUP_TIME=00:00
BACKUP_TIMEZONE=Asia/Jakarta
BACKUP_KEEP_LOCAL=14
BACKUP_INCLUDE_ENV=true
```

## Isi file backup

File backup berformat `.tar.gz` dan berisi:

- database SQLite: user, produk, order, transaksi, payment, cart, shipping, dan notifikasi;
- data produk digital berupa Telegram `file_id`, sehingga file produk bisa dikirim ulang oleh bot;
- `.env` jika `BACKUP_INCLUDE_ENV=true`;
- folder `reports` dan `logs` jika ada;
- manifest backup.

⚠️ Jika `.env` ikut dibackup, file backup berisi data sensitif seperti token bot, API key, admin ID, nomor GoPay, dan konfigurasi lain. Jangan bagikan file backup ke orang lain.

## Backup manual

1. Buka `/admin`.
2. Pilih `💾 Backup & Restore`.
3. Pilih `📤 Buat Backup Sekarang`.
4. Bot akan mengirim file backup ke chat admin.

## Restore backup

1. Jalankan bot di VPS baru atau VPS lama.
2. Pastikan `ADMIN_ID` di `.env` sementara sudah benar supaya admin bisa masuk `/admin`.
3. Buka `/admin`.
4. Pilih `💾 Backup & Restore`.
5. Pilih `📥 Restore dari File Backup`.
6. Upload file backup `.tar.gz` dari bot.
7. Bot akan memproses restore otomatis.

Sebelum restore, bot membuat backup pengaman otomatis dengan nama `backup-before-restore-...tar.gz`.

## Setelah restore

Jika backup berisi `.env`, restart bot agar token/API key terbaru aktif:

```bash
pm2 restart ecommerce-bot
```

atau jika menjalankan manual:

```bash
npm start
```
