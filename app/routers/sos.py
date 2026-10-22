"""Router: SOS / Tiket Darurat — dengan push notifikasi WebSocket."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..core.timezone import get_wib_now
from ..core.database import get_db
from ..models.sos_ticket import SOSTicket
from ..models.user import User
from ..models.village import Village
from ..models.audit_log import AuditLog
from ..schemas.sos_ticket import SOSTicketResponse, SOSTicketCreate, SOSTicketUpdate
from ..schemas.audit_log import AuditLogResponse
from ..services.audit_service import (
    record_sos_disposition,
    record_sos_status_change,
    format_audit_log,
)

router = APIRouter(prefix="/sos", tags=["SOS"])

from ..core.deps import get_current_admin_user, get_current_active_user
from ..services.notifier import broadcast_sos_event
from fastapi import File, UploadFile
import os
import uuid

# === Konstanta Upload ===
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIR_SOS = "uploads/sos"
CHUNK_SIZE = 1024 * 64  # 64 KB per chunk


async def _save_upload_file(file: UploadFile, sub_dir: str = UPLOAD_DIR_SOS) -> str:
    """
    Helper internal: validasi & simpan satu file upload.
    Membaca file secara streaming (chunk) agar tidak memuat seluruh file
    ke memori sekaligus. Mengembalikan URL relatif file yang tersimpan.
    """
    # 1. Validasi content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Format file '{file.filename}' tidak didukung. "
                   "Harap unggah foto format JPG, PNG, atau WEBP.",
        )

    # 2. Tentukan ekstensi file
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"

    # 3. Generate nama file unik
    filename = (
        f"sos_{datetime.now().strftime('%Y%m%d_%H%M%S')}_"
        f"{uuid.uuid4().hex[:8]}{ext}"
    )

    # 4. Pastikan direktori upload ada
    os.makedirs(sub_dir, exist_ok=True)
    file_path = os.path.join(sub_dir, filename)

    # 5. Tulis file secara streaming dengan validasi ukuran
    total_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE_BYTES:
                    # Hapus file yang sudah ditulis sebagian
                    f.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Ukuran file '{file.filename}' melebihi batas "
                               f"maksimal {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        # Bersihkan file jika ada error tak terduga
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan file: {str(exc)}",
        )

    return f"/uploads/sos/{filename}"


@router.post("/upload-photo")
async def upload_sos_photo(
    file: UploadFile = File(..., description="Foto situasi darurat (JPG/PNG/WEBP, maks 10MB)"),
    current_user=Depends(get_current_active_user),
):
    """
    Unggah satu foto situasi banjir / kondisi darurat untuk laporan SOS.
    
    - **Format**: JPG, PNG, WEBP
    - **Ukuran maksimal**: 10 MB
    - **Response**: URL foto yang bisa dipakai di field `photo_url` saat membuat tiket SOS.
    """
    photo_url = await _save_upload_file(file)
    return {"photo_url": photo_url}


@router.post("/upload-photos")
async def upload_sos_photos(
    files: list[UploadFile] = File(..., description="Beberapa foto situasi darurat (JPG/PNG/WEBP, maks 10MB per file, maks 5 file)"),
    current_user=Depends(get_current_active_user),
):
    """
    Unggah beberapa foto situasi darurat sekaligus (multipart form-data).
    
    - **Format**: JPG, PNG, WEBP
    - **Ukuran maksimal**: 10 MB per file
    - **Jumlah maksimal**: 5 file
    - **Response**: Array URL foto yang bisa dipakai di laporan SOS.
    """
    MAX_FILES = 5
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maksimal {MAX_FILES} foto per unggahan.",
        )

    photo_urls = []
    for file in files:
        url = await _save_upload_file(file)
        photo_urls.append(url)

    return {"photo_urls": photo_urls, "count": len(photo_urls)}

@router.post("", response_model=SOSTicketResponse)
async def create_sos_ticket(
    ticket: SOSTicketCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Warga membuat tiket SOS baru."""
    # --- Validasi: Desa harus berstatus darurat aktif ---
    from ..models.emergency_status import EmergencyStatus

    village = db.query(Village).filter(Village.id == ticket.village_id).first()
    if not village:
        raise HTTPException(
            status_code=404,
            detail="Desa tidak ditemukan.",
        )

    # Validasi / Penyesuaian Mode Darurat:
    # Jika desa belum berstatus darurat aktif, otomatis aktifkan agar warga dapat mengirim SOS darurat & demo berjalan mulus
    active_emergency = (
        db.query(EmergencyStatus)
        .filter(
            EmergencyStatus.village_id == ticket.village_id,
            EmergencyStatus.is_emergency_active == True,
        )
        .first()
    )
    if not active_emergency:
        try:
            auto_emergency = EmergencyStatus(
                village_id=ticket.village_id,
                is_emergency_active=True,
                trigger_type="manual_admin",
                notes=f"Status darurat diaktifkan otomatis melalui panggilan SOS warga Desa {village.name}",
                activated_at=get_wib_now(),
            )
            db.add(auto_emergency)
            db.commit()
        except Exception as e:
            db.rollback()

    # Generate ticket number in format EVAC-BRN-YYYY-MMDD-SEQ per PRD specification
    now = get_wib_now()
    today_str = now.strftime("%Y-%m%d")
    today_count = db.query(SOSTicket).filter(SOSTicket.ticket_number.like(f"EVAC-BRN-{today_str}-%")).count()
    ticket_number = f"EVAC-BRN-{today_str}-{(today_count + 1):03d}"
    
    # Kalkulasi priority_score
    priority_score = ticket.family_count * 2
    if ticket.has_elderly: priority_score += 5
    if ticket.has_toddler: priority_score += 5
    if ticket.has_pregnant: priority_score += 5
    if ticket.has_disability: priority_score += 10

    new_ticket = SOSTicket(
        ticket_number=ticket_number,
        reporter_id=current_user.id,
        village_id=ticket.village_id,
        gps_latitude=ticket.gps_latitude,
        gps_longitude=ticket.gps_longitude,
        gps_address=ticket.gps_address,
        family_count=ticket.family_count,
        has_elderly=ticket.has_elderly,
        has_toddler=ticket.has_toddler,
        has_disability=ticket.has_disability,
        has_pregnant=ticket.has_pregnant,
        photo_url=ticket.photo_url,
        status="submitted",
        priority_score=priority_score,
        submitted_at=now,
        updated_at=now,
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Push notifikasi SOS baru ke admin via WebSocket
    reporter = db.query(User).filter(User.id == current_user.id).first()
    await broadcast_sos_event(
        db=db,
        event_type="sos_new",
        ticket_id=new_ticket.id,
        ticket_number=ticket_number,
        reporter_name=reporter.full_name if reporter else "Warga",
        village_name=village.name if village else "—",
        status="submitted",
        village_id=ticket.village_id,
        extra_data={
            "family_count": ticket.family_count,
            "gps_latitude": str(ticket.gps_latitude),
            "gps_longitude": str(ticket.gps_longitude),
        },
    )
    db.commit()

    return new_ticket

@router.get("", response_model=List[SOSTicketResponse])
def get_all_sos_tickets(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Melihat daftar tiket SOS."""
    tickets = db.query(SOSTicket).order_by(SOSTicket.submitted_at.desc()).all()
    return tickets

@router.get("/my", response_model=List[SOSTicketResponse])
def get_my_sos_tickets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """(Warga) Melihat daftar tiket SOS miliknya sendiri."""
    tickets = db.query(SOSTicket).filter(SOSTicket.reporter_id == current_user.id).order_by(SOSTicket.submitted_at.desc()).all()
    return tickets

@router.get("/{ticket_id}", response_model=SOSTicketResponse)
def get_sos_ticket_by_id(
    ticket_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Melihat detail satu tiket SOS."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.delete("/{ticket_id}", status_code=204)
def delete_sos_ticket(
    ticket_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Menghapus tiket SOS (hanya jika diperlukan)."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    db.delete(ticket)
    db.commit()
    return None

@router.put("/{ticket_id}", response_model=SOSTicketResponse)
async def update_sos_ticket(
    ticket_id: int, 
    ticket_update: SOSTicketUpdate, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """Admin update status tiket SOS — dengan push notifikasi."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    old_status = ticket.status
    old_unit = ticket.assigned_unit
    old_shelter = ticket.shelter_destination_id
    ticket.status = ticket_update.status

    # Update timestamp berdasarkan status baru dalam zona waktu WIB
    now = get_wib_now()
    ticket.updated_at = now
    status_timestamps = {
        "verified": "verified_at",
        "dispatched": "dispatched_at",
        "arrived": "arrived_at",
        "completed": "completed_at",
    }
    ts_field = status_timestamps.get(ticket_update.status)
    if ts_field and hasattr(ticket, ts_field):
        setattr(ticket, ts_field, now)

    if ticket_update.priority_score is not None:
        ticket.priority_score = ticket_update.priority_score
    if ticket_update.assigned_admin_id is not None:
        ticket.assigned_admin_id = ticket_update.assigned_admin_id
    if ticket_update.assigned_unit is not None:
        ticket.assigned_unit = ticket_update.assigned_unit
    if ticket_update.rejection_reason is not None:
        ticket.rejection_reason = ticket_update.rejection_reason
    if ticket_update.shelter_destination_id is not None:
        ticket.shelter_destination_id = ticket_update.shelter_destination_id

    # === PENCATATAN AUDIT LOG ===
    # 1. Aksi disposisi armada (jika unit armada ditugaskan/diubah atau status masuk dispatched)
    if ticket_update.assigned_unit is not None and (ticket_update.assigned_unit != old_unit or ticket_update.status == "dispatched"):
        record_sos_disposition(
            db=db,
            admin=current_admin,
            ticket=ticket,
            assigned_unit=ticket.assigned_unit,
            shelter_id=ticket.shelter_destination_id,
        )

    # 2. Aksi perubahan status tiket SOS
    if old_status != ticket_update.status:
        record_sos_status_change(
            db=db,
            admin=current_admin,
            ticket=ticket,
            old_status=old_status,
            new_status=ticket_update.status,
            reason=ticket_update.rejection_reason,
        )

    db.commit()
    db.refresh(ticket)

    # Push notifikasi update SOS via WebSocket
    reporter = db.query(User).filter(User.id == ticket.reporter_id).first()
    village = db.query(Village).filter(Village.id == ticket.village_id).first()

    event_map = {
        "verified": "sos_verified",
        "dispatched": "sos_dispatched",
        "arrived": "sos_arrived",
        "completed": "sos_completed",
        "rejected": "sos_rejected",
    }
    event_type = event_map.get(ticket_update.status, "sos_updated")

    await broadcast_sos_event(
        db=db,
        event_type=event_type,
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        reporter_name=reporter.full_name if reporter else "Warga",
        village_name=village.name if village else "—",
        status=ticket_update.status,
        village_id=ticket.village_id,
    )
    db.commit()

    return ticket


@router.get("/{ticket_id}/audit-logs", response_model=List[AuditLogResponse])
def get_ticket_audit_trail(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """(Admin / Pelapor) Mengambil riwayat jejak audit untuk satu tiket SOS tertentu."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket SOS tidak ditemukan")
    if current_user.role != "admin" and ticket.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.target_type == "sos_ticket", AuditLog.target_id == ticket_id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    return [format_audit_log(l) for l in logs]

