# Auto-Cleanup Data Lama

Fitur ini membersihkan data sementara/lama secara otomatis agar database dan folder project tetap ringan.

## Yang dibersihkan

- QRIS pending yang sudah expired/paid/failed dan sudah melewati batas hari.
- Cart user yang terlalu lama tidak dipakai.
- Error log lama.
- Audit log lama.
- Delivery log lama.
- Notification log lama.
- Pre order log lama untuk pre order yang sudah tidak aktif.
- File report lokal lama di folder `reports/`.
- Backup lokal lama di folder `backups/` sesuai `BACKUP_KEEP_LOCAL`.
- File log lokal lama di folder `logs/`.

## Yang tidak dihapus

- Produk.
- User terdaftar.
- Order utama.
- Payment utama.
- Pre order aktif.
- Produk digital/file_id.

## Menu admin

Buka:

```text
/admin
→ 🧹 Auto-Cleanup Data Lama
```

Admin bisa melihat konfigurasi dan menjalankan cleanup manual.

Command cepat:

```text
/cleanup
```

## Setting .env

```env
CLEANUP_AUTO_ENABLED=true
CLEANUP_INTERVAL_MS=21600000
CLEANUP_QRIS_DAYS=7
CLEANUP_CART_DAYS=14
CLEANUP_ERROR_LOG_DAYS=30
CLEANUP_AUDIT_LOG_DAYS=180
CLEANUP_DELIVERY_LOG_DAYS=180
CLEANUP_NOTIFICATION_DAYS=30
CLEANUP_REPORT_DAYS=30
CLEANUP_NOTIFY_ADMIN=false
```

`CLEANUP_INTERVAL_MS=21600000` berarti cleanup berjalan setiap 6 jam.
