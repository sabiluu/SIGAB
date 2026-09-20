# Timeline Backend SiagaBencana

Dokumen kerja backend/API untuk proyek SiagaBencana.

## Target Utama

- Wilayah: 23 desa Kecamatan Baureno.
- Tim: 1 developer backend/API.
- Demo UTS minggu 8: minimal satu alur backend berjalan dari login sampai tiket SOS masuk ke admin.
- Target selesai minggu 14: API, database, engine probabilitas, WebSocket, keamanan, dan pengujian terintegrasi.
- Ambang Mode Evakuasi Darurat: probabilitas `>= 75%` atau manual override admin.
- Stack: FastAPI, SQLAlchemy, MySQL 8, Pydantic, JWT, bcrypt, WebSocket.

## Aturan Kontrak API

- Semua endpoint memakai prefix `/api`.
- Format error menggunakan `{"detail": "Pesan error"}`.
- Response list menggunakan bentuk `{ "data": [], "total": 0 }` jika membutuhkan pagination.
- Waktu menggunakan ISO 8601.
- Koordinat menggunakan `latitude` dan `longitude` dalam angka desimal.
- Role yang digunakan: `warga` dan `admin`.
- Jangan hardcode secret, password, URL API, atau kredensial database.

## Minggu 5 - Fondasi Backend dan Kontrak API

### Pekerjaan

- Selaraskan model SQLAlchemy, schema Pydantic, dan dokumentasi API.
- Pastikan database MySQL `siagabencana` dapat dibuat dari file SQL/seed.
- Tetapkan dan seed tepat 23 desa.
- Tambahkan endpoint health check: `GET /api/health`.
- Implementasikan dependency database session.
- Implementasikan konfigurasi environment dari `.env`.
- Buat dependency `get_current_user`.
- Buat role guard `require_admin` dan `require_warga`.
- Samakan nama field antara model dan schema. Jangan mengandalkan `from_attributes` untuk nama field yang berbeda.

### Endpoint minimum

```text
GET /api/health
```

### Output untuk laporan

- ERD terbaru.
- Daftar endpoint dan contoh response.
- Bukti database berhasil dibuat.
- Bukti 23 desa tersedia di database.
- Daftar keputusan: threshold darurat `>= 75%` dan role akses.

### Selesai jika

- FastAPI bisa berjalan di port 8000.
- Swagger tersedia di `/docs`.
- Endpoint health mengembalikan status sukses.
- Database bersih dapat di-seed ulang tanpa error.

## Minggu 6 - Auth, JWT, dan Role Access

### Pekerjaan

- Implementasikan register warga.
- Implementasikan login warga dan admin.
- Hash password dengan bcrypt.
- Buat JWT access token dengan expiration.
- Implementasikan endpoint profil pengguna.
- Validasi email, password, role, dan desa.
- Tolak akses warga ke endpoint admin.
- Tambahkan response error konsisten untuk kredensial salah dan token invalid.

