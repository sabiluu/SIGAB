# SIGAB — Sistem Informasi Siaga Banjir Kecamatan Baureno

## Menjalankan

```bash
# Backend (FastAPI)
pip install -r requirements.txt
python seed_db.py            # opsional: isi data desa, posko, dan arsip banjir
python -m uvicorn app.main:app --port 8000

# Frontend (React + Vite)
npm install
npm run dev                  # http://localhost:5173
```

## Akun Uji Coba (tanpa perlu mendaftar)

Akun ini dibuat otomatis saat server backend pertama kali berjalan.
Di halaman login juga ada tombol **Akun Uji Coba** yang mengisi form otomatis.

| Peran | Email | Kata sandi |
|-------|-------|-----------|
| Petugas BPBD (admin) | `admin@bpbd.go.id` | `admin123` |
| Warga | `warga@baureno.id` | `warga123` |
| Warga 1 (Gajah) | `warga1@sigab.demo` | `demo1234` |
| Warga 2 (Kalisari) | `warga2@sigab.demo` | `demo1234` |
| Warga 3 (Sumuragung) | `warga3@sigab.demo` | `demo1234` |
| Warga 4 (Kedungrejo) | `warga4@sigab.demo` | `demo1234` |
| Warga 5 (Gunungsari) | `warga5@sigab.demo` | `demo1234` |

Penguji juga bebas **mendaftar akun sendiri** sebagai warga: cukup nama, email, dan kata sandi (min. 6 karakter).
NIK opsional, tetapi jika diisi harus 16 digit angka. Tidak ada verifikasi email/OTP agar akses darurat tidak terhambat.
Pendaftaran akun petugas tidak tersedia lewat jalur publik.

> Untuk produksi sungguhan, matikan akun demo dengan environment variable `SEED_DEMO_ACCOUNTS=false`.
