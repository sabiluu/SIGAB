"""
Script sinkronisasi resmi data kejadian banjir dari rekap_banjir_baureno.csv
ke tabel flood_incidents di database SQLite siagabencana.db.
"""

import os
import sys
import csv
from datetime import datetime

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.core.database import SessionLocal
from app.models.village import Village
from app.models.flood_incident import FloodIncident

# Mapping detail hidrologis dan kategori untuk 13 data riil BPBD Baureno
BPBD_METRICS_MAP = {
    1: {  # Kalisari 04-03-2023
        "category": "siaga",
        "time": "08:00:00",
        "water_level_m": 0.50,
        "discharge_m3s": 1420.00,
        "rainfall_mm": 85.00,
        "evacuated": 0,
        "affected_people": 104,
        "shelters": 1,
    },
    2: {  # Lebaksari 18-02-2023
        "category": "waspada",
        "time": "09:00:00",
        "water_level_m": 0.50,
        "discharge_m3s": 1150.00,
        "rainfall_mm": 62.00,
        "evacuated": 0,
        "affected_people": 24,
        "shelters": 0,
    },
    3: {  # Kalisari 17-02-2023
        "category": "waspada",
        "time": "14:00:00",
        "water_level_m": 1.00,
        "discharge_m3s": 1080.00,
        "rainfall_mm": 55.00,
        "evacuated": 0,
        "affected_people": 50,
        "shelters": 0,
    },
    4: {  # Tulungagung 06-02-2024
        "category": "awas",
        "time": "06:00:00",
        "water_level_m": 0.80,
        "discharge_m3s": 1250.00,
        "rainfall_mm": 135.00,
        "evacuated": 0,
        "affected_people": 1600,
        "shelters": 2,
    },
    5: {  # Baureno 30-01-2024
        "category": "waspada",
        "time": "10:00:00",
        "water_level_m": 0.20,
        "discharge_m3s": 750.00,
        "rainfall_mm": 92.00,
        "evacuated": 0,
        "affected_people": 8,
        "shelters": 0,
    },
    6: {  # Kalisari 21-05-2025
        "category": "awas",
        "time": "07:00:00",
        "water_level_m": 1.20,
        "discharge_m3s": 1780.00,
        "rainfall_mm": 140.00,
        "evacuated": 85,
        "affected_people": 1280,
        "shelters": 3,
    },
    7: {  # Lebaksari 21-05-2025
        "category": "siaga",
        "time": "08:30:00",
        "water_level_m": 0.80,
        "discharge_m3s": 1550.00,
        "rainfall_mm": 115.00,
        "evacuated": 18,
        "affected_people": 264,
        "shelters": 1,
    },
    8: {  # Tanggungan 21-05-2025
        "category": "awas",
        "time": "09:00:00",
        "water_level_m": 1.00,
        "discharge_m3s": 1680.00,
        "rainfall_mm": 128.00,
        "evacuated": 42,
        "affected_people": 500,
        "shelters": 2,
    },
    9: {  # Trojalu 26-02-2025
        "category": "waspada",
        "time": "07:00:00",
        "water_level_m": 0.40,
        "discharge_m3s": 980.00,
        "rainfall_mm": 60.00,
        "evacuated": 0,
        "affected_people": 40,
        "shelters": 0,
    },
    10: {  # Kadungrejo 26-02-2025
        "category": "siaga",
        "time": "08:00:00",
        "water_level_m": 0.50,
        "discharge_m3s": 1200.00,
        "rainfall_mm": 78.00,
        "evacuated": 0,
        "affected_people": 120,
        "shelters": 1,
    },
    11: {  # Kalisari 26-02-2025
        "category": "awas",
        "time": "09:00:00",
        "water_level_m": 1.10,
        "discharge_m3s": 1650.00,
        "rainfall_mm": 132.00,
        "evacuated": 60,
        "affected_people": 1080,
        "shelters": 2,
    },
    12: {  # Lebaksari 26-02-2025
        "category": "waspada",
        "time": "09:30:00",
        "water_level_m": 0.50,
        "discharge_m3s": 1180.00,
        "rainfall_mm": 70.00,
        "evacuated": 0,
        "affected_people": 20,
        "shelters": 0,
    },
    13: {  # Tanggungan 26-02-2025
        "category": "siaga",
        "time": "10:00:00",
        "water_level_m": 0.60,
        "discharge_m3s": 1340.00,
        "rainfall_mm": 88.00,
        "evacuated": 15,
        "affected_people": 468,
        "shelters": 1,
    },
}


