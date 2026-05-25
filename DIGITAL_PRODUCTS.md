# Produk Digital

Bot ini mendukung produk digital yang dikirim otomatis ke pembeli setelah pembayaran QRIS/GoPay diverifikasi admin.

## Alur tambah produk dari menu admin

Buka bot sebagai admin:

```text
/admin
```

Pilih:

```text
➕ Tambah Produk Digital
```

Bot akan menampilkan 3 pilihan agar admin tidak salah format:

```text
📄 Text Saja
📁 File Saja
📁➕📄 File + Text
```

Setelah admin memilih salah satu jenis produk, bot akan mengirim contoh format yang sesuai.

## 1. Produk Text Saja

Pilih tombol:

```text
📄 Text Saja
```

Lalu kirim pesan biasa ke bot dengan format:

```text
Nama: Produk Text Premium
Harga: 25000
Stok: 999
Kategori: Digital
Deskripsi: Jelaskan isi produk, manfaat, cara pakai, dan siapa yang cocok membeli produk ini
S&K: Produk digital tidak bisa refund setelah text dikirim. Pastikan pembeli membaca deskripsi sebelum checkout.
Text: Ini isi produk text yang akan dikirim otomatis ke pembeli setelah pembayaran diverifikasi
```

Produk jenis ini tidak membutuhkan upload file.

## 2. Produk File Saja

Pilih tombol:

```text
📁 File Saja
```

Lalu upload file sebagai dokumen/file Telegram, misalnya `.zip`, `.txt`, `.pdf`, `.json`, dan isi caption:

```text
Nama: File Script Bot
Harga: 75000
Stok: 999
Kategori: Script
Deskripsi: Jelaskan isi file, format file, cara pakai, dan ketentuan penggunaan
S&K: Produk digital tidak bisa refund setelah file dikirim. Pastikan pembeli membaca deskripsi sebelum checkout.
```

Produk jenis ini hanya mengirim file ke user setelah pembayaran diverifikasi.

## 3. Produk File + Text

Pilih tombol:

```text
📁➕📄 File + Text
```

Lalu upload file sebagai dokumen/file Telegram dan isi caption:

```text
Nama: Paket Premium Bot
Harga: 100000
Stok: 999
Kategori: Script
Deskripsi: Jelaskan isi produk, format file/text, cara pakai, dan target pengguna
S&K: Produk digital tidak bisa refund setelah file/text dikirim. Pastikan pembeli membaca deskripsi sebelum checkout.
Text: Terima kasih sudah membeli. Berikut panduan singkat/catatan tambahan untuk produk ini
```

Produk jenis ini mengirim file dan text ke user setelah pembayaran diverifikasi.

## Deskripsi Produk dan S&K Sebelum Checkout

Setiap produk menampilkan halaman detail sebelum user bisa menambahkan ke keranjang. Halaman detail berisi:

- Nama produk
- Harga
- Stok
- Kategori
- Jenis produk: text, file, atau file + text
- Deskripsi produk
- S&K produk

Saat checkout, bot juga menampilkan `REVIEW SEBELUM CHECKOUT` agar user membaca ulang detail produk sebelum membuat pesanan.

## Pembayaran QRIS/GoPay

Setelah user membuat pesanan, bot menampilkan instruksi pembayaran QRIS/GoPay. Setelah user mengirim bukti pembayaran ke admin, admin mengetik:

```text
paid NOMOR_ORDER
```

Contoh:

```text
paid ORD-1712345678901-123456789
```

Bot akan menandai pembayaran berhasil dan otomatis mengirim produk digital ke user.

Jika pembayaran tidak valid, admin bisa mengetik:

```text
reject NOMOR_ORDER
```

Order yang sudah terkirim tidak akan dikirim ulang karena bot menyimpan status `digital_delivered`.
