"""
Router: Emergency Status — manajemen Mode Evakuasi Darurat per desa.

Endpoints:
  GET    /emergency/active          — Daftar desa yang sedang dalam mode darurat
  GET    /emergency/history         — Riwayat semua aktivasi/deaktivasi darurat
  GET    /emergency/{village_id}    — Status darurat satu desa tertentu
  POST   /emergency/{village_id}/activate   — (Admin) Aktifkan mode darurat manual
  POST   /emergency/{village_id}/deactivate — (Admin) Nonaktifkan mode darurat
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..core.timezone import get_wib_now
from ..core.database import get_db
from ..core.deps import get_current_admin_user, get_current_active_user
from ..models.emergency_status import EmergencyStatus
from ..models.village import Village
from ..models.user import User
from ..models.notification import Notification
from ..services.notifier import broadcast_emergency_status, broadcast_flood_alert, create_emergency_notifications
from ..services.ws_manager import ws_manager
from ..services.audit_service import record_emergency_action

from fastapi import File, UploadFile
import os
import uuid

router = APIRouter(prefix="/emergency", tags=["Emergency Status"])

# === Konstanta Upload Foto Darurat ===
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIR_EMERGENCY = "uploads/emergency"
CHUNK_SIZE = 1024 * 64  # 64 KB per chunk


async def _save_emergency_photo(file: UploadFile) -> str:
    """
    Helper internal: validasi & simpan foto situasi darurat.
    Membaca secara streaming agar tidak membebani memori.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format file '{file.filename}' tidak didukung. "
                   "Harap unggah foto format JPG, PNG, atau WEBP.",
        )

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"

    filename = (
        f"emergency_{datetime.now().strftime('%Y%m%d_%H%M%S')}_"
        f"{uuid.uuid4().hex[:8]}{ext}"
    )

    os.makedirs(UPLOAD_DIR_EMERGENCY, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR_EMERGENCY, filename)

    total_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE_BYTES:
                    f.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ukuran file '{file.filename}' melebihi batas "
                               f"maksimal {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan file: {str(exc)}",
        )

    return f"/uploads/emergency/{filename}"