### Endpoint

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Contoh response login

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "nama": "Ahmad Fauzi",
    "email": "ahmad@example.com",
    "role": "warga",
    "desa_id": 1
  }
}
```

### Selesai jika

- User dapat register dan login.
- Password tidak disimpan dalam bentuk plaintext.
- Token expired ditolak.
- User warga tidak dapat membuka endpoint admin.
- Endpoint bisa diuji melalui Swagger.

## Minggu 7 - Desa, Shelter, dan SOS Dasar

### Pekerjaan

- Implementasikan API daftar desa dan detail desa.
- Implementasikan daftar shelter dan detail shelter.
- Implementasikan kapasitas terisi dan kapasitas tersisa.
- Implementasikan pembuatan tiket SOS.
- Validasi jumlah anggota keluarga, koordinat, kategori rentan, dan deskripsi.
- Implementasikan daftar tiket untuk admin.
- Implementasikan daftar tiket milik warga.
- Implementasikan perubahan status tiket.

### Endpoint

```text
GET   /api/villages
GET   /api/villages/{id}
GET   /api/shelters
GET   /api/shelters/{id}
PATCH /api/shelters/{id}
POST  /api/sos
GET   /api/sos
GET   /api/sos/my
PATCH /api/sos/{id}/status
```

### Status tiket minimum

```text
baru
terverifikasi
tim_meluncur
selesai
```

### Selesai jika

Alur ini dapat berjalan pada database:

```text
Login warga -> ambil desa -> ambil shelter -> kirim SOS -> admin melihat tiket
```

## Minggu 8 - Demo UTS 50%

### Fokus

Stabilkan endpoint yang dipakai untuk demo. Jangan menambah fitur besar yang belum dibutuhkan demo.

### Alur demo wajib

```text
Login warga
-> GET profil dan desa
-> GET probabilitas tersimpan/simulasi
-> GET shelter
-> POST tiket SOS
-> Login admin
-> GET daftar tiket SOS
-> PATCH status tiket
```

### Pekerjaan backend

- Siapkan seed data demo yang konsisten.
- Pastikan akun demo warga dan admin tersedia melalui seed lokal.
- Pastikan data probabilitas demo memiliki status Aman/Waspada/Awas.
- Pastikan tiket SOS memiliki nomor unik, misalnya `EVAC-BRN-20260920-001`.
- Tambahkan logging error endpoint.
- Pastikan API tidak mengembalikan stack trace ke client.

### Yang boleh belum selesai

- Integrasi otomatis Open-Meteo.
- Perhitungan probabilitas final.
- OSRM.
- WebSocket.
- Push notification.

### Selesai jika

Demo dapat dijalankan dari database bersih menggunakan dua akun berbeda: warga dan admin.

## Minggu 9 - Integrasi API Debit dan Cuaca

### Pekerjaan

- Buat client Open-Meteo Flood API.
- Buat client Open-Meteo Weather API.
- Pisahkan konfigurasi URL API dari kode.
- Tambahkan timeout request.
- Tambahkan retry terbatas.
- Validasi struktur response eksternal.
- Simpan waktu pengambilan data dan status request.
- Simpan data terakhir yang valid sebagai fallback.
- Simpan data ke tabel log debit dan cuaca.

### Data yang perlu disimpan

```text
RiverDischargeLog
- village_id atau area_id
- discharge_value
- measured_at
- source
- raw_payload bila diperlukan

WeatherDataLog
- village_id atau area_id
- precipitation
- measured_at
- source
- raw_payload bila diperlukan
```

### Catatan sumber data

Open-Meteo adalah layanan pihak ketiga/agregator. Jangan menulis bahwa data berasal langsung dari pemerintah jika endpoint yang dipakai bukan endpoint resmi pemerintah. Konfirmasi kepada dosen apakah Open-Meteo diterima atau perlu data BMKG/BPBD langsung.

### Selesai jika

- Payload API dapat disimpan ke database.
- API tetap mengembalikan data terakhir ketika provider sedang gagal.
- Timeout dan error provider tercatat di log.

## Minggu 10 - Engine Probabilitas Banjir

### Formula

```text
P_banjir =
  (0.35 x S_debit) +
  (0.30 x S_hujan) +
  (0.20 x S_elevasi) +
  (0.15 x S_histori)
```

Semua skor komponen harus dinormalisasi ke rentang 0-100 sebelum dikalikan bobot.

### Klasifikasi

```text
0-25   Aman
26-50  Waspada
51-74  Siaga
>=75   Awas / Banjir Parah
```

### Pekerjaan

- Implementasikan fungsi normalisasi setiap parameter.
- Implementasikan formula berbobot.
- Simpan hasil ke `FloodProbabilityLog`.
- Update probabilitas/status terkini pada desa.
- Buat endpoint current dan history.
- Buat scheduler/background job sekitar 60 detik.
- Aktifkan `EmergencyStatus` ketika probabilitas >=75%.
- Sediakan manual override admin.
- Dokumentasikan sumber nilai elevasi dan histori.
- Sediakan mode simulasi admin yang diberi label jelas.

### Endpoint

```text
GET  /api/flood/current
GET  /api/flood/village/{id}
GET  /api/flood/history/{id}
PATCH /api/flood/emergency
```

### Kasus uji minimum

- Nilai 25 menghasilkan Aman.
- Nilai 50 menghasilkan Waspada.
- Nilai 74 menghasilkan Siaga.
- Nilai 75 menghasilkan Awas.
- Provider eksternal gagal tetapi nilai terakhir tetap tersedia.

## Minggu 11 - Shelter Aktif, GPS, dan OSRM

### Pekerjaan

- Filter shelter yang masih memiliki kapasitas.
- Validasi koordinat asal dan tujuan.
- Integrasikan OSRM untuk jarak, durasi, dan geometry GeoJSON.
- Tambahkan timeout dan fallback routing.
- Jangan menjamin rute OSRM bebas genangan tanpa data penutupan jalan.
- Hindari URL HTTP jika frontend/deployment memakai HTTPS.
- Batasi endpoint rute pada mode darurat atau emergency override.

### Endpoint tambahan

```text
GET /api/shelters/available
GET /api/evacuation/route?from_lat=...&from_lng=...&shelter_id=...
```

### Selesai jika

- Frontend menerima daftar shelter berkapasitas.
- Frontend menerima distance, duration, dan geometry rute.
- Kegagalan OSRM menghasilkan response fallback yang jelas.

## Minggu 12 - WebSocket dan Notifikasi Real-Time

### Pekerjaan

- Implementasikan endpoint WebSocket sesuai kontrak.
- Buat connection manager.
- Kelompokkan koneksi berdasarkan role dan desa bila diperlukan.
- Kirim perubahan status risiko.
- Kirim alarm darurat.
- Kirim tiket SOS baru ke admin.
- Kirim perubahan status tiket ke warga terkait.
- Batasi event berdasarkan otorisasi.
- Bersihkan koneksi yang terputus.

### Endpoint dan event

```text
WS /ws/notifications

