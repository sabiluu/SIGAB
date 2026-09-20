-- =============================================================================
-- SiagaBencana — Database Schema DDL (MySQL 8.0)
-- Platform Peringatan Dini, Prediksi Probabilitas & Manajemen Evakuasi Darurat
-- Banjir Kecamatan Baureno, Kabupaten Bojonegoro
-- =============================================================================
-- Versi     : 1.0.0
-- Tanggal   : 16 September 2026
-- Acuan     : PRD v3.0 (02_prd_v3.md) & Design Architecture v1.0 (03_design_architecture_and_system.md)
-- Engine    : InnoDB (transactional, FK support)
-- Charset   : utf8mb4 (full Unicode support termasuk emoji notifikasi)
-- =============================================================================

-- Buat database
CREATE DATABASE IF NOT EXISTS siagabencana
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE siagabencana;

-- =============================================================================
-- RESET TABEL (Mencegah error 'Table already exists' saat di-import ulang)
-- =============================================================================
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS sos_tickets;
DROP TABLE IF EXISTS emergency_status;
DROP TABLE IF EXISTS flood_probability_logs;
DROP TABLE IF EXISTS weather_data_logs;
DROP TABLE IF EXISTS river_discharge_logs;
DROP TABLE IF EXISTS shelters;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS villages;
DROP TABLE IF EXISTS system_config;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABEL 1: villages
-- Data 25 desa Kecamatan Baureno
-- Acuan: Data Administrasi Kemendagri & BPS Kab. Bojonegoro, §3.2 (parameter elevasi & histori)
-- =============================================================================
CREATE TABLE villages (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100)   NOT NULL UNIQUE,
    latitude            DECIMAL(10,7)  NOT NULL                     COMMENT 'Koordinat pusat desa (latitude)',
    longitude           DECIMAL(10,7)  NOT NULL                     COMMENT 'Koordinat pusat desa (longitude)',
    elevation_index     DECIMAL(5,2)   NOT NULL DEFAULT 0.00        COMMENT 'Indeks elevasi relatif terhadap sempadan Bengawan Solo (parameter w3 = 20%)',
    history_score       DECIMAL(5,2)   NOT NULL DEFAULT 0.00        COMMENT 'Skor kerentanan historis banjir tahunan dari catatan BPBD (parameter w4 = 15%)',
    current_risk_level  ENUM('rendah','sedang','tinggi','awas')
                        NOT NULL DEFAULT 'rendah'                   COMMENT 'Level risiko terkini (cached dari kalkulasi terakhir)',
    current_probability DECIMAL(5,2)   NOT NULL DEFAULT 0.00        COMMENT 'Skor probabilitas banjir terkini 0.00-100.00 (cached)',
    last_calculated_at  TIMESTAMP      NULL                         COMMENT 'Waktu terakhir engine probabilitas menghitung desa ini',
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_villages_risk (current_risk_level),
    INDEX idx_villages_probability (current_probability)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Data 25 desa Kecamatan Baureno — entitas wilayah utama';