@router.post("/upload-photo")
async def upload_emergency_photo(
    file: UploadFile = File(..., description="Foto situasi darurat (JPG/PNG/WEBP, maks 10MB)"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Unggah foto situasi darurat (kondisi banjir, kerusakan, dll).
    
    - **Format**: JPG, PNG, WEBP
    - **Ukuran maksimal**: 10 MB
    - **Response**: URL foto yang tersimpan di server.
    """
    photo_url = await _save_emergency_photo(file)
    return {"photo_url": photo_url, "uploaded_by": current_user.id}


@router.post("/upload-photos")
async def upload_emergency_photos(
    files: list[UploadFile] = File(..., description="Beberapa foto situasi darurat (maks 5 file, maks 10MB per file)"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Unggah beberapa foto situasi darurat sekaligus (multipart form-data).
    
    - **Format**: JPG, PNG, WEBP
    - **Ukuran maksimal**: 10 MB per file
    - **Jumlah maksimal**: 5 file
    - **Response**: Array URL foto yang tersimpan.
    """
    MAX_FILES = 5
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maksimal {MAX_FILES} foto per unggahan.",
        )

    photo_urls = []
    for file in files:
        url = await _save_emergency_photo(file)
        photo_urls.append(url)

    return {"photo_urls": photo_urls, "count": len(photo_urls), "uploaded_by": current_user.id}



# --- Schemas ---
class EmergencyStatusResponse(BaseModel):
    id: int
    village_id: int
    is_emergency_active: bool
    trigger_type: str
    triggered_by: Optional[int] = None
    probability_at_trigger: Optional[float] = None
    notes: Optional[str] = None
    activated_at: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VillageEmergencyInfo(BaseModel):
    village_id: int
    village_name: str
    is_emergency_active: bool
    current_risk_level: str
    current_probability: float
    emergency_since: Optional[datetime] = None
    trigger_type: Optional[str] = None
    triggered_by_name: Optional[str] = None
    notes: Optional[str] = None


class ActivateRequest(BaseModel):
    notes: Optional[str] = None


class DeactivateRequest(BaseModel):
    notes: Optional[str] = None


# --- Removed _create_emergency_notifications ---


# --- Endpoints ---

@router.get("/active", response_model=List[VillageEmergencyInfo])
def get_active_emergencies(db: Session = Depends(get_db)):
    """Mengambil daftar semua desa yang saat ini sedang dalam mode darurat."""
    active_records = (
        db.query(EmergencyStatus)
        .filter(EmergencyStatus.is_emergency_active == True)
        .all()
    )

    result = []
    for record in active_records:
        village = db.query(Village).filter(Village.id == record.village_id).first()
        triggered_user = None
        if record.triggered_by:
            user = db.query(User).filter(User.id == record.triggered_by).first()
            triggered_user = user.full_name if user else None

        result.append(VillageEmergencyInfo(
            village_id=record.village_id,
            village_name=village.name if village else f"Village #{record.village_id}",
            is_emergency_active=True,
            current_risk_level=village.current_risk_level if village else "rendah",
            current_probability=float(village.current_probability) if village else 0.0,
            emergency_since=record.activated_at,
            trigger_type=record.trigger_type,
            triggered_by_name=triggered_user,
            notes=record.notes,
        ))

    return result


@router.get("/history", response_model=List[EmergencyStatusResponse])
def get_emergency_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """(Admin) Mengambil riwayat semua aktivasi/deaktivasi darurat."""
    records = (
        db.query(EmergencyStatus)
        .order_by(EmergencyStatus.activated_at.desc())
        .limit(limit)
        .all()
    )
    return records


@router.get("/{village_id}", response_model=VillageEmergencyInfo)
def get_village_emergency_status(village_id: int, db: Session = Depends(get_db)):
    """Mengambil status darurat saat ini untuk satu desa."""
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Desa tidak ditemukan")

    active_record = (
        db.query(EmergencyStatus)
        .filter(
            EmergencyStatus.village_id == village_id,
            EmergencyStatus.is_emergency_active == True,
        )
        .first()
    )

    triggered_user = None
    if active_record and active_record.triggered_by:
        user = db.query(User).filter(User.id == active_record.triggered_by).first()
        triggered_user = user.full_name if user else None

    return VillageEmergencyInfo(
        village_id=village.id,
        village_name=village.name,
        is_emergency_active=active_record is not None,
        current_risk_level=village.current_risk_level or "rendah",
        current_probability=float(village.current_probability or 0),
        emergency_since=active_record.activated_at if active_record else None,
        trigger_type=active_record.trigger_type if active_record else None,
        triggered_by_name=triggered_user,
        notes=active_record.notes if active_record else None,
    )


@router.post("/{village_id}/activate", response_model=EmergencyStatusResponse)
async def activate_emergency(
    village_id: int,
    body: ActivateRequest = ActivateRequest(),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Aktifkan Mode Evakuasi Darurat di desa secara manual.
    Akan mengirim notifikasi ke semua warga di desa tersebut.
    """
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Desa tidak ditemukan")

    # Cek apakah sudah ada emergency aktif
    existing = (
        db.query(EmergencyStatus)
        .filter(
            EmergencyStatus.village_id == village_id,
            EmergencyStatus.is_emergency_active == True,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Mode darurat di Desa {village.name} sudah aktif sejak {existing.activated_at}.",
        )

    # Buat record emergency baru
    emergency = EmergencyStatus(
        village_id=village_id,
        is_emergency_active=True,
        trigger_type="manual_admin",
        triggered_by=current_admin.id,
        probability_at_trigger=village.current_probability,
        notes=body.notes or f"Diaktifkan manual oleh {current_admin.full_name}",
        activated_at=get_wib_now(),
    )
    db.add(emergency)
    db.flush()

    # Simpan notifikasi ke database untuk semua user terdampak
    create_emergency_notifications(
        db=db,
        village_id=village.id,
        village_name=village.name,
        probability=float(village.current_probability or 0),
        is_active=True,
        trigger_name=current_admin.full_name
    )

    # Catat Audit Log
    record_emergency_action(
        db=db,
        admin=current_admin,
        village_id=village.id,
        village_name=village.name,
        is_active=True,
        notes=body.notes or f"Diaktifkan manual oleh {current_admin.full_name}",
    )

    db.commit()
    db.refresh(emergency)

    # Broadcast via WebSocket
    await broadcast_emergency_status(
        village_name=village.name,
        village_id=village.id,
        is_active=True,
    )

    return emergency


@router.post("/{village_id}/deactivate", response_model=EmergencyStatusResponse)
async def deactivate_emergency(
    village_id: int,
    body: DeactivateRequest = DeactivateRequest(),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Nonaktifkan Mode Evakuasi Darurat di desa.
    Akan mengirim notifikasi bahwa situasi telah terkendali.
    """
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Desa tidak ditemukan")

    # Cari emergency aktif
    active = (
        db.query(EmergencyStatus)
        .filter(
            EmergencyStatus.village_id == village_id,
            EmergencyStatus.is_emergency_active == True,
        )
        .first()
    )
    if not active:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak ada mode darurat aktif di Desa {village.name}.",
        )

    # Nonaktifkan
    active.is_emergency_active = False
    active.deactivated_at = get_wib_now()
    active.notes = (active.notes or "") + f" | Dinonaktifkan oleh {current_admin.full_name}"
    if body.notes:
        active.notes += f": {body.notes}"

    # Simpan notifikasi
    create_emergency_notifications(
        db=db,
        village_id=village.id,
        village_name=village.name,
        probability=float(village.current_probability or 0),
        is_active=False,
        trigger_name=current_admin.full_name
    )

    # Catat Audit Log
    record_emergency_action(
        db=db,
        admin=current_admin,
        village_id=village.id,
        village_name=village.name,
        is_active=False,
        notes=body.notes or f"Dinonaktifkan oleh {current_admin.full_name}",
    )

    db.commit()
    db.refresh(active)

    # Broadcast via WebSocket
    await broadcast_emergency_status(
        village_name=village.name,
        village_id=village.id,
        is_active=False,
    )

    return active


class EmergencyTogglePayload(BaseModel):
    village_id: int
    is_emergency_active: bool = True
    action: Optional[str] = None  # "activate" | "deactivate"
    notes: Optional[str] = None
    trigger_type: Optional[str] = "manual_admin"


@router.post("", response_model=EmergencyStatusResponse)
async def post_emergency_status(
    payload: EmergencyTogglePayload,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Aktivasi / Deaktivasi mode darurat desa sesuai PRD Table III (POST /api/emergency).
    """
    if payload.action == "deactivate" or payload.is_emergency_active is False:
        req = DeactivateRequest(notes=payload.notes)
        return await deactivate_emergency(village_id=payload.village_id, body=req, db=db, current_admin=current_admin)
    else:
        existing = db.query(EmergencyStatus).filter(
            EmergencyStatus.village_id == payload.village_id,
            EmergencyStatus.is_emergency_active == True,
        ).first()
        if existing:
            return existing
        req = ActivateRequest(notes=payload.notes or f"Diaktifkan manual oleh {current_admin.full_name}")
        return await activate_emergency(village_id=payload.village_id, body=req, db=db, current_admin=current_admin)