ALARM_ON
ALARM_OFF
RISK_UPDATED
SOS_CREATED
SOS_STATUS_UPDATED
```

### Catatan

WebSocket hanya bekerja ketika browser terhubung. WebSocket bukan push notification ketika aplikasi tertutup. Push/PWA dapat dijadikan enhancement jika waktu mencukupi.

## Minggu 13 - Dashboard Admin dan Keamanan Operasional

### Pekerjaan

- Pastikan semua endpoint admin memakai role guard.
- Tambahkan filter dan pagination tiket SOS.
- Tambahkan detail lokasi GPS, jumlah jiwa, kelompok rentan, dan foto.
- Tambahkan endpoint disposisi tim.
- Tambahkan emergency override admin.
- Tambahkan update kapasitas shelter.
- Tambahkan audit log untuk perubahan status penting.
- Validasi ukuran dan tipe file upload.
- Periksa CORS.
- Hapus default secret dari environment production.
- Tambahkan rate limit/logging minimal bila memungkinkan.

### Selesai jika

- Admin dapat mengelola tiket dari baru sampai selesai.
- Warga hanya dapat melihat tiket miliknya sendiri.
- Setiap perubahan status penting dapat dilacak.

## Minggu 14 - Finalisasi, Testing, dan Dokumentasi

### Pengujian wajib

- Register akun warga.
- Login warga dan admin.
- Akses role yang ditolak.
- Pengambilan 23 desa.
- Pengambilan data shelter.
- Pengambilan data cuaca/debit.
- Kalkulasi probabilitas.
- Ambang darurat 75%.
- Aktivasi manual emergency mode.
- Pengajuan SOS dengan GPS.
- Perubahan status tiket oleh admin.
- WebSocket saat alarm dan tiket baru.
- Provider API eksternal mati.
- Database kosong atau seed ulang.

### Target

- Minimal 85% skenario black-box lulus.
- Tidak ada endpoint utama yang mengembalikan 500 karena input invalid.
- API docs `/docs` sesuai implementasi terakhir.
- Instalasi dari README dapat diikuti anggota lain.
- File `.env.example` lengkap tanpa credential asli.

## File Backend Utama

```text
app/main.py
app/core/config.py
app/core/database.py
app/core/security.py
app/models/
app/schemas/
app/routers/auth.py
app/routers/villages.py
app/routers/shelters.py
app/routers/sos.py
app/routers/flood.py
app/routers/websocket.py
app/services/external_api.py
app/services/flood_engine.py
app/utils/helpers.py
siagabencana.sql
requirements.txt
```

## Checklist Integrasi Dengan Frontend

- [ ] Kirim daftar endpoint final ke developer frontend.
- [ ] Kirim contoh response JSON untuk setiap endpoint.
- [ ] Beri tahu nama field final dan tipe datanya.
- [ ] Beri tahu status tiket dan status risiko yang valid.
- [ ] Sediakan akun demo warga dan admin.
- [ ] Sediakan seed database yang dapat diulang.
- [ ] Beri tahu URL backend lokal, misalnya `http://localhost:8000`.
- [ ] Pastikan Swagger dapat dibuka di `http://localhost:8000/docs`.
- [ ] Informasikan jika ada perubahan kontrak API sebelum frontend menggunakannya.

