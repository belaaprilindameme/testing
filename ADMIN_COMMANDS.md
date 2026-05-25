# Command Admin Tambahan

Semua command di bawah hanya bisa dipakai oleh ADMIN_ID / ADMIN_IDS.

## Produk

```text
editprod ID harga 50000
editprod ID stok 999
editprod ID nama Nama Produk Baru
editprod ID kategori Digital
editprod ID deskripsi Isi deskripsi baru
editprod ID snk Isi S&K baru
editprod ID text Isi delivery text baru
editprod ID tipe file_text
hapusprod ID
aktifprod ID
nonaktifprod ID
```

Catatan: `hapusprod` tidak menghapus transaksi lama. Produk hanya dinonaktifkan supaya data order lama tetap aman.

## Order

```text
cek ORD-xxxx
resend ORD-xxxx
paid ORD-xxxx
reject ORD-xxxx
```

## Kupon

```text
coupon KODE percent 10 100
coupon KODE fixed 5000 50
delcoupon KODE
```

Format: `coupon KODE tipe nilai limit`.
Limit boleh dikosongkan atau `0` untuk unlimited.

User memakai kupon dengan:

```text
voucher KODE
/voucher KODE
```

## Maintenance

```text
maintenance_on
maintenance_off
```

Saat maintenance ON, user biasa akan mendapat pesan maintenance. Admin tetap bisa memakai bot.

## Restore Backup

Menu restore sekarang memakai konfirmasi ganda:

```text
/admin → Backup & Restore → Restore dari File Backup
RESTORE SAYA SETUJU
upload file .tar.gz
```


## Broadcast

```text
/broadcast Isi pesan broadcast
/admin → 📣 Broadcast User
```

Mendukung text, foto, dan video dengan preview + konfirmasi.
