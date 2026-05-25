# PREORDER GUIDE

## Alur User

1. User klik **Pre Order / Request Produk**.
2. User membaca S&K dan klik **Saya Paham, Lanjut Request**.
3. User mengirim request berupa text, foto, video, atau file/dokumen dengan caption jelas.
4. Bot mengirim request ke admin. Belum ada QRIS pada tahap ini.
5. Admin membaca request lalu menentukan harga, tanggal pengerjaan, estimasi, dan catatan.
6. Bot mengirim invoice/penawaran ke user.
7. User klik **Setuju & Bayar**.
8. Bot membuat QRIS dinamis sebagai foto + caption dalam satu pesan.
9. Setelah pembayaran sukses, status menjadi **process** dan admin menerima detail transaksi.
10. Admin mengirim hasil produk dengan `sendpo ID`.
11. User bisa menerima hasil, meminta revisi, atau menandai selesai.

## Status Pre Order

- `submitted`: request masuk, menunggu admin set harga.
- `quoted`: admin sudah mengirim penawaran, menunggu user setuju bayar.
- `waiting_payment`: QRIS sudah dibuat, menunggu pembayaran.
- `process`: pembayaran sukses, admin sedang mengerjakan.
- `delivered`: hasil sudah dikirim ke user.
- `revision_requested`: user meminta revisi.
- `revision_process`: admin sedang memproses revisi.
- `completed`: user menerima hasil dan menandai selesai.
- `cancelled`: pre order dibatalkan.
- `expired`: quote/payment expired.

## Command Admin

### Set harga dan estimasi

```text
setpo PO-xxxx 75000 2026-05-25 2026-05-27 2 hari | Catatan admin
```

Dengan biaya tambahan:

```text
setpo PO-xxxx 50000+25000 2026-05-25 2026-05-27 2 hari | Catatan admin
```

### Edit penawaran sebelum user bayar

```text
editpo PO-xxxx harga 85000
editpo PO-xxxx mulai 2026-05-25
editpo PO-xxxx selesai 2026-05-28
editpo PO-xxxx estimasi 3 hari
editpo PO-xxxx catatan Catatan baru
```

### Cek detail

```text
cekpo PO-xxxx
invoicepo PO-xxxx
```

### Kirim hasil produk

```text
sendpo PO-xxxx
```

Setelah itu kirim text, foto, video, atau file/dokumen hasil produk.

### Batalkan pre order

```text
cancelpo PO-xxxx alasan pembatalan
```

Alasan wajib diisi agar tidak salah batal.

## Command User

### Lihat status pre order

```text
/preordersaya
```

### Ajukan revisi

```text
revision PO-xxxx alasan revisi
```

### Tandai selesai

```text
completepo PO-xxxx
```

## Setting `.env`

```env
PREORDER_MIN_TEXT_LENGTH=20
PREORDER_MAX_REVISION=1
PREORDER_QUOTE_EXPIRED_HOURS=24
PREORDER_QUOTE_EXPIRE_CHECK_MS=300000
```

## Catatan Penting

- Harga hanya bisa ditentukan admin.
- User tidak bisa mengubah harga.
- QRIS baru dibuat setelah user menyetujui penawaran.
- Request user dikirim ke admin sebelum pembayaran, agar admin bisa menentukan harga sesuai tingkat kesulitan.
- Setelah payment sukses, status otomatis menjadi `process`.
