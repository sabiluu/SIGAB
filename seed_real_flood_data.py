"""
Script untuk mengimpor Data Riil Kejadian Banjir BPBD Baureno (2023 - 2025)
ke database SIGAB (tabel flood_incidents) dan menghasilkan berkas CSV resmi.
"""

import os
import sys
import csv
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.village import Village
from app.models.flood_incident import FloodIncident

REAL_FLOOD_DATA = [
    {
        "no": 1,
        "date_str": "2023-03-04 08:00:00",
        "title": "Banjir Bengawan Solo: Luapan Sungai Kalisari",
        "category": "siaga",
        "village_name": "Desa Kalisari",
        "affected_villages": "Kalisari (Dusun Cekalan)",
        "water_level_m": 0.50,
        "discharge_m3s": 1420.00,
        "rainfall_mm": 85.00,
        "evacuated_count": 0,
        "affected_people_count": 104,  # 26 Rumah * 4 jiwa
        "shelter_count": 1,
        "status": "selesai",
        "description": "2 Fasum (SD & Balai Desa) tergenang ± 20–30 cm, ± 25 Rumah warga tergenang ± 10–20 cm, 1 Rumah tergenang di Dusun Cekalan, ± 3 km Jalan Desa terendam ± 20–50 cm, Sawah terendam (usia padi 3 bln) 50 Ha. Kerugian materil ditaksir Rp 50.000.000.",
    },
    {
        "no": 2,
        "date_str": "2023-02-18 09:00:00",
        "title": "Banjir Bengawan Solo: Luapan Sungai Lebaksari",
        "category": "waspada",
        "village_name": "Desa Lebaksari",
        "affected_villages": "Lebaksari",
        "water_level_m": 0.50,
        "discharge_m3s": 1150.00,
        "rainfall_mm": 62.00,
        "evacuated_count": 0,
        "affected_people_count": 24,  # 6 Rumah * 4 jiwa
        "shelter_count": 0,
        "status": "selesai",
        "description": "6 Rumah warga tergenang rata-rata 50 cm a.n.: Nyoto Amin, Masi'ah, Murip, Muhammad Nisar, Naful Rojib, Ngatemi.",
    },
    {
        "no": 3,
        "date_str": "2023-02-17 14:00:00",
        "title": "Banjir Bengawan Solo: Genangan Fasum & Jalan Kalisari",
        "category": "waspada",
        "village_name": "Desa Kalisari",
        "affected_villages": "Kalisari",
        "water_level_m": 1.00,
        "discharge_m3s": 1080.00,
        "rainfall_mm": 55.00,
        "evacuated_count": 0,
        "affected_people_count": 50,
        "shelter_count": 0,
        "status": "selesai",
        "description": "Jalan Dusun tergenang ± 20–50 cm. Fasum: Makam dan SDN 1 Kalisari tergenang ± 1 meter akibat luapan sungai Bengawan Solo.",
    },
    {
        "no": 4,
        "date_str": "2024-02-06 06:00:00",
        "title": "Banjir Luapan Sungai: Genangan Massal Tulungagung",
        "category": "awas",
        "village_name": "Desa Tulungagung",
        "affected_villages": "Tulungagung",
        "water_level_m": 0.80,
        "discharge_m3s": 1250.00,
        "rainfall_mm": 135.00,
        "evacuated_count": 0,
        "affected_people_count": 1600,  # 400 Rumah * 4 jiwa
        "shelter_count": 2,
        "status": "selesai",
        "description": "Banjir luapan sungai dan genangan merendam 400 rumah warga serta 135 Ha lahan persawahan di Desa Tulungagung.",
    },
    {
        "no": 5,
        "date_str": "2024-01-30 10:00:00",
        "title": "Banjir Luapan Sungai / Genangan: Jalan Poros Baureno",
        "category": "waspada",
        "village_name": "Desa Baureno",
        "affected_villages": "Baureno",
        "water_level_m": 0.20,
        "discharge_m3s": 750.00,
        "rainfall_mm": 92.00,
        "evacuated_count": 0,
        "affected_people_count": 8,
        "shelter_count": 0,
        "status": "selesai",
        "description": "2 Rumah terendam air 5–10 cm (a.n. Patemi, Israwan), Sawah terendam ± 30 Ha (padi 14 hari), Jalan Poros Utama Baureno–Kepohbaru terendam 2–3 cm sepanjang 500 meter.",
    },
    {
        "no": 6,
        "date_str": "2025-05-21 07:00:00",
        "title": "Banjir Bengawan Solo: Luapan Tanggul Kalisari",
        "category": "awas",
        "village_name": "Desa Kalisari",
        "affected_villages": "Kalisari",
        "water_level_m": 1.20,
        "discharge_m3s": 1780.00,
        "rainfall_mm": 140.00,
        "evacuated_count": 85,
        "affected_people_count": 1280,  # 320 KK * 4 jiwa
        "shelter_count": 3,
        "status": "selesai",
        "description": "320 KK terdampak. Jalan poros tergenang ± 6 KM. Fasilitas ibadah dan umum (Masjid, Polindes, Sekolah, Kantor Desa) tergenang air luapan Bengawan Solo. Sawah tergenang 150 Ha.",
    },
    {
        "no": 7,
        "date_str": "2025-05-21 08:30:00",
        "title": "Banjir Bengawan Solo: Luapan Permukiman Lebaksari",
        "category": "siaga",
        "village_name": "Desa Lebaksari",
        "affected_villages": "Lebaksari",
        "water_level_m": 0.80,
        "discharge_m3s": 1550.00,
        "rainfall_mm": 115.00,
        "evacuated_count": 18,
        "affected_people_count": 264,  # 66 KK * 4 jiwa
        "shelter_count": 1,
        "status": "selesai",
        "description": "66 KK terdampak luapan Bengawan Solo. Jalan Poros desa tergenang 2 Km, Sawah tergenang 10 Ha, serta 1 fasilitas pendidikan tergenang.",
    },
    {
        "no": 8,
        "date_str": "2025-05-21 09:00:00",
        "title": "Banjir Bengawan Solo: Luapan Tanggungan",
        "category": "awas",
        "village_name": "Desa Tanggungan",
        "affected_villages": "Tanggungan",
        "water_level_m": 1.00,
        "discharge_m3s": 1680.00,
        "rainfall_mm": 128.00,
        "evacuated_count": 42,
        "affected_people_count": 500,  # 125 KK * 4 jiwa
        "shelter_count": 2,
        "status": "selesai",
        "description": "125 KK terdampak. Jalan Poros tergenang 4 Km. Fasilitas umum (Masjid, SD, dan Polindes) tergenang luapan sungai. Sawah tergenang ± 95 Ha.",
    },
    {
        "no": 9,
        "date_str": "2025-02-26 07:00:00",
        "title": "Banjir Bengawan Solo: Genangan Sawah Trojalu",
        "category": "waspada",
        "village_name": "Desa Trojalu",
        "affected_villages": "Trojalu",
        "water_level_m": 0.40,
        "discharge_m3s": 980.00,
        "rainfall_mm": 60.00,
        "evacuated_count": 0,
        "affected_people_count": 40,
        "shelter_count": 0,
        "status": "selesai",
        "description": "Area persawahan produktif warga terendam luapan sungai Bengawan Solo sebanyak 20 Ha.",
    },
    {
        "no": 10,
        "date_str": "2025-02-26 08:00:00",
        "title": "Banjir Bengawan Solo: Genangan Permukiman Kadungrejo",
        "category": "siaga",
        "village_name": "Desa Kedungrejo",  # Kadungrejo
        "affected_villages": "Kadungrejo (Kedungrejo)",
        "water_level_m": 0.50,
        "discharge_m3s": 1200.00,
        "rainfall_mm": 78.00,
        "evacuated_count": 0,
        "affected_people_count": 120,  # 30 KK * 4 jiwa
        "shelter_count": 1,
        "status": "selesai",
        "description": "Rumah warga yang terendam sebanyak 30 KK di sepanjang jalan paving 300 meter akibat luapan sungai Bengawan Solo.",
    },
    {
        "no": 11,
        "date_str": "2025-02-26 09:00:00",
        "title": "Banjir Bengawan Solo: Luapan Kalisari & Warga Terisolir",
        "category": "awas",
        "village_name": "Desa Kalisari",
        "affected_villages": "Kalisari",
        "water_level_m": 1.10,
        "discharge_m3s": 1650.00,
        "rainfall_mm": 132.00,
        "evacuated_count": 60,
        "affected_people_count": 1080,  # 270 KK * 4 jiwa
        "shelter_count": 2,
        "status": "selesai",
        "description": "Rumah terdampak 270 KK dengan 207 KK terisolir. Fasum tergenang: 2 TK/PAUD, 1 SD, 1 Masjid. Sawah terendam 215 Ha dan jalan lingkungan terendam sepanjang 5.200 meter.",
    },
    {
        "no": 12,
        "date_str": "2025-02-26 09:30:00",
        "title": "Banjir Bengawan Solo: Luapan Permukiman Lebaksari",
        "category": "waspada",
        "village_name": "Desa Lebaksari",
        "affected_villages": "Lebaksari (RT 01, 02, 03, 06 RW 02)",
        "water_level_m": 0.50,
        "discharge_m3s": 1180.00,
        "rainfall_mm": 70.00,
        "evacuated_count": 0,
        "affected_people_count": 20,  # 5 Rumah * 4 jiwa
        "shelter_count": 0,
        "status": "selesai",
        "description": "RT 01, 02, 03, 06 RW 02 terendam. 5 rumah warga tergenang rata-rata 50 cm a.n.: Nyoto Amin, Masi'ah, Murip, Muhammad Nisar, Naful Rojib, Ngatemi.",
    },
    {
        "no": 13,
        "date_str": "2025-02-26 10:00:00",
        "title": "Banjir Bengawan Solo: Luapan Tanggungan",
        "category": "siaga",
        "village_name": "Desa Tanggungan",
        "affected_villages": "Tanggungan",
        "water_level_m": 0.60,
        "discharge_m3s": 1340.00,
        "rainfall_mm": 88.00,
        "evacuated_count": 15,
        "affected_people_count": 468,  # 117 KK * 4 jiwa
        "shelter_count": 1,
        "status": "selesai",
        "description": "Rumah yang terdampak sebanyak 117 KK. Tanaman padi sawah siap panen terendam seluas 15 Ha akibat luapan Bengawan Solo.",
    },
]