## Timeline Sinkron Frontend dan Backend

Bagian ini menjadi acuan bersama. Setiap minggu harus menghasilkan satu output yang dapat diuji oleh kedua bagian.

| Minggu | Frontend | Backend/API | Hasil Integrasi |
|---|---|---|---|
| **5** | Finalisasi struktur halaman, routing awal, token warna/font dari Figma, dan komponen dasar auth. | Finalisasi kontrak API, konfigurasi database, seed 23 desa, health check, serta struktur auth. | Frontend dan backend menyepakati nama field, format error, role, dan endpoint awal. |
| **6** | Implementasi halaman login/register warga dan petugas, role selector, protected route, loading/error state. | Implementasi register, login, JWT, bcrypt, `/me`, token expiry, dan role guard. | User warga dan admin dapat login ke halaman masing-masing. |
| **7** | Implementasi halaman dashboard dasar, daftar desa, daftar shelter, form SOS, dan status tiket. | Implementasi endpoint desa, shelter, kapasitas posko, create/list SOS, dan update status tiket. | Alur `login -> desa -> shelter -> kirim SOS -> admin melihat tiket` berjalan. |
| **8** | Polish tampilan demo UTS, risk card, tabel tiket, responsive mobile warga dan desktop admin. | Stabilkan endpoint demo, seed akun demo, probabilitas fixture, nomor tiket, dan status SOS. | Demo 50% berjalan dengan database bersih menggunakan akun warga dan admin. |
| **9** | Tampilkan debit, curah hujan, waktu update, sumber data, stale data, dan error provider. | Integrasi Open-Meteo Flood/Weather, timeout, retry, validasi payload, fallback, dan penyimpanan log. | Frontend menampilkan data eksternal yang benar-benar berasal dari API backend. |
| **10** | Implementasi gauge 0-100%, warna Aman/Waspada/Siaga/Awas, banner darurat, dan label simulasi. | Implementasi normalisasi, formula 35/30/20/15, `FloodProbabilityLog`, scheduler 60 detik, dan emergency status. | Perubahan probabilitas backend otomatis mengubah status dan tampilan frontend. |
| **11** | Integrasi Leaflet/OSM, marker desa/shelter, izin GPS, kapasitas posko, dan panel rute. | Endpoint shelter tersedia, integrasi OSRM, validasi koordinat, fallback routing, dan batasan rute. | User dapat melihat shelter dan rute ketika mode darurat aktif. |
| **12** | WebSocket reconnect, indikator koneksi, update risiko/tiket tanpa refresh, alarm/banner. | WebSocket manager, event `ALARM_ON`, `ALARM_OFF`, `RISK_UPDATED`, `SOS_CREATED`, dan `SOS_STATUS_UPDATED`. | Perubahan risiko atau tiket muncul real-time pada layar yang sesuai role. |
| **13** | Dashboard komando admin, filter SOS, detail GPS/kelompok rentan, disposisi, kapasitas shelter, audit status. | Role guard menyeluruh, emergency override, filter/pagination, audit log, validasi upload, dan logging. | Admin dapat menangani tiket dari masuk sampai selesai secara terkontrol. |
| **14** | Responsive final, accessibility, error/loading state, konfirmasi SOS, production build, dan video demo. | Security review, API docs, backup/seed, external API failure test, WebSocket cleanup, dan deployment docs. | Minimal 85% skenario black-box lulus dan demo end-to-end siap presentasi. |

## Ritme Kerja Mingguan

## Pembagian Tugas Terpisah per Minggu

### Minggu 5

**Frontend**

- Implementasikan struktur landing page dan halaman auth sesuai Figma.
- Siapkan routing/hash awal untuk login, register, warga, dan petugas.
- Siapkan token warna, font, tombol, input, card, dan layout responsive.
- Siapkan `apiFetch`, state loading, error, dan empty state.

**Backend**

- Finalisasi kontrak endpoint dan response JSON.
- Siapkan koneksi MySQL, session database, `.env`, health check, dan seed 23 desa.
- Selaraskan model SQLAlchemy dengan schema Pydantic.
- Siapkan dependency auth dan role guard.

### Minggu 6

**Frontend**

