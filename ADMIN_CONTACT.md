# Auto Setting Hubungi Admin

Bot bisa mengambil username Telegram admin dari `ADMIN_ID` secara otomatis memakai Telegram Bot API `getChat`.

## Syarat

1. `ADMIN_ID` di `.env` sudah benar.
2. Akun admin sudah pernah chat atau klik `/start` ke bot.
3. Jika admin ingin link publik `https://t.me/username`, akun admin harus punya username Telegram publik.

## Cara pakai

Buka bot lalu kirim:

```text
/admin
```

Klik:

```text
☎️ Auto Setting Hubungi Admin
```

Bot akan otomatis mengisi/memperbarui di `.env`:

```env
ADMIN_DISPLAY_NAME=Nama Admin
ADMIN_USERNAME=usernameadmin
ADMIN_CONTACT_URL=https://t.me/usernameadmin
```

Kalau admin tidak punya username publik, bot memakai fallback:

```env
ADMIN_CONTACT_URL=tg://user?id=ADMIN_ID
```

Catatan: fallback `tg://user?id=...` biasanya bekerja di aplikasi Telegram, tetapi lebih aman memakai username publik agar semua user mudah menghubungi admin.
