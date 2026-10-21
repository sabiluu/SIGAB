import os
import sys
import json
from datetime import datetime

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.village import Village
from app.models.shelter import Shelter
from app.models.system_config import SystemConfig
from app.models.flood_incident import FloodIncident

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    print("Mulai proses Database Seeding...")

    # 1. Seed Admin User
    admin = db.query(User).filter(User.email == "admin@bpbd.go.id").first()
    if not admin:
        admin = User(
            full_name="Admin BPBD Bojonegoro",
            email="admin@bpbd.go.id",
            password_hash=hash_password("admin123"),
            phone="081234567890",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        print("✅ Default Admin User ditambahkan (admin@bpbd.go.id / admin123)")
    else:
        print("ℹ️ Admin User sudah ada.")

    # 2. Seed System Config
    configs = [
        {"key": "weight_discharge", "val": "0.35", "desc": "Bobot debit air dalam kalkulasi banjir", "type": "float"},
        {"key": "weight_rainfall", "val": "0.30", "desc": "Bobot curah hujan dalam kalkulasi banjir", "type": "float"},
        {"key": "weight_elevation", "val": "0.20", "desc": "Bobot elevasi/ketinggian tanah dalam kalkulasi", "type": "float"},
        {"key": "weight_history", "val": "0.15", "desc": "Bobot histori kejadian banjir dalam kalkulasi", "type": "float"},
        {"key": "critical_discharge_threshold", "val": "1500.0", "desc": "Ambang batas kritis debit (m3/s)", "type": "float"},
    ]
    for cfg in configs:
        existing = db.query(SystemConfig).filter(SystemConfig.config_key == cfg["key"]).first()
        if not existing:
            db.add(SystemConfig(
                config_key=cfg["key"],
                config_value=cfg["val"],
                config_type=cfg["type"],
                description=cfg["desc"]
            ))
            print(f"✅ System Config '{cfg['key']}' ditambahkan.")
        else:
            print(f"ℹ️ System Config '{cfg['key']}' sudah ada.")

    # 3. Seed Villages dari file JSON
    json_path = os.path.join(os.path.dirname(__file__), "app", "data_cuaca_baureno_semua_desa.json")
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                desa_name = f"Desa {item['desa']}"
                existing = db.query(Village).filter(Village.name == desa_name).first()
                if not existing:
                    coord = item.get("raw_data", {}).get("coord", {})
                    lat = coord.get("lat", -7.128)
                    lon = coord.get("lon", 112.103)
                    
                    # Tambahkan variasi dummy untuk elevasi dan histori (bisa diubah nanti)
                    import random
                    elev = random.uniform(9.0, 35.0)
                    hist = random.uniform(20.0, 80.0)

                    db.add(Village(
                        name=desa_name,
                        latitude=lat,
                        longitude=lon,
                        elevation_index=elev,
                        history_score=hist,
                        current_risk_level="rendah",
                        current_probability=0.0
                    ))
                    print(f"✅ Desa '{desa_name}' ditambahkan.")
                else:
                    print(f"ℹ️ Desa '{desa_name}' sudah ada.")
    else:
        print(f"⚠️ File data cuaca tidak ditemukan di {json_path}. Melewati seeding Desa.")

    db.commit()

    # 4. Seed Shelters (Posko Pengungsian)
    # Get a village to attach shelters to
    baureno = db.query(Village).filter(Village.name == "Desa Baureno").first()
    if baureno:
        shelters = [
            {"name": "Balai Kecamatan Baureno", "lat": -7.129, "lon": 112.105, "cap": 500},
            {"name": "SDN Baureno 1", "lat": -7.125, "lon": 112.110, "cap": 300},
            {"name": "Masjid Jami' Baureno", "lat": -7.130, "lon": 112.100, "cap": 250},
        ]
        for sh in shelters:
            existing = db.query(Shelter).filter(Shelter.name == sh["name"]).first()
            if not existing:
                db.add(Shelter(
                    name=sh["name"],
                    address="Kecamatan Baureno, Bojonegoro",
                    village_id=baureno.id,
                    latitude=sh["lat"],
                    longitude=sh["lon"],
                    capacity_total=sh["cap"],
                    capacity_occupied=0,
                    contact_person="Petugas BPBD",
                    contact_phone="08111222333"
                ))
                print(f"✅ Posko '{sh['name']}' ditambahkan.")
            else:
                print(f"ℹ️ Posko '{sh['name']}' sudah ada.")

    db.commit()

    # 5. Seed Flood Incidents (Arsip & Log Kejadian Banjir Lampau)
    incidents_data = [
        {
            "title": "Banjir Bandang Bengawan Solo",
            "event_date": datetime(2026, 2, 12, 3, 20),
            "desc": "Luapan sungai merendam 6 desa bantaran. Evakuasi massal warga ke 3 posko pengungsian utama.",
            "category": "awas",
            "water_level_m": 5.2,
            "discharge_m3s": 1850.0,
            "rainfall_mm": 146.0,
            "evacuated_count": 312,
            "affected_people_count": 1250,
            "shelter_count": 3,
            "affected_villages": "Kedungdowo, Baureno, Kalisari, Tanggungan, Pomahan, Gunungsari",
        },
        {
            "title": "Siaga Hujan Ekstrem",
            "event_date": datetime(2026, 1, 28, 18, 45),
            "desc": "Curah hujan tinggi 4 jam berturut-turut. Status tanggap darurat naik ke Siaga.",
            "category": "siaga",
            "water_level_m": 3.6,
            "discharge_m3s": 1150.0,
            "rainfall_mm": 112.0,
            "evacuated_count": 48,
            "affected_people_count": 220,
            "shelter_count": 1,
            "affected_villages": "Baureno, Banjaranyar, Bumiayu",
        },
        {
            "title": "Muka Air Naik Signifikan",
            "event_date": datetime(2026, 1, 5, 22, 10),
            "desc": "Pemantauan intensif TMA Bengawan Solo. Warga bantaran sungai diimbau waspada.",
            "category": "siaga",
            "water_level_m": 3.4,
            "discharge_m3s": 980.0,
            "rainfall_mm": 88.0,
            "evacuated_count": 12,
            "affected_people_count": 75,
            "shelter_count": 1,
            "affected_villages": "Kedungdowo, Tanggungan",
        },
        {
            "title": "Pemulihan Pasca-Banjir",
            "event_date": datetime(2025, 12, 19, 9, 0),
            "desc": "Kondisi normal kembali. Posko pengungsian ditutup, warga kembali ke rumah.",
            "category": "aman",
            "water_level_m": 1.4,
            "discharge_m3s": 420.0,
            "rainfall_mm": 6.0,
            "evacuated_count": 0,
            "affected_people_count": 0,
            "shelter_count": 0,
            "affected_villages": "Baureno, Kedungdowo, Kalisari",
        },
        {
            "title": "Banjir Rob Musiman",
            "event_date": datetime(2025, 12, 2, 14, 30),
            "desc": "Genangan hingga 80 cm di area dataran rendah. Armada perahu karet BPBD dikerahkan.",
            "category": "awas",
            "water_level_m": 4.9,
            "discharge_m3s": 1620.0,
            "rainfall_mm": 121.0,
            "evacuated_count": 205,
            "affected_people_count": 850,
            "shelter_count": 2,
            "affected_villages": "Kedungdowo, Gunungsari, Pomahan, Kalisari",
        },
        {
            "title": "Peningkatan Debit Kiriman Hulu",
            "event_date": datetime(2025, 11, 14, 16, 15),
            "desc": "Debit air kiriman dari Jurug dan Karangnongko masuk Baureno, elevasi sempadan meningkat.",
            "category": "waspada",
            "water_level_m": 2.8,
            "discharge_m3s": 850.0,
            "rainfall_mm": 45.0,
            "evacuated_count": 0,
            "affected_people_count": 110,
            "shelter_count": 0,
            "affected_villages": "Baureno, Kedungdowo",
        },
        {
            "title": "Genangan Luapan Drainase Permukiman",
            "event_date": datetime(2025, 10, 20, 20, 0),
            "desc": "Hujan lebat sesaat menyebabkan saluran drainase meluap di jalan poros sebelum surut 3 jam kemudian.",
            "category": "waspada",
            "water_level_m": 2.2,
            "discharge_m3s": 600.0,
            "rainfall_mm": 68.0,
            "evacuated_count": 0,
            "affected_people_count": 40,
            "shelter_count": 0,
            "affected_villages": "Baureno, Drajat",
        },
    ]

    for item in incidents_data:
        existing = db.query(FloodIncident).filter(FloodIncident.title == item["title"]).first()
        if not existing:
            db.add(FloodIncident(
                title=item["title"],
                description=item["desc"],
                category=item["category"],
                water_level_m=item["water_level_m"],
                discharge_m3s=item["discharge_m3s"],
                rainfall_mm=item["rainfall_mm"],
                evacuated_count=item["evacuated_count"],
                affected_people_count=item["affected_people_count"],
                shelter_count=item["shelter_count"],
                affected_villages=item["affected_villages"],
                event_date=item["event_date"],
                status="selesai",
                is_archived=True,
            ))
            print(f"✅ Arsip Kejadian '{item['title']}' ditambahkan.")
        else:
            print(f"ℹ️ Arsip Kejadian '{item['title']}' sudah ada.")

    db.commit()
    db.close()
    print("🎉 Database Seeding selesai!")

if __name__ == "__main__":
    seed()
