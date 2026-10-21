# 📑 LAPORAN PENGEMBANGAN FITUR SISTEM
## Implementasi Indikator Sisa Kapasitas Posko Terdekat (Portal Beranda Warga)

> **Platform:** SiagaBencana — Sistem Peringatan Dini & Manajemen Evakuasi Banjir Baureno  
> **Modul Terkait:** Portal Beranda Warga (`WargaBeranda.jsx`) & Manajemen Shelter  
> **Tanggal Implementasi:** 15 Oktober 2026  
> **Status:** Selesai, Terintegrasi, dan Lolos Uji Validasi (0 Error)  

---

## 1. Latar Belakang Kebutuhan Fitur

Pada skenario mitigasi bencana banjir luapan Sungai Bengawan Solo di Kecamatan Baureno, kesiapsiagaan warga sangat bergantung pada kejelasan informasi tempat evakuasi sementara (shelter/posko). 

Sebelum fitur ini dikembangkan, antarmuka Beranda warga hanya menampilkan informasi umum keterisian posko berupa teks kecil `Kapasitas (Terisi X) / Y orang` dengan bilah statis. Kondisi ini memiliki kelemahan kritis:
1. **Tidak Ada Perhitungan Eksplisit Sisa Kuota:** Warga harus menghitung sendiri sisa kapasitas yang tersisa.
2. **Tidak Ada Indikator Visual Bahaya Overload:** Tidak ada tanda peringatan visual yang jelas saat posko sudah mendekati batas maksimal (80%+) atau telah penuh (100%).
3. **Risiko Penumpukan Korban Banjir:** Warga berisiko mengungsi ke posko terdekat yang ternyata sudah terisi penuh, sehingga terlantar di tengah banjir.
4. **Ketiadaan Rekomendasi Posko Alternatif:** Sistem tidak otomatis menyarankan posko terdekat berikutnya yang masih memiliki ruang tampung kosong.

Oleh karena itu, dikembangkan fitur **Indikator Sisa Kapasitas Posko Terdekat & Rekomendasi Pintar (Smart Recommendation)** pada portal Beranda warga.

---

## 2. Logika Matematis & Klasifikasi Status Kapasitas

Perhitungan sisa kapasitas dihitung secara real-time pada setiap posko evakuasi yang aktif di Kecamatan Baureno:

### Formula Perhitungan:
$$\text{Sisa Kapasitas} = \max(0, \text{Kapasitas Total} - \text{Kapasitas Terisi})$$
$$\text{Persentase Keterisian} = \min\left(100, \text{round}\left(\frac{\text{Kapasitas Terisi}}{\text{Kapasitas Total}} \times 100\right)\right)$$
$$\text{Persentase Sisa Kuota} = 100 - \text{Persentase Keterisian}$$

### Matriks Klasifikasi Status:

| Status Ketersediaan | Kondisi / Ambang Batas | Aksen Visual | Penjelasan untuk Warga |
|---|---|---|---|
| 🟢 **Tersedia Aman** | $\text{Sisa} > 20\%$ dan $\text{Keterisian} < 80\%$ | Hijau Emerald (`#059669`) | Kapasitas posko masih mencukupi dan siap menerima warga. |
| 🟡 **Sisa Menipis** | $\text{Sisa} \le 20\%$ atau $\text{Keterisian} \ge 80\%$ | Kuning Oranye (`#d97706`) | Kuota tersisa tinggal sedikit, disarankan segera konfirmasi. |
| 🔴 **Kapasitas Penuh** | $\text{Sisa} = 0$ atau $\text{Keterisian} \ge 100\%$ | Merah Peringatan (`#dc2626`) | Posko overload dan ditutup untuk pengungsi baru. |

---

## 3. Komponen Antarmuka & UX yang Diimplementasikan

