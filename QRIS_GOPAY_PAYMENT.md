# Pembayaran QRIS / GoPay

Bot ini memakai alur pembayaran QRIS/GoPay dengan verifikasi admin.

## Alur User

1. User memilih produk.
2. User membaca detail produk, deskripsi, dan S&K.
3. User checkout.
4. Bot membuat nomor pesanan.
5. Bot menampilkan instruksi pembayaran QRIS/GoPay.
6. User bayar sesuai total.
7. User mengirim bukti pembayaran ke admin.
8. Admin mengetik `paid NOMOR_ORDER`.
9. Bot otomatis mengirim produk digital ke user.

## Konfigurasi .env

```env
QRIS_FILE_ID=
QRIS_IMAGE_URL=
GOPAY_NUMBER=08xxxxxxxxxx
GOPAY_NAME=Nama Pemilik GoPay
PAYMENT_NOTE=Setelah transfer, kirim bukti pembayaran ke admin.
```

Gunakan `QRIS_FILE_ID` jika QRIS pernah dikirim ke bot Telegram dan kamu sudah mengambil `file_id`-nya. Jika belum, bisa pakai `QRIS_IMAGE_URL` berisi link gambar QRIS publik.

## Command Admin

Konfirmasi pembayaran berhasil:

```text
paid ORD-xxxxxxxxx-telegramid
```

Tolak pembayaran:

```text
reject ORD-xxxxxxxxx-telegramid
```

Setelah `paid`, produk digital dikirim otomatis sesuai tipe produk:

- `file`
- `text`
- `file_text`

## Update: Auto QRIS GOPAY

Versi terbaru memakai auto-generate QRIS seperti contoh BotZIVPN. Setting lama `QRIS_FILE_ID`, `QRIS_IMAGE_URL`, `GOPAY_NUMBER`, dan `GOPAY_NAME` tidak wajib lagi.

Isi `.env`:

```env
PAYMENT=GOPAY
GOPAY_KEY=isi_token_gopay_kamu
```

Bot akan generate QRIS saat checkout dan mengecek status otomatis.