- Hubungkan form login/register warga dan petugas ke API.
- Simpan token dan tampilkan halaman sesuai role.
- Buat protected route dan halaman akses ditolak.

**Backend**

- Selesaikan register, login, dan `/me`.
- Implementasikan bcrypt, JWT expiry, dan validasi input.
- Pastikan warga tidak dapat mengakses endpoint admin.

### Minggu 7

**Frontend**

- Tampilkan 23 desa dari API.
- Tampilkan shelter, kapasitas, form SOS, lokasi GPS, dan status tiket.

**Backend**

- Implementasikan endpoint villages, shelters, dan SOS.
- Validasi koordinat, jumlah jiwa, kelompok rentan, dan status tiket.
- Siapkan seed tiket demo.

### Minggu 8

**Frontend**

- Polish tampilan demo UTS warga dan admin.
- Tampilkan probabilitas fixture, shelter, tabel tiket, dan status SOS.

**Backend**

- Stabilkan endpoint demo dan akun demo.
- Pastikan alur login, desa, shelter, POST SOS, daftar tiket, dan update status berjalan.
- Siapkan database bersih untuk demo.

### Minggu 9

**Frontend**

- Tampilkan debit sungai, curah hujan, sumber data, waktu update, dan pesan error API.

**Backend**

- Integrasikan Open-Meteo Flood dan Weather API.
- Tambahkan timeout, retry, validasi payload, fallback, dan penyimpanan log.

### Minggu 10

**Frontend**

- Buat gauge probabilitas dan warna status Aman, Waspada, Siaga, dan Awas.
- Tampilkan banner darurat ketika nilai mencapai `>= 75%`.

**Backend**

- Implementasikan normalisasi dan formula bobot 35/30/20/15.
- Simpan log probabilitas, update status desa, scheduler 60 detik, dan emergency override.

### Minggu 11

**Frontend**

- Integrasikan Leaflet/OSM, marker desa, marker shelter, izin GPS, dan panel rute.
- Kunci fitur rute/SOS pada kondisi non-darurat.

**Backend**

- Sediakan shelter yang masih memiliki kapasitas.
- Integrasikan OSRM, validasi koordinat, dan fallback jika routing gagal.

### Minggu 12

**Frontend**

- Tambahkan koneksi WebSocket, reconnect, indikator koneksi, alarm, dan update tanpa refresh.

**Backend**

- Implementasikan WebSocket manager dan event real-time.
- Kirim event alarm, perubahan risiko, tiket baru, dan perubahan status tiket sesuai role.

### Minggu 13

**Frontend**

- Selesaikan dashboard komando admin, filter SOS, detail GPS, disposisi, dan kapasitas shelter.

**Backend**

- Selesaikan role guard, emergency override, pagination, audit log, validasi upload, dan logging.

### Minggu 14

**Frontend**

- Uji responsive, accessibility, loading/error state, konfirmasi SOS, production build, dan video demo.

**Backend**

- Jalankan security review, uji API eksternal gagal, uji WebSocket, backup/seed, Swagger, dan dokumentasi deployment.
- Jalankan seluruh skenario black-box dan perbaiki blocker.

### Awal Minggu

- Frontend dan backend menyepakati endpoint yang dikerjakan.
- Backend mengirim schema request/response sebelum frontend mulai menghubungkan UI.
- Keduanya menyepakati acceptance criteria dan data demo.

### Tengah Minggu

- Backend menyediakan endpoint di Swagger.
- Frontend menghubungkan endpoint ke halaman terkait.
- Setiap perubahan kontrak API harus diberitahukan sebelum kode frontend diselesaikan.

### Akhir Minggu

- Jalankan demo singkat berdasarkan hasil integrasi minggu tersebut.
- Catat endpoint yang sudah selesai dan yang masih mock/simulasi.
- Simpan screenshot atau video untuk laporan dosen.
- Catat blocker dan target perbaikannya untuk minggu berikutnya.

## Pembagian Dokumen Laporan Mingguan

Setiap laporan dosen sebaiknya memuat:

1. Target minggu berjalan.
2. Pekerjaan frontend.
3. Pekerjaan backend/API.
4. Hasil integrasi yang dapat didemokan.
5. Screenshot UI atau Swagger.
6. Endpoint yang selesai.
7. Kendala teknis dan solusi sementara.
8. Target minggu berikutnya.