### 3.1. Hero Box Indikator Sisa Kapasitas (Sidebar Kanan Beranda)
* **Hero Number Display:** Angka besar sisa kapasitas (misal: **`90 Jiwa Tersisa`**) dengan sub-label kapasitas total.
* **Dual-Track Progress Bar:** Visual bar dua warna berkesinambungan yang membedakan kapasitas terisi (*biru/merah*) dan kuota yang masih kosong (*hijau/kuning*) secara presisi.
* **Grid 3-Pilar Metrik:**
  1. *Daya Tampung:* Total kuota gedung posko.
  2. *Telah Terisi:* Jumlah pengungsi yang tercatat beserta persentase.
  3. *Sisa Kuota:* Sisa tempat yang masih dapat menampung warga.
* **Banner Edukasi Status:** Pesan interaktif dinamis yang menjelaskan kondisi posko secara manusiawi dan lugas.

### 3.2. Smart Fallback Recommendation (Rekomendasi Cerdas Otomatis)
Jika posko terdekat utama dari koordinat GPS warga berstatus **Kapasitas Penuh (Sisa 0)**, sistem secara otomatis:
* Memunculkan kartu notifikasi biru: *"💡 Posko Alternatif Terdekat Tersedia"*.
* Menampilkan nama posko alternatif kedua, jaraknya dari lokasi warga (`X.X km`), serta sisa kuota yang tersedia.
* Menyediakan tombol aksi satu klik: *"Pilih Posko Alternatif Ini →"*.

### 3.3. Dropdown Quick Selector
Warga dapat memilih posko evakuasi lain secara langsung dari kartu untuk melihat detail sisa kapasitas dan jaraknya.

### 3.4. Peningkatan pada Card Daftar Posko Evakuasi di Samping Peta
* Menampilkan chip badge status sisa kuota: `Sisa: X jiwa` (berwarna hijau/oranye/merah) pada setiap item posko.
* Menampilkan jarak GPS real-time dari posisi warga (`X.X km`).
* Mini dual-track progress bar keterisian vs sisa.
* Tombol aksi **Detail Sisa** dan **Pandu Rute (OSRM)**.

---

## 4. Berkas dan Kode yang Diubah

| Berkas | Perubahan |
|---|---|
| [`src/components/warga/WargaBeranda.jsx`](file:///d:/SIGAB/src/components/warga/WargaBeranda.jsx) | Implementasi hook `enrichedShelters`, state `activeShelterId`, Hero Box sisa kapasitas, dual-track bar, smart recommendation, dan upgrade list posko. |
| [`src/styles/warga-portal.css`](file:///d:/SIGAB/src/styles/warga-portal.css) | Penambahan styling `.posko-indikator-card`, `.sisa-kapasitas-hero-box`, `.posko-stats-3col`, dan animasi transisi. |
| [`src/services/shelterService.js`](file:///d:/SIGAB/src/services/shelterService.js) | Penambahan fungsi API `getNearbyAvailableShelters` yang terhubung ke endpoint backend FastAPI `/shelters/nearby-available`. |
| [`02_prd_v3.md`](file:///d:/SIGAB/02_prd_v3.md) | Penambahan poin spesifikasi fitur Indikator Sisa Kapasitas Posko & Smart Fallback di Bab 4.2. |
| [`TIMELINE_MINGGU_5_14_PRIVAT.md`](file:///d:/SIGAB/TIMELINE_MINGGU_5_14_PRIVAT.md) | Pembaruan catatan kemajuan fitur pada Minggu 11 dan penyelarasan output capaian. |

---

## 5. Hasil Pengujian dan Validasi Sistem

1. **Uji Linter (`oxlint`):**
   * Output: `0 error` (lolos standar static analysis React Compiler).
2. **Uji Kompilasi Bundle (`vite build`):**
   * Output: `✓ built in 3.13s` (lulus tanpa error, siap deployment produksi).
3. **Uji Integrasi Backend Database (`siagabencana.db`):**
   * Telah diverifikasi integrasi data posko riil (misal: *Posko SDN Baureno 2* kapasitas 150 terisi 150 otomatis berstatus Penuh; *Posko Balai Desa Baureno* terisi 190/200 otomatis berstatus Sisa Menipis; *Posko Masjid Al-Huda Trojalu* kapasitas 100 terisi 10 otomatis berstatus Tersedia Aman).