-- =============================================================================
-- TABEL 2: users
-- Data akun pengguna (Warga & Admin BPBD)
-- Acuan: PRD §2.1 (Role Matrix), Design Architecture §4.1 (User Flow Registrasi)
-- =============================================================================
CREATE TABLE users (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    full_name            VARCHAR(100)  NOT NULL,
    email                VARCHAR(150)  NOT NULL UNIQUE,
    phone                VARCHAR(20)   NOT NULL,
    password_hash        VARCHAR(255)  NOT NULL                     COMMENT 'Password di-hash dengan bcrypt (PRD §6.1)',
    role                 ENUM('user','admin')
                         NOT NULL DEFAULT 'user'                    COMMENT 'user = Warga Baureno, admin = Petugas Pusdalops BPBD',
    village_id           INT           NULL                         COMMENT 'Desa domisili warga (NULL untuk admin BPBD)',
    avatar_url           VARCHAR(500)  NULL,
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    notification_enabled BOOLEAN       NOT NULL DEFAULT TRUE        COMMENT 'Toggle notifikasi push di Profil & Pengaturan (Layar U-600)',
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_village
        FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE SET NULL,

    INDEX idx_users_role (role),
    INDEX idx_users_village (village_id),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Akun pengguna platform — Warga (User) & Petugas BPBD (Admin)';


-- =============================================================================
-- TABEL 3: shelters
-- Data posko pengungsian & manajemen kapasitas
-- Acuan: PRD §4.2 (Solusi 2), Design Architecture Layar A-500, Kartu Shelter §10.2
-- =============================================================================
CREATE TABLE shelters (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    name               VARCHAR(150)   NOT NULL,
    address            VARCHAR(300)   NOT NULL,
    village_id         INT            NOT NULL                      COMMENT 'Desa lokasi shelter berada',
    latitude           DECIMAL(10,7)  NOT NULL,
    longitude          DECIMAL(10,7)  NOT NULL,
    capacity_total     INT            NOT NULL DEFAULT 0            COMMENT 'Daya tampung maksimal (jumlah orang)',
    capacity_occupied  INT            NOT NULL DEFAULT 0            COMMENT 'Jumlah pengungsi saat ini di shelter',
    is_active          BOOLEAN        NOT NULL DEFAULT TRUE         COMMENT 'Apakah shelter beroperasi/buka',
    contact_person     VARCHAR(100)   NULL                          COMMENT 'Nama penanggung jawab posko',
    contact_phone      VARCHAR(20)    NULL                          COMMENT 'Nomor telepon penanggung jawab',
    created_at         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_shelters_village
        FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE CASCADE,
    CONSTRAINT chk_shelter_capacity
        CHECK (capacity_occupied >= 0 AND capacity_occupied <= capacity_total),

    INDEX idx_shelters_village (village_id),
    INDEX idx_shelters_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Posko pengungsian — manajemen kapasitas & lokasi evakuasi (Solusi 2)';


-- =============================================================================
-- TABEL 4: river_discharge_logs
-- Log data debit Sungai Bengawan Solo dari Open-Meteo Flood API
-- Acuan: PRD §3.1 (API Debit), Design Architecture Layar A-200
-- =============================================================================
CREATE TABLE river_discharge_logs (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    discharge_m3s   DECIMAL(10,2)  NOT NULL                        COMMENT 'Debit sungai aktual (m³/s)',
    forecast_1d     DECIMAL(10,2)  NULL                            COMMENT 'Prediksi debit 1 hari ke depan (m³/s)',
    forecast_3d     DECIMAL(10,2)  NULL                            COMMENT 'Prediksi debit 3 hari ke depan (m³/s)',
    forecast_7d     DECIMAL(10,2)  NULL                            COMMENT 'Prediksi debit 7 hari ke depan (m³/s)',
    api_source      VARCHAR(100)   NOT NULL DEFAULT 'open-meteo-flood'  COMMENT 'Sumber API data',
    latitude        DECIMAL(10,7)  NOT NULL DEFAULT -7.1200000     COMMENT 'Koordinat query API (lat Baureno)',
    longitude       DECIMAL(10,7)  NOT NULL DEFAULT 112.0800000    COMMENT 'Koordinat query API (lon Baureno)',
    recorded_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_discharge_time (recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log data debit Sungai Bengawan Solo — Open-Meteo Flood API (GloFAS/ECMWF)';


-- =============================================================================
-- TABEL 5: weather_data_logs
-- Log data cuaca & curah hujan dari Open-Meteo Weather API
-- Acuan: PRD §3.1 (API Cuaca), Design Architecture Layar A-201
-- =============================================================================
CREATE TABLE weather_data_logs (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    precipitation_mm   DECIMAL(8,2)   NOT NULL                     COMMENT 'Curah hujan aktual (mm/jam)',
    accumulated_6h     DECIMAL(8,2)   NULL                         COMMENT 'Akumulasi hujan 6 jam terakhir (mm)',
    accumulated_12h    DECIMAL(8,2)   NULL                         COMMENT 'Akumulasi hujan 12 jam terakhir (mm)',
    temperature_c      DECIMAL(5,2)   NULL                         COMMENT 'Suhu udara (°C) — tampil di ringkasan cuaca dashboard',
    wind_speed_kmh     DECIMAL(6,2)   NULL                         COMMENT 'Kecepatan angin (km/jam)',
    api_source         VARCHAR(100)   NOT NULL DEFAULT 'open-meteo-weather'  COMMENT 'Sumber API data',
    latitude           DECIMAL(10,7)  NOT NULL DEFAULT -7.1200000,
    longitude          DECIMAL(10,7)  NOT NULL DEFAULT 112.0800000,
    recorded_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_weather_time (recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log data cuaca & curah hujan — Open-Meteo Weather API';


-- =============================================================================
-- TABEL 6: flood_probability_logs
-- Log historis kalkulasi probabilitas banjir per desa (setiap 60 detik)
-- Acuan: PRD §3.2 (Engine Probabilitas), Design Architecture Layar U-200 (grafik tren 24 jam)
-- Formula: P_banjir = (w1 × S_debit) + (w2 × S_hujan) + (w3 × S_elevasi) + (w4 × S_histori)
-- =============================================================================
CREATE TABLE flood_probability_logs (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    village_id        INT            NOT NULL,
    probability_score DECIMAL(5,2)   NOT NULL                      COMMENT 'Skor akhir P_banjir (0.00 - 100.00)',
    discharge_score   DECIMAL(5,2)   NOT NULL                      COMMENT 'Skor komponen debit sungai (S_debit) setelah normalisasi',
    rainfall_score    DECIMAL(5,2)   NOT NULL                      COMMENT 'Skor komponen curah hujan (S_hujan) setelah normalisasi',
    elevation_score   DECIMAL(5,2)   NOT NULL                      COMMENT 'Skor komponen elevasi (S_elevasi)',
    history_score     DECIMAL(5,2)   NOT NULL                      COMMENT 'Skor komponen histori (S_histori)',
    risk_level        ENUM('rendah','sedang','tinggi','awas')
                      NOT NULL                                     COMMENT 'Klasifikasi: 0-25% rendah, 26-50% sedang, 51-75% tinggi, 76-100% awas',
    discharge_raw     DECIMAL(10,2)  NULL                          COMMENT 'Nilai debit mentah (m³/s) dari API saat kalkulasi',
    rainfall_raw      DECIMAL(8,2)   NULL                          COMMENT 'Nilai curah hujan mentah (mm/jam) dari API saat kalkulasi',
    calculated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_flood_logs_village
        FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE CASCADE,

    INDEX idx_flood_logs_village_time (village_id, calculated_at DESC),
    INDEX idx_flood_logs_time (calculated_at DESC),
    INDEX idx_flood_logs_risk (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log historis kalkulasi probabilitas banjir per desa — engine setiap 60 detik';


-- =============================================================================
-- TABEL 7: emergency_status
-- Log aktivasi/deaktivasi Mode Evakuasi Darurat per desa
-- Acuan: PRD §4.2 (aktivasi otomatis/manual), Design Architecture §5.1 (State Machine),
--        Layar A-300 (Manajemen Status Darurat)
-- =============================================================================
CREATE TABLE emergency_status (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    village_id             INT            NOT NULL,
    is_emergency_active    BOOLEAN        NOT NULL DEFAULT FALSE   COMMENT 'TRUE = Mode Darurat aktif, FALSE = sudah dicabut',
    trigger_type           ENUM('auto_probability','manual_admin')
                           NOT NULL                                COMMENT 'auto = probabilitas >= 76%, manual = admin BPBD aktivasi',
    triggered_by           INT            NULL                     COMMENT 'ID admin yang mengaktifkan (NULL jika otomatis oleh sistem)',
    probability_at_trigger DECIMAL(5,2)   NULL                     COMMENT 'Skor probabilitas saat darurat diaktifkan',
    notes                  TEXT           NULL                      COMMENT 'Catatan admin saat aktivasi/deaktivasi',
    activated_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at         TIMESTAMP      NULL                     COMMENT 'NULL = masih aktif; terisi = sudah dicabut',

    CONSTRAINT fk_emergency_village
        FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE CASCADE,
    CONSTRAINT fk_emergency_admin
        FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_emergency_village (village_id),
    INDEX idx_emergency_active (is_emergency_active),
    INDEX idx_emergency_time (activated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log aktivasi/deaktivasi Mode Evakuasi Darurat per desa (State Machine §5.1)';


-- =============================================================================
-- TABEL 8: sos_tickets
-- Tiket permintaan evakuasi darurat (SOS) — entitas inti Solusi 3
-- Acuan: PRD §4.3 (Solusi 3), Design Architecture §5.3 (Lifecycle Tiket),
--        Layar U-400/U-401/U-402 (User), Layar A-400/A-401 (Admin)
-- Lifecycle: SUBMITTED → VERIFIED → DISPATCHED → ON_ROUTE → ARRIVED → COMPLETED
--            SUBMITTED → REJECTED
-- =============================================================================
CREATE TABLE sos_tickets (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_number          VARCHAR(30)    NOT NULL UNIQUE           COMMENT 'Format: EVAC-BRN-YYYY-MMDD-SEQ (contoh: EVAC-BRN-2026-0916-001)',
    reporter_id            INT            NOT NULL                  COMMENT 'ID user (warga) pelapor',
    village_id             INT            NOT NULL                  COMMENT 'Desa lokasi pelapor saat SOS',

    -- Data GPS & Lokasi (auto-lock dari perangkat — Layar U-400)
    gps_latitude           DECIMAL(10,7)  NOT NULL                  COMMENT 'Koordinat GPS auto-lock perangkat pelapor (latitude)',
    gps_longitude          DECIMAL(10,7)  NOT NULL                  COMMENT 'Koordinat GPS auto-lock perangkat pelapor (longitude)',
    gps_address            VARCHAR(300)   NULL                      COMMENT 'Reverse-geocoded alamat terdekat dari koordinat',

    -- Data Evakuasi (input warga — Layar U-400)
    family_count           INT            NOT NULL DEFAULT 1        COMMENT 'Jumlah anggota keluarga yang butuh dievakuasi (Number Stepper)',
    has_elderly            BOOLEAN        NOT NULL DEFAULT FALSE    COMMENT 'Kategori rentan: Lansia (60+ tahun)',
    has_toddler            BOOLEAN        NOT NULL DEFAULT FALSE    COMMENT 'Kategori rentan: Balita (0-5 tahun)',
    has_disability         BOOLEAN        NOT NULL DEFAULT FALSE    COMMENT 'Kategori rentan: Penyandang Disabilitas',
    has_pregnant           BOOLEAN        NOT NULL DEFAULT FALSE    COMMENT 'Kategori rentan: Ibu Hamil',
    photo_url              VARCHAR(500)   NULL                      COMMENT 'URL foto situasi lapangan (opsional)',

    -- Status & Prioritas
    status                 ENUM('submitted','verified','rejected','dispatched','on_route','arrived','completed')
                           NOT NULL DEFAULT 'submitted'             COMMENT 'Lifecycle status tiket (State Machine §5.3)',
    priority_score         INT            NOT NULL DEFAULT 0        COMMENT 'Skor prioritas: family_count*10 + rentan*5 masing-masing (untuk urutan antrean A-400)',

    -- Disposisi Admin BPBD (Layar A-401)
    assigned_admin_id      INT            NULL                      COMMENT 'ID admin BPBD yang menangani tiket',
    assigned_unit          VARCHAR(100)   NULL                      COMMENT 'Unit armada perahu karet yang ditugaskan',
    rejection_reason       VARCHAR(500)   NULL                      COMMENT 'Alasan penolakan tiket oleh admin (jika status = rejected)',
    shelter_destination_id INT            NULL                      COMMENT 'ID shelter tujuan evakuasi',

    -- Timestamp per tahap lifecycle (untuk timeline tracking — Layar U-402)
    submitted_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at            TIMESTAMP      NULL,
    dispatched_at          TIMESTAMP      NULL,
    arrived_at             TIMESTAMP      NULL,
    completed_at           TIMESTAMP      NULL,
    updated_at             TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_sos_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sos_village
        FOREIGN KEY (village_id) REFERENCES villages(id) ON DELETE CASCADE,
    CONSTRAINT fk_sos_admin
        FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_sos_shelter
        FOREIGN KEY (shelter_destination_id) REFERENCES shelters(id) ON DELETE SET NULL,

    -- Data Integrity
    CONSTRAINT chk_family_count
        CHECK (family_count > 0),

    -- Performance Indexes
    INDEX idx_sos_status (status),
    INDEX idx_sos_reporter (reporter_id),
    INDEX idx_sos_village (village_id),
    INDEX idx_sos_priority (priority_score DESC, submitted_at ASC),
    INDEX idx_sos_created (submitted_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tiket permintaan evakuasi darurat SOS — lifecycle 7 status (Solusi 3, §4.3)';


-- =============================================================================
-- TABEL 9: notifications
-- Riwayat notifikasi peringatan dini & update tiket SOS
-- Acuan: Design Architecture Layar U-500 (Riwayat Notifikasi),
--        §2.2 Navigasi Warga (badge angka merah)
-- =============================================================================
CREATE TABLE notifications (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT            NOT NULL                        COMMENT 'ID penerima notifikasi',
    type            ENUM('early_warning','emergency_alert','sos_update','system_info')
                    NOT NULL                                       COMMENT 'early_warning = peringatan dini probabilitas naik, emergency_alert = banjir parah + sirine, sos_update = update status tiket SOS, system_info = informasi umum sistem',
    title           VARCHAR(200)   NOT NULL                        COMMENT 'Judul notifikasi',
    message         TEXT           NOT NULL                        COMMENT 'Isi pesan notifikasi',
    reference_type  VARCHAR(50)    NULL                            COMMENT 'Tipe entitas terkait: sos_ticket, village, emergency, dll',
    reference_id    BIGINT         NULL                            COMMENT 'ID entitas terkait (untuk deep-link ke detail)',
    is_read         BOOLEAN        NOT NULL DEFAULT FALSE          COMMENT 'Status sudah dibaca (untuk badge unread count)',
    is_pushed       BOOLEAN        NOT NULL DEFAULT FALSE          COMMENT 'Apakah sudah berhasil di-push ke perangkat via WebSocket',
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_notif_user_unread (user_id, is_read, created_at DESC),
    INDEX idx_notif_user_time (user_id, created_at DESC),
    INDEX idx_notif_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Riwayat notifikasi peringatan dini & update tiket SOS (Layar U-500)';


-- =============================================================================
-- TABEL 10: system_config
-- Konfigurasi ambang batas & parameter sistem
-- Acuan: PRD §3.2 (bobot formula w1-w4), Design Architecture Layar A-600
-- =============================================================================
CREATE TABLE system_config (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    config_key      VARCHAR(100)   NOT NULL UNIQUE                 COMMENT 'Kunci konfigurasi (unik)',
    config_value    VARCHAR(500)   NOT NULL                        COMMENT 'Nilai konfigurasi',
    config_type     ENUM('float','integer','string','boolean')
                    NOT NULL DEFAULT 'string'                      COMMENT 'Tipe data nilai untuk parsing di backend',
    description     VARCHAR(300)   NULL                            COMMENT 'Deskripsi fungsi konfigurasi',
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by      INT            NULL                            COMMENT 'ID admin yang terakhir mengubah',

    CONSTRAINT fk_config_admin
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Konfigurasi ambang batas & parameter sistem (Layar A-600)';


-- =============================================================================
-- SEED DATA: 25 Desa Kecamatan Baureno
-- Sumber: Data Administrasi Kemendagri & BPS Kabupaten Bojonegoro
-- =============================================================================
-- CATATAN: Koordinat bersumber dari Wikipedia, BPS, & OpenStreetMap.
-- Elevation_index dan history_score masih ESTIMASI —
-- perlu dikalibrasi dengan data survei lapangan BPBD Bojonegoro.
-- =============================================================================
INSERT INTO villages (name, latitude, longitude, elevation_index, history_score) VALUES
    ('Banjaran',         -7.1354, 112.0754, 17.00, 55.00),
    ('Banjaranyar',      -7.1589, 112.0515, 20.00, 50.00),
    ('Baureno',          -7.1282, 112.1039, 26.00, 45.00),
    ('Blongsong',        -7.1382, 112.0965, 27.00, 40.00),
    ('Bumiayu',          -7.1198, 112.1221, 11.00, 75.00),
    ('Drajat',           -7.1526, 112.0494, 16.00, 58.00),
    ('Gajah',            -7.1242, 112.1592, 28.00, 35.00),
    ('Gunungsari',       -7.1269, 112.1405, 17.00, 52.00),
    ('Kalisari',         -7.1189, 112.1441,  9.00, 78.00),
    ('Karangdayu',       -7.1208, 112.0823, 13.00, 72.00),
    ('Kauman',           -7.1211, 112.1027, 20.00, 60.00),
    ('Kedungrejo',       -7.0906, 112.1023, 14.00, 85.00),
    ('Lebaksari',        -7.0931, 112.1189, 12.00, 82.00),
    ('Ngemplak',         -7.1557, 112.0617, 16.00, 56.00),
    ('Pasinan',          -7.1242, 112.1021, 26.00, 48.00),
    ('Pomahan',          -7.1161, 112.0699, 22.00, 62.00),
    ('Pucangarum',       -7.0929, 112.0766,  9.00, 88.00),
    ('Selorejo',         -7.1534, 112.1529, 14.00, 65.00),
    ('Sembunglor',       -7.1190, 112.0568, 13.00, 70.00),
    ('Sraturejo',        -7.1365, 112.0832, 29.00, 35.00),
    ('Sumuragung',       -7.1372, 112.1547, 38.00, 25.00),
    ('Tanggungan',       -7.1036, 112.1336, 16.00, 80.00),
    ('Tlogoagung',       -7.1428, 112.1451, 14.00, 60.00),
    ('Trojalu',          -7.1272, 112.1161, 22.00, 52.00),
    ('Tulungagung',      -7.1291, 112.1279, 21.00, 50.00);


-- =============================================================================
-- SEED DATA: Konfigurasi Default Sistem
-- Acuan: PRD §3.2 (bobot formula), §3.1 (interval polling)
-- =============================================================================
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
    ('weight_discharge',                '0.35',    'float',   'Bobot debit sungai (w1) dalam formula probabilitas banjir'),
    ('weight_rainfall',                 '0.30',    'float',   'Bobot curah hujan (w2) dalam formula probabilitas banjir'),
    ('weight_elevation',                '0.20',    'float',   'Bobot elevasi desa (w3) dalam formula probabilitas banjir'),
    ('weight_history',                  '0.15',    'float',   'Bobot riwayat historis banjir (w4) dalam formula probabilitas banjir'),
    ('critical_discharge_threshold',    '1500.00', 'float',   'Ambang batas debit kritis limpasan sungai (m³/s)'),
    ('emergency_probability_threshold', '76.00',   'float',   'Batas probabilitas untuk aktivasi otomatis Mode Evakuasi Darurat (%)'),
    ('api_polling_interval_seconds',    '60',      'integer', 'Interval penarikan data dari API eksternal (detik)'),
    ('notification_push_enabled',       'true',    'boolean', 'Status global push notifikasi aktif/nonaktif');


-- =============================================================================
-- SEED DATA: Akun Admin Default BPBD
-- Password: admin123 (bcrypt hash — GANTI di production!)
-- =============================================================================
INSERT INTO users (full_name, email, phone, password_hash, role, village_id) VALUES
    ('Admin Pusdalops BPBD', 'admin@siagabencana.id', '081234567890',
     '$2b$12$LJ3m4ys5IX8FO4BsHm9zVuP3YsQ9v5XvX5ydG6h/gNf6sRzKaMVWe',
     'admin', NULL);


-- =============================================================================
-- CATATAN PRODUKSI:
-- =============================================================================
-- 1. PARTISI TABEL LOG: Untuk deployment produksi, pertimbangkan RANGE PARTITION
--    BY YEAR/MONTH pada tabel flood_probability_logs, river_discharge_logs, dan
--    weather_data_logs yang tumbuh sangat cepat (setiap 60 detik).
--
-- 2. PASSWORD ADMIN: Hash bcrypt di atas adalah placeholder.
--    Ganti dengan password yang kuat sebelum deployment.
--
-- 3. KOORDINAT DESA: Semua latitude/longitude adalah estimasi.
--    Perlu dikalibrasi dengan data GIS aktual dari BPBD Bojonegoro.
--
-- 4. BACKUP STRATEGY: Tabel kritis (sos_tickets, users) memerlukan
--    backup harian. Tabel log bisa di-archive bulanan.
-- =============================================================================
