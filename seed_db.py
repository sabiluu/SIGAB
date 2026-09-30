"""
Script untuk mengisi data awal (seeding) database siagabencana.db.
"""

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.village import Village
from app.models.shelter import Shelter
from app.models.system_config import SystemConfig

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed Desa Kecamatan Baureno jika belum ada
        if db.query(Village).count() == 0:
            print("Seeding 25 desa Kecamatan Baureno...")
            villages_data = [
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
                ('Tulungagung',      -7.1291, 112.1279, 21.00, 50.00),
            ]
            for name, lat, lon, elev, hist in villages_data:
                v = Village(
                    name=name,
                    latitude=lat,
                    longitude=lon,
                    elevation_index=elev,
                    history_score=hist,
                    current_risk_level='rendah',
                    current_probability=15.0
                )
                db.add(v)
            db.commit()
            print("25 desa berhasil disimpan.")

        # 2. Seed System Config
        if db.query(SystemConfig).count() == 0:
            print("Seeding konfigurasi default...")
            configs = [
                ('weight_discharge', '0.35', 'float', 'Bobot debit sungai'),
                ('weight_rainfall', '0.30', 'float', 'Bobot curah hujan'),
                ('weight_elevation', '0.20', 'float', 'Bobot elevasi'),
                ('weight_history', '0.15', 'float', 'Bobot riwayat historis'),
                ('critical_discharge_threshold', '1500.00', 'float', 'Ambang batas debit kritis limpasan sungai'),
                ('emergency_probability_threshold', '76.00', 'float', 'Batas probabilitas mode darurat'),
                ('api_polling_interval_seconds', '60', 'integer', 'Interval polling API (detik)'),
                ('notification_push_enabled', 'true', 'boolean', 'Status push notifikasi'),
            ]
            for k, val, ctype, desc in configs:
                db.add(SystemConfig(config_key=k, config_value=val, config_type=ctype, description=desc))
            db.commit()
            print("Konfigurasi default berhasil disimpan.")

        # 3. Seed Shelters jika belum ada
        if db.query(Shelter).count() == 0:
            baureno_v = db.query(Village).filter(Village.name == 'Baureno').first()
            vid = baureno_v.id if baureno_v else 1
            shelters_data = [
                ("Posko SDN Baureno 2", "Jl. Raya Baureno No. 14", vid, -7.1285, 112.1040, 150, 25, "Bpk. Bambang", "081234567801"),
                ("Posko Balai Desa Baureno", "Jl. Pemuda No. 01", vid, -7.1278, 112.1030, 200, 60, "Ibu Siti", "081234567802"),
                ("Posko Masjid Al-Huda Trojalu", "Jl. Masjid No. 5", vid, -7.1265, 112.1150, 100, 10, "Bpk. H. Anwar", "081234567803"),
            ]
            for name, addr, v_id, lat, lon, cap_tot, cap_occ, cp, phone in shelters_data:
                s = Shelter(
                    name=name,
                    address=addr,
                    village_id=v_id,
                    latitude=lat,
                    longitude=lon,
                    capacity_total=cap_tot,
                    capacity_occupied=cap_occ,
                    contact_person=cp,
                    contact_phone=phone,
                    is_active=True
                )
                db.add(s)
            db.commit()
            print("Shelter posko berhasil disimpan.")

        # 4. Seed Users: Admin BPBD & Warga
        admin_email = "admin@siagabencana.id"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            print("Seeding admin default (admin@siagabencana.id / admin123)...")
            admin_user = User(
                full_name="Admin Pusdalops BPBD",
                email=admin_email,
                phone="081234567890",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
        else:
            admin.password_hash = hash_password("admin123")

        warga_email = "warga@siagabencana.id"
        warga = db.query(User).filter(User.email == warga_email).first()
        if not warga:
            print("Seeding warga default (warga@siagabencana.id / warga123)...")
            baureno_v = db.query(Village).filter(Village.name == 'Baureno').first()
            vid = baureno_v.id if baureno_v else None
            warga_user = User(
                full_name="Budi Santoso",
                email=warga_email,
                phone="081298765432",
                password_hash=hash_password("warga123"),
                role="user",
                village_id=vid,
                is_active=True
            )
            db.add(warga_user)
        else:
            warga.password_hash = hash_password("warga123")

        db.commit()
        print("Data awal (Users, Villages, Shelters, Config) berhasil disiapkan!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
