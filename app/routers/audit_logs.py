"""
Router: Audit Log — pencatatan dan penelusuran riwayat aksi Admin
(Disposisi Armada, Perubahan Status SOS, dan Perubahan Status Darurat).
"""

import math
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from ..core.database import get_db
from ..core.deps import get_current_admin_user, get_current_active_user
from ..models.audit_log import AuditLog
from ..models.sos_ticket import SOSTicket
from ..models.user import User
from ..schemas.audit_log import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditLogStatsResponse,
)
from ..services.audit_service import (
    format_audit_log,
    compute_audit_stats,
)

router = APIRouter(prefix="/audit-logs", tags=["Audit Log"])


@router.get("/stats", response_model=AuditLogStatsResponse)
def get_audit_log_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil ringkasan statistik audit log."""
    return compute_audit_stats(db)


@router.get("", response_model=AuditLogListResponse)
def get_audit_logs(
    action_type: Optional[str] = Query(None, description="Filter tipe aksi: disposisi_armada, ubah_status_sos, emergency_activate, emergency_deactivate, atau semua"),
    target_type: Optional[str] = Query(None, description="Filter entitas target: sos_ticket, emergency_status"),
    admin_id: Optional[int] = Query(None, description="Filter ID admin pelaksana"),
    ticket_id: Optional[int] = Query(None, description="Filter ID tiket SOS"),
    ticket_number: Optional[str] = Query(None, description="Filter nomor tiket SOS (misal: EVAC-BRN-...)"),
    start_date: Optional[datetime] = Query(None, description="Rentang tanggal awal"),
    end_date: Optional[datetime] = Query(None, description="Rentang tanggal akhir"),
    search: Optional[str] = Query(None, description="Pencarian nama admin, catatan, unit armada, atau nomor tiket"),
    page: int = Query(1, ge=1, description="Nomor halaman (1-indexed)"),
    page_size: int = Query(20, ge=1, le=200, description="Jumlah data per halaman"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Mengambil daftar riwayat audit log aktivitas admin dengan filter dan pagination.
    Merekam aksi disposisi armada, perubahan status tiket SOS, dan status darurat.
    """
    query = db.query(AuditLog)

    if action_type and action_type.strip().lower() != "semua":
        query = query.filter(AuditLog.action_type == action_type.strip().lower())

    if target_type and target_type.strip():
        query = query.filter(AuditLog.target_type == target_type.strip().lower())

    if admin_id is not None:
        query = query.filter(AuditLog.admin_id == admin_id)

    if ticket_id is not None:
        query = query.filter(AuditLog.target_id == ticket_id, AuditLog.target_type == "sos_ticket")

    if ticket_number and ticket_number.strip():
        query = query.filter(AuditLog.ticket_number == ticket_number.strip())

    if start_date is not None:
        query = query.filter(AuditLog.created_at >= start_date)

    if end_date is not None:
        query = query.filter(AuditLog.created_at <= end_date)

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.admin_name.ilike(s),
                AuditLog.ticket_number.ilike(s),
                AuditLog.assigned_unit.ilike(s),
                AuditLog.notes.ilike(s),
                AuditLog.shelter_name.ilike(s),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    records = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [format_audit_log(r) for r in records]

    return AuditLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/ticket/{ticket_id}", response_model=List[AuditLogResponse])
def get_audit_logs_by_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mengambil seluruh riwayat jejak audit untuk satu tiket SOS tertentu
    (kapan diverifikasi, armada apa yang ditugaskan, perubahan status, dsb).
    Bisa diakses oleh Admin atau warga pemilik tiket tersebut.
    """
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


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil detail satu entri audit log."""
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log tidak ditemukan")
    return format_audit_log(log)
