"""Router: SOS / Tiket Darurat — dengan push notifikasi WebSocket."""

import csv
import io
import re
from fastapi import APIRouter, Depends, HTTPException, Query, Response, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
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

    # Kalkulasi priority_score sesuai PRD Persamaan (5):
    # P_SOS = 10 * N_jiwa + 25 * I_lansia + 25 * I_balita + 30 * I_disabilitas + 20 * I_hamil
    family_cnt = max(1, ticket.family_count if ticket.family_count is not None else 1)
    priority_score = family_cnt * 10
    if ticket.has_elderly:
        priority_score += 25
    if ticket.has_toddler:
        priority_score += 25
    if ticket.has_disability:
        priority_score += 30
    if ticket.has_pregnant:
        priority_score += 20

    # Generate ticket number in format EVAC-BRN-YYYY-MMDD-SEQ per PRD specification
    # Dilengkapi sequential detection, gap protection, dan retry loop collision handling saat lonjakan darurat
    now = get_wib_now()
    today_str = now.strftime("%Y-%m%d")
    prefix = f"EVAC-BRN-{today_str}-"
    MAX_RETRIES = 5
    new_ticket = None

    for attempt in range(MAX_RETRIES):
        # Dapatkan tiket hari ini untuk mencari sequence angka tertinggi secara numerik
        today_tickets = (
            db.query(SOSTicket.ticket_number)
            .filter(SOSTicket.ticket_number.like(f"{prefix}%"))
            .all()
        )
        max_seq = 0
        for row in today_tickets:
            if row and row[0] and row[0].startswith(prefix):
                raw_seq = row[0][len(prefix):].split("-")[0]
                try:
                    val = int(raw_seq)
                    if val > max_seq:
                        max_seq = val
                except (ValueError, TypeError):
                    continue

        candidate_seq = max(max_seq + 1, len(today_tickets) + 1) + attempt
        candidate_ticket_number = f"{prefix}{candidate_seq:03d}"

        # Pastikan tidak tabrakan dengan nomor yang telah terdaftar
        while db.query(SOSTicket).filter(SOSTicket.ticket_number == candidate_ticket_number).first():
            candidate_seq += 1
            candidate_ticket_number = f"{prefix}{candidate_seq:03d}"

        new_ticket = SOSTicket(
            ticket_number=candidate_ticket_number,
            reporter_id=current_user.id,
            village_id=ticket.village_id,
            gps_latitude=ticket.gps_latitude,
            gps_longitude=ticket.gps_longitude,
            gps_address=ticket.gps_address,
            family_count=family_cnt,
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

        try:
            db.add(new_ticket)
            db.commit()
            db.refresh(new_ticket)
            break
        except IntegrityError:
            db.rollback()
            if attempt == MAX_RETRIES - 1:
                # Fallback darurat jika ada konkurensi ekstrem simultan
                fallback_suffix = uuid.uuid4().hex[:4].upper()
                candidate_ticket_number = f"{prefix}{candidate_seq:03d}-{fallback_suffix}"
                new_ticket.ticket_number = candidate_ticket_number
                db.add(new_ticket)
                db.commit()
                db.refresh(new_ticket)
                break

    # Push notifikasi SOS baru ke admin via WebSocket
    reporter = db.query(User).filter(User.id == current_user.id).first()
    await broadcast_sos_event(
        db=db,
        event_type="sos_new",
        ticket_id=new_ticket.id,
        ticket_number=new_ticket.ticket_number,
        reporter_name=reporter.full_name if reporter else "Warga",
        village_name=village.name if village else "—",
        status="submitted",
        village_id=ticket.village_id,
        extra_data={
            "family_count": new_ticket.family_count,
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


@router.get("/export")
def export_sos_tickets_csv(
    status: Optional[str] = Query(None, description="Filter status tiket: submitted, verified, dispatched, on_route, arrived, completed, rejected, atau semua"),
    village_id: Optional[int] = Query(None, description="Filter desa domisili pelapor"),
    has_vulnerable: Optional[bool] = Query(None, description="Hanya tiket dengan kelompok rentan (lansia/balita/bumil/disabilitas)"),
    start_date: Optional[datetime] = Query(None, description="Rentang tanggal awal"),
    end_date: Optional[datetime] = Query(None, description="Rentang tanggal akhir"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengekspor data tiket panggilan darurat SOS ke berkas CSV untuk rekapitulasi harian/bulanan BPBD."""
    query = db.query(SOSTicket)

    if status and status.strip().lower() != "semua":
        query = query.filter(SOSTicket.status == status.strip().lower())

    if village_id is not None:
        query = query.filter(SOSTicket.village_id == village_id)

    if has_vulnerable:
        query = query.filter(
            or_(
                SOSTicket.has_elderly == True,
                SOSTicket.has_toddler == True,
                SOSTicket.has_pregnant == True,
                SOSTicket.has_disability == True,
            )
        )

    if start_date is not None:
        query = query.filter(SOSTicket.submitted_at >= start_date)

    if end_date is not None:
        query = query.filter(SOSTicket.submitted_at <= end_date)

    tickets = query.order_by(SOSTicket.submitted_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "ID",
        "Nomor Tiket",
        "Waktu Lapor (WIB)",
        "Nama Pelapor",
        "No. HP Pelapor",
        "Desa Lokasi",
        "Alamat / Patokan",
        "Latitude",
        "Longitude",
        "Jumlah Jiwa KK",
        "Lansia",
        "Balita",
        "Ibu Hamil",
        "Disabilitas",
        "Skor Prioritas",
        "Status Terakhir",
        "Unit Ditugaskan",
        "Posko Tujuan",
        "Alasan Penolakan",
        "Waktu Verifikasi",
        "Waktu Diberangkatkan",
        "Waktu Tiba",
        "Waktu Selesai",
    ])

    for t in tickets:
        r_name = t.reporter.full_name if t.reporter else "-"
        r_phone = f"'{t.reporter.phone}" if (t.reporter and t.reporter.phone) else "-"
        v_name = t.village.name if t.village else "-"
        s_name = t.shelter_destination.name if t.shelter_destination else "-"

        writer.writerow([
            t.id,
            t.ticket_number,
            t.submitted_at.strftime("%Y-%m-%d %H:%M") if t.submitted_at else "-",
            r_name,
            r_phone,
            v_name,
            t.gps_address or "-",
            float(t.gps_latitude) if t.gps_latitude is not None else "-",
            float(t.gps_longitude) if t.gps_longitude is not None else "-",
            t.family_count,
            "Ya" if t.has_elderly else "Tidak",
            "Ya" if t.has_toddler else "Tidak",
            "Ya" if t.has_pregnant else "Tidak",
            "Ya" if t.has_disability else "Tidak",
            t.priority_score,
            t.status,
            t.assigned_unit or "-",
            s_name,
            t.rejection_reason or "-",
            t.verified_at.strftime("%Y-%m-%d %H:%M") if t.verified_at else "-",
            t.dispatched_at.strftime("%Y-%m-%d %H:%M") if t.dispatched_at else "-",
            t.arrived_at.strftime("%Y-%m-%d %H:%M") if t.arrived_at else "-",
            t.completed_at.strftime("%Y-%m-%d %H:%M") if t.completed_at else "-",
        ])

    filename = f"laporan_tiket_sos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{ticket_id}", response_model=SOSTicketResponse)
def get_sos_ticket_by_id(
    ticket_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """(Admin / Pelapor) Melihat detail satu tiket SOS."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role != "admin" and ticket.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Akses ditolak")
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
@router.patch("/{ticket_id}", response_model=SOSTicketResponse)
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

