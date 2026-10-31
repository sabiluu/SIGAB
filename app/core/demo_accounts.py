"""
Akun demo SIGAB — dibuat otomatis saat server start (idempoten).

Tujuan: penguji / dosen / teman bisa langsung mencoba tanpa perlu mendaftar.
Matikan dengan environment variable SEED_DEMO_ACCOUNTS=false (disarankan di produksi sungguhan).
"""

import logging
import os

from .database import SessionLocal
from .security import hash_password
from ..models.user import User
from ..models.village import Village

logger = logging.getLogger(__name__)

# (nama, email, password, role, nama desa)
# Dua akun pertama = akun yang terisi otomatis di form login (tombol "Akun Uji Coba").
DEMO_ACCOUNTS = [
    ("Petugas Demo BPBD", "admin@bpbd.go.id", "admin123", "admin", None),
    ("Ahmadi", "warga@baureno.id", "warga123", "user", "Baureno"),
    ("Warga Demo 1", "warga1@sigab.demo", "demo1234", "user", "Gajah"),
    ("Warga Demo 2", "warga2@sigab.demo", "demo1234", "user", "Kalisari"),
    ("Warga Demo 3", "warga3@sigab.demo", "demo1234", "user", "Sumuragung"),
    ("Warga Demo 4", "warga4@sigab.demo", "demo1234", "user", "Kedungrejo"),
    ("Warga Demo 5", "warga5@sigab.demo", "demo1234", "user", "Gunungsari"),
]


def _find_village_id(db, name):
    if not name:
        return None
    village = (
        db.query(Village)
        .filter((Village.name == name) | (Village.name == f"Desa {name}"))
        .first()
    )
    return village.id if village else None


def seed_demo_accounts():
    if os.getenv("SEED_DEMO_ACCOUNTS", "true").strip().lower() in ("0", "false", "no"):
        return

    db = SessionLocal()
    try:
        created = 0
        for full_name, email, password, role, village_name in DEMO_ACCOUNTS:
            if db.query(User).filter(User.email == email).first():
                continue
            db.add(
                User(
                    full_name=full_name,
                    email=email,
                    phone="081234567890",
                    password_hash=hash_password(password),
                    role=role,
                    village_id=_find_village_id(db, village_name),
                    is_active=True,
                )
            )
            created += 1
        if created:
            db.commit()
            logger.info("Akun demo dibuat: %d", created)
    except Exception as exc:  # jangan gagalkan startup server
        db.rollback()
        logger.warning("Gagal membuat akun demo: %s", exc)
    finally:
        db.close()