def seed_and_export():
    db = SessionLocal()
    try:
        # Peta Desa ID
        villages = {v.name: v.id for v in db.query(Village).all()}
        
        # 1. Bersihkan data dummy lama jika ada, atau tambahkan data riil
        print("--- Memulai Injeksi Data Riil Kejadian Banjir BPBD Baureno ---")
        
        inserted_incidents = []
        for item in REAL_FLOOD_DATA:
            v_id = villages.get(item["village_name"])
            dt = datetime.strptime(item["date_str"], "%Y-%m-%d %H:%M:%S")

            # Periksa apakah sudah ada rekaman dengan judul dan waktu yang sama
            existing = (
                db.query(FloodIncident)
                .filter(
                    FloodIncident.title == item["title"],
                    FloodIncident.event_date == dt,
                )
                .first()
            )

            if not existing:
                incident = FloodIncident(
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    village_id=v_id,
                    affected_villages=item["affected_villages"],
                    water_level_m=item["water_level_m"],
                    discharge_m3s=item["discharge_m3s"],
                    rainfall_mm=item["rainfall_mm"],
                    evacuated_count=item["evacuated_count"],
                    affected_people_count=item["affected_people_count"],
                    shelter_count=item["shelter_count"],
                    event_date=dt,
                    status=item["status"],
                    is_archived=True,
                )
                db.add(incident)
                db.commit()
                db.refresh(incident)
                inserted_incidents.append(incident)
                print(f"✅ Ditambahkan [ID={incident.id}]: {incident.title} ({incident.event_date.strftime('%d-%m-%Y')})")
            else:
                inserted_incidents.append(existing)
                print(f"ℹ️ Sudah ada [ID={existing.id}]: {existing.title}")

        # 2. Buat Berkas CSV Resmi
        csv_filename = "data_real_banjir_baureno_2023_2025.csv"
        with open(csv_filename, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, delimiter=",", quoting=csv.QUOTE_MINIMAL)
            writer.writerow([
                "ID",
                "Judul Kejadian",
                "Kategori",
                "Waktu Kejadian",
                "Desa Utama",
                "Desa Terdampak",
                "TMA (mdpl)",
                "Debit Sungai (m3/s)",
                "Curah Hujan (mm)",
                "Jumlah Dievakuasi (jiwa)",
                "Warga Terdampak (jiwa)",
                "Posko Aktif",
                "Status",
                "Deskripsi",
            ])

            for inc in inserted_incidents:
                v_name = inc.village.name if inc.village else "-"
                writer.writerow([
                    inc.id,
                    inc.title,
                    inc.category,
                    inc.event_date.strftime("%Y-%m-%d %H:%M") if inc.event_date else "-",
                    v_name,
                    inc.affected_villages or "-",
                    f"{float(inc.water_level_m):.2f}" if inc.water_level_m is not None else "-",
                    f"{float(inc.discharge_m3s):.2f}" if inc.discharge_m3s is not None else "-",
                    f"{float(inc.rainfall_mm):.2f}" if inc.rainfall_mm is not None else "-",
                    inc.evacuated_count,
                    inc.affected_people_count,
                    inc.shelter_count,
                    inc.status,
                    inc.description or "-",
                ])

        print(f"\n🎉 Berkas CSV resmi berhasil dibuat: {csv_filename} ({len(inserted_incidents)} baris)")

    finally:
        db.close()


if __name__ == "__main__":
    seed_and_export()
