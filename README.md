# 🌊 SIGAB (Siaga Bencana Baureno)
**Sistem Informasi Peringatan Dini dan Manajemen Evakuasi Banjir Berbasis Web di Kecamatan Baureno, Kabupaten Bojonegoro**

![React](https://img.shields.io/badge/Frontend-React_19_%2B_Vite_8-009aa6?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.115-059669?style=flat-square&logo=fastapi)
![Leaflet](https://img.shields.io/badge/WebGIS-Leaflet_%2B_OSRM-2563eb?style=flat-square&logo=leaflet)
![SQLite](https://img.shields.io/badge/Database-SQLite_%2B_SQLAlchemy_2.0-0f172a?style=flat-square&logo=sqlite)
![WebSocket](https://img.shields.io/badge/Realtime-WebSocket_%2B_APScheduler-d97706?style=flat-square)

**SIGAB (Siaga Bencana Baureno)** adalah platform web kesiapsiagaan dan tanggap darurat banjir yang mengintegrasikan data hidrometeorologi *real-time* (debit Sungai Bengawan Solo dan curah hujan) untuk menghitung probabilitas risiko banjir (0–100%) di **25 desa Kecamatan Baureno**. Sistem ini menghubungkan masyarakat dengan petugas **Pusdalops BPBD** melalui peringatan dini bertingkat, navigasi rute evakuasi dinamis menuju posko pengungsian, serta kanal pelaporan darurat (**SOS**) berbasis penguncian GPS otomatis.

---

## ✨ Fitur Utama

### 1. Portal Warga (Desktop & Mobile)
- **Indikator Probabilitas Banjir Real-Time (0–100%):** Menampilkan persentase potensi banjir desa beserta status siaga (*Aman*, *Waspada*, *Siaga*, *Awas*), curah hujan terkini, dan debit Sungai Bengawan Solo yang diperbarui otomatis setiap 30 menit.
- **WebGIS Peta Risiko 25 Desa:** Visualisasi poligon batas administrasi 25 desa di Kecamatan Baureno secara interaktif menggunakan Leaflet dengan *canvas rendering* ringan.
- **Navigasi Rute Evakuasi & Posko Bersyarat:** Kalkulasi rute terpendek menuju posko pengungsian terdekat menggunakan **OSRM (Open Source Routing Machine)** (*fallback* Haversine) beserta informasi sisa kapasitas posko secara *real-time*. Fitur navigasi evakuasi dan SOS aktif otomatis ketika risiko mencapai status kritis (**Level Awas**) atau saat **Mode Simulasi** dijalankan.
- **Pelaporan Darurat (SOS) Satu Ketuk:** Mengunci koordinat GPS perangkat warga secara otomatis (HTML5 Geolocation API), mencatat jumlah jiwa dan kelompok rentan (*lansia, balita, ibu hamil, disabilitas*), mendukung unggah foto kondisi banjir langsung dari kamera/galeri, serta menampilkan pelacakan progres tim penyelamat secara *real-time*.
- **Pusat Notifikasi & Mode Simulasi Banjir:** Siaran peringatan dini tertarget per desa melalui WebSocket serta simulasi interaktif kenaikan level banjir bertahap untuk edukasi kesiapsiagaan warga.

### 2. Dashboard Komando Pusdalops BPBD (Admin — Desktop & Mobile)
- **Dashboard & Radar Peta Wilayah:** Ringkasan metrik kecamatan, pemantauan spasial 25 desa, pemantauan titik SOS warga pada peta, serta kontrol aktivasi/deaktivasi status darurat.
- **Manajemen & Triase Tiket SOS:** Daftar antrian tiket SOS warga yang diurutkan otomatis berdasarkan **Skor Prioritas Triase** (memperhitungkan keberadaan kelompok rentan dan jumlah jiwa), dilengkapi aksi cepat pembaruan status penyelamatan (*Menunggu → Terverifikasi → Tim Meluncur → Tim Tiba → Selesai*).
- **Manajemen Kapasitas Posko Pengungsian:** Pemantauan dan pembaruan jumlah pengungsi terisi, fasilitas posko, serta indikator ketersediaan (*Tersedia*, *Hampir Penuh*, *Penuh*) secara *real-time*.

---

## 🧠 Metodologi & Formula Probabilitas Banjir

Probabilitas risiko banjir tiap desa dihitung menggunakan metode **Simple Additive Weighting (SAW)** melalui agregasi empat faktor risiko utama:

$$P_{\text{banjir}} = w_1 S_{\text{debit}} + w_2 S_{\text{hujan}} + w_3 S_{\text{elevasi}} + w_4 S_{\text{histori}}$$

| Faktor Risiko | Bobot Bawaan | Sumber Data / Parameter |
| :--- | :---: | :--- |
| **Debit Sungai ($S_{\text{debit}}$)** | `0,35` (35%) | Open-Meteo Flood API (GloFAS) terhadap ambang debit kritis $Q_{\text{kritis}} = 1.500\text{ m}^3/\text{detik}$ |
| **Curah Hujan ($S_{\text{hujan}}$)** | `0,30` (30%) | Open-Meteo Weather API (kombinasi presipitasi per jam saat ini dan akumulasi 6 jam terakhir) |
| **Elevasi Topografi ($S_{\text{elevasi}}$)** | `0,20` (20%) | Normalisasi terbalik indeks ketinggian rata-rata desa (7–40 mdpl) di dataran aluvial Baureno |
| **Riwayat Banjir ($S_{\text{histori}}$)** | `0,15` (15%) | Indeks frekuensi dan dampak banjir historis masing-masing desa (skala 0–100) |

### Klasifikasi Level Risiko
| Rentang Skor | Level Risiko | Aksi Otomatis Sistem |
| :---: | :---: | :--- |
| **0 – 24,99%** | **Aman (Rendah)** | Pemantauan rutin hidrometeorologi |
| **25 – 49,99%** | **Waspada (Sedang)** | Penyiaran notifikasi kewaspadaan dini |
| **50 – 74,99%** | **Siaga (Tinggi)** | Penyiaran notifikasi peringatan siaga |
| **75 – 100%** | **Awas (Kritis)** | Notifikasi darurat, aktivasi otomatis mode evakuasi, rute posko & tombol SOS |

---

## 🛠️ Teknologi yang Digunakan

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, React-Leaflet, Leaflet.js, CSS3 (Responsive Desktop & Dedicated Mobile UI) |
| **Backend** | Python, FastAPI 0.115, Uvicorn (ASGI), APScheduler (Cron Job 30 menit), WebSocket |
| **Database & Keamanan** | SQLite, SQLAlchemy 2.0 ORM, JWT (HS256), Bcrypt Password Hashing, Role-Based Access Control (RBAC) |
| **Layanan Eksternal** | Open-Meteo Weather API, Open-Meteo Flood API (GloFAS), OSRM Routing API, OpenStreetMap |

---

## 📁 Struktur Direktori

```text
SIGAB/
├── app/                        # Backend FastAPI
│   ├── api/                    # Endpoint REST API & WebSocket (auth, flood, sos, shelters, simulation)
│   ├── core/                   # Konfigurasi database, keamanan JWT, dan APScheduler (interval 30 menit)
│   ├── models/                 # Skema tabel SQLAlchemy ORM
│   ├── schemas/                # Validasi payload Pydantic
│   ├── services/               # Flood Engine (SAW), External API client, WebSocket Manager, Notifier
│   └── main.py                 # Entrypoint aplikasi FastAPI
├── src/                        # Frontend React + Vite
│   ├── components/             # Komponen UI (RiskMap, WargaBeranda, WargaSOS, AdminLayout, Mobile Portals)
│   ├── data/                   # Data GeoJSON poligon 25 desa Kecamatan Baureno
│   ├── hooks/                  # Custom hooks (useDashboardRealtime, useGeolocation, useIsMobile)
│   ├── pages/                  # Halaman AuthPage, RoleHome, SOSManager, PoskoManager, RadarPeta
│   ├── services/               # Klien HTTP API (dengan fast-fail circuit breaker) & WebSocket client
│   └── styles/                 # Stylesheet modular (landing, warga-portal, role-home, admin-custom, mobile)
├── seed_db.py                  # Skrip inisialisasi data 25 desa, posko pengungsian, dan akun demo
├── requirements.txt            # Dependensi Python backend
└── package.json                # Dependensi Node.js frontend
```

---

## 🚀 Cara Menjalankan Proyek Secara Lokal

### 1. Menjalankan Backend (FastAPI)
Pastikan Python 3.10+ telah terpasang:

```bash
# 1. Pasang seluruh dependensi backend
pip install -r requirements.txt

# 2. (Opsional) Inisialisasi data awal 25 desa, posko evakuasi, dan arsip banjir
python seed_db.py

# 3. Jalankan server FastAPI pada port 8000
python -m uvicorn app.main:app --reload --port 8000
```
Dokumentasi Swagger API dapat diakses di `http://localhost:8000/docs`.

### 2. Menjalankan Frontend (React + Vite)
Buka terminal baru pada direktori proyek:

```bash
# 1. Pasang dependensi frontend
npm install

# 2. Jalankan server pengembangan Vite
npm run dev
```
Buka `http://localhost:5173` di peramban Anda.

---

## 🔑 Akun Uji Coba (Demo)

Akun berikut dibuat secara otomatis saat server backend pertama kali dijalankan. Pada halaman login juga tersedia tombol **Akun Uji Coba** untuk mengisi kredensial secara otomatis:

| Peran | Email | Kata Sandi |
| :--- | :--- | :--- |
| **Petugas BPBD (Admin)** | `admin@bpbd.go.id` | `admin123` |
| **Warga Utama (Baureno)** | `warga@baureno.id` | `warga123` |
| **Warga 1 (Desa Gajah)** | `warga1@sigab.demo` | `demo1234` |
| **Warga 2 (Desa Kalisari)** | `warga2@sigab.demo` | `demo1234` |
| **Warga 3 (Desa Sumuragung)** | `warga3@sigab.demo` | `demo1234` |
| **Warga 4 (Desa Kedungrejo)** | `warga4@sigab.demo` | `demo1234` |
| **Warga 5 (Desa Gunungsari)** | `warga5@sigab.demo` | `demo1234` |

> **Catatan:** Pengguna juga dapat mendaftarkan akun warga baru langsung melalui halaman **Daftar** (nama, email, desa domisili, dan kata sandi minimal 6 karakter). Untuk lingkungan produksi, pembuatan akun demo otomatis dapat dinonaktifkan melalui variabel lingkungan `SEED_DEMO_ACCOUNTS=false`.

---

## 👥 Tim Pengembang

Program Studi **D3 Teknik Informatika PSDKU Lamongan**  
Departemen Teknik Informatika dan Komputer — **Politeknik Elektronika Negeri Surabaya (PENS)**
- **Sabilu Rosyada** (`3125521009`)
- **Putri Norma Yunita** (`3125521010`)