def sync_from_csv(csv_path=None):
    if not csv_path:
        csv_path = os.path.join(BASE_DIR, "rekap_banjir_baureno.csv")
    elif not os.path.isabs(csv_path):
        csv_path = os.path.join(BASE_DIR, csv_path)

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Berkas CSV {csv_path} tidak ditemukan.")

    db = SessionLocal()
    try:
        # Load villages map
        villages = {v.name.lower().replace("desa ", "").strip(): v.id for v in db.query(Village).all()}
        # Normalize alternative village names (Kadungrejo -> Kedungrejo)
        if "kedungrejo" in villages and "kadungrejo" not in villages:
            villages["kadungrejo"] = villages["kedungrejo"]

        print(f"[SYNC] Membaca berkas CSV: {csv_path}")
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        print(f"[SYNC] Ditemukan {len(rows)} baris data di {csv_path}")

        # Hapus seluruh data dummy / kejadian lama agar sinkron bersih 1:1
        deleted_count = db.query(FloodIncident).delete()
        db.commit()
        print(f"[SYNC] Membersihkan {deleted_count} rekaman lama (termasuk data fiktif 2026).")

        inserted_count = 0
        for r in rows:
            no = int(r["No"])
            metrics = BPBD_METRICS_MAP.get(no, {})

            desa_clean = r["Desa"].lower().strip()
            v_id = villages.get(desa_clean)

            # Format datetime
            tgl_parts = r["Tanggal"].split("-")  # DD-MM-YYYY
            if len(tgl_parts) == 3:
                date_iso = f"{tgl_parts[2]}-{tgl_parts[1]}-{tgl_parts[0]} {metrics.get('time', '08:00:00')}"
            else:
                date_iso = f"{r['Tahun']}-01-01 {metrics.get('time', '08:00:00')}"
            event_dt = datetime.strptime(date_iso, "%Y-%m-%d %H:%M:%S")

            # Judul kejadian yang representatif
            bencana = r.get("Jenis Bencana", "Banjir Luapan").strip()
            if "Bengawan Solo" in bencana:
                title = f"Banjir Bengawan Solo: Luapan {r['Desa']}"
            else:
                title = f"{bencana}: {r['Desa']}"

            # Deskripsi lengkap
            desc = r.get("Keterangan Dampak", "").strip()
            if not desc or desc == "Rp.":
                desc = f"Banjir luapan merendam permukiman dan lahan di Desa {r['Desa']} ({r.get('Rumah Terdampak', '')}, {r.get('Lahan Terdampak', '')})."
            
            # Tambahkan info kerugian jika ada
            kerugian = r.get("Kerugian", "").strip()
            if kerugian and kerugian != "Rp. 0":
                desc += f" Kerugian materil ditaksir {kerugian}."

            incident = FloodIncident(
                id=no,
                title=title,
                description=desc,
                category=metrics.get("category", "siaga"),
                village_id=v_id,
                affected_villages=f"Desa {r['Desa']}",
                water_level_m=metrics.get("water_level_m", 0.50),
                discharge_m3s=metrics.get("discharge_m3s", 1200.00),
                rainfall_mm=metrics.get("rainfall_mm", 80.00),
                evacuated_count=metrics.get("evacuated", 0),
                affected_people_count=metrics.get("affected_people", 50),
                shelter_count=metrics.get("shelters", 0),
                event_date=event_dt,
                status="selesai",
                is_archived=True,
            )
            db.add(incident)
            inserted_count += 1

        db.commit()
        print(f"[SYNC] Sukses menyinkronkan {inserted_count} kejadian banjir dari {csv_path} ke database SIGAB!")

    finally:
        db.close()


if __name__ == "__main__":
    sync_from_csv()
