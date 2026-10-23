"""
Service untuk pencatatan dan pengelolaan Audit Log aksi Admin
(Disposisi Armada, Perubahan Status SOS, dan Status Darurat).
"""

import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from ..models.audit_log import AuditLog
from ..models.sos_ticket import SOSTicket
from ..models.user import User
from ..models.shelter import Shelter
from ..schemas.audit_log import AuditLogResponse, AuditLogStatsResponse
from ..core.timezone import get_wib_now

ACTION_LABELS = {
    "disposisi_armada": "Disposisi Armada",
    "ubah_status_sos": "Ubah Status Tiket SOS",
    "ubah_status": "Ubah Status Tiket SOS",
    "emergency_activate": "Aktivasi Darurat Desa",
    "emergency_deactivate": "Pencabutan Darurat Desa",
    "update_system_config": "Pembaruan Konfigurasi Sistem",
    "update_user": "Pembaruan Data Warga",
    "toggle_user_status": "Aktivasi/Deaktivasi Akun Warga",
    "change_password": "Ganti Kata Sandi Akun",
}

ID_MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
]


def _format_time(dt: Optional[datetime]) -> str:
    if not dt:
        return "-"
    month_name = ID_MONTHS[dt.month] if 1 <= dt.month <= 12 else str(dt.month)
    return f"{dt.day:02d} {month_name} {dt.year} • {dt.strftime('%H:%M')} WIB"


def format_audit_log(log: AuditLog) -> AuditLogResponse:
    """Format entitas AuditLog ke AuditLogResponse dengan label manusiawi."""
    label = ACTION_LABELS.get(log.action_type, log.action_type.replace("_", " ").title())

    return AuditLogResponse(
        id=log.id,
        admin_id=log.admin_id,
        admin_name=log.admin_name or (log.admin.full_name if log.admin else "Admin"),
        action_type=log.action_type,
        action_label=label,
        target_type=log.target_type,
        target_id=log.target_id,
        ticket_number=log.ticket_number,
        old_status=log.old_status,
        new_status=log.new_status,
        assigned_unit=log.assigned_unit,
        shelter_id=log.shelter_id,
        shelter_name=log.shelter_name or (log.shelter.name if log.shelter else None),
        notes=log.notes,
        details=log.details,
        ip_address=log.ip_address,
        created_at=log.created_at,
        time_formatted=_format_time(log.created_at),
    )


def record_sos_disposition(
    db: Session,
    admin: User,
    ticket: SOSTicket,
    assigned_unit: str,
    shelter_id: Optional[int] = None,
    shelter_name: Optional[str] = None,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Mencatat audit log untuk aksi disposisi armada penugasan (perahu karet dsb)
    serta penugasan posko tujuan evakuasi.
    """
    if not shelter_name and shelter_id:
        sh = db.query(Shelter).filter(Shelter.id == shelter_id).first()
        if sh:
            shelter_name = sh.name

    desc_notes = notes or f"Penugasan armada '{assigned_unit}'"
    if shelter_name:
        desc_notes += f" menuju posko '{shelter_name}'"

    details_payload = {
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "assigned_unit": assigned_unit,
        "shelter_id": shelter_id,
        "shelter_name": shelter_name,
        "family_count": ticket.family_count,
        "priority_score": ticket.priority_score,
        "reporter_id": ticket.reporter_id,
        "village_id": ticket.village_id,
    }

    log_entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.full_name,
        action_type="disposisi_armada",
        target_type="sos_ticket",
        target_id=ticket.id,
        ticket_number=ticket.ticket_number,
        old_status=ticket.status,
        new_status=ticket.status,
        assigned_unit=assigned_unit,
        shelter_id=shelter_id,
        shelter_name=shelter_name,
        notes=desc_notes,
        details=json.dumps(details_payload, ensure_ascii=False),
        ip_address=ip_address,
        created_at=get_wib_now(),
    )
    db.add(log_entry)
    db.flush()
    return log_entry


def record_sos_status_change(
    db: Session,
    admin: User,
    ticket: SOSTicket,
    old_status: str,
    new_status: str,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Mencatat audit log untuk perubahan lifecycle status tiket SOS oleh admin.
    """
    desc_notes = f"Perubahan status tiket dari '{old_status}' menjadi '{new_status}'"
    if reason:
        desc_notes += f" (Alasan: {reason})"

    details_payload = {
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "old_status": old_status,
        "new_status": new_status,
        "rejection_reason": reason,
        "assigned_unit": ticket.assigned_unit,
        "shelter_destination_id": ticket.shelter_destination_id,
    }

    log_entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.full_name,
        action_type="ubah_status_sos",
        target_type="sos_ticket",
        target_id=ticket.id,
        ticket_number=ticket.ticket_number,
        old_status=old_status,
        new_status=new_status,
        assigned_unit=ticket.assigned_unit,
        shelter_id=ticket.shelter_destination_id,
        notes=desc_notes,
        details=json.dumps(details_payload, ensure_ascii=False),
        ip_address=ip_address,
        created_at=get_wib_now(),
    )
    db.add(log_entry)
    db.flush()
    return log_entry


def record_emergency_action(
    db: Session,
    admin: User,
    village_id: int,
    village_name: str,
    is_active: bool,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Mencatat audit log untuk aktivasi / pencabutan mode darurat desa oleh admin.
    """
    action_type = "emergency_activate" if is_active else "emergency_deactivate"
    old_st = "normal" if is_active else "darurat_aktif"
    new_st = "darurat_aktif" if is_active else "normal"

    desc_notes = f"{'Aktivasi' if is_active else 'Pencabutan'} Mode Darurat Desa {village_name}"
    if notes:
        desc_notes += f": {notes}"

    details_payload = {
        "village_id": village_id,
        "village_name": village_name,
        "is_active": is_active,
        "notes": notes,
    }

    log_entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.full_name,
        action_type=action_type,
        target_type="emergency_status",
        target_id=village_id,
        old_status=old_st,
        new_status=new_st,
        notes=desc_notes,
        details=json.dumps(details_payload, ensure_ascii=False),
        ip_address=ip_address,
        created_at=get_wib_now(),
    )
    db.add(log_entry)
    db.flush()
    return log_entry


def compute_audit_stats(db: Session) -> AuditLogStatsResponse:
    """Menghitung agregasi statistik audit log."""
    total_logs = db.query(AuditLog).count()
    total_disposisi = db.query(AuditLog).filter(AuditLog.action_type == "disposisi_armada").count()
    total_status_changes = db.query(AuditLog).filter(
        AuditLog.action_type.in_(["ubah_status_sos", "ubah_status"])
    ).count()
    total_emergency = db.query(AuditLog).filter(
        AuditLog.action_type.in_(["emergency_activate", "emergency_deactivate"])
    ).count()

    type_counts = (
        db.query(AuditLog.action_type, func.count(AuditLog.id))
        .group_by(AuditLog.action_type)
        .all()
    )
    actions_by_type = {t: c for t, c in type_counts}

    top_admins_rows = (
        db.query(
            AuditLog.admin_id,
            AuditLog.admin_name,
            func.count(AuditLog.id).label("count")
        )
        .filter(AuditLog.admin_id != None)
        .group_by(AuditLog.admin_id, AuditLog.admin_name)
        .order_by(desc("count"))
        .limit(5)
        .all()
    )
    top_admins = [
        {"admin_id": r[0], "admin_name": r[1] or "Admin", "action_count": r[2]}
        for r in top_admins_rows
    ]

    return AuditLogStatsResponse(
        total_logs=total_logs,
        total_disposisi=total_disposisi,
        total_status_changes=total_status_changes,
        total_emergency_actions=total_emergency,
        actions_by_type=actions_by_type,
        top_admins=top_admins,
    )


def record_config_change(
    db: Session,
    admin: User,
    config_key: str,
    old_value: str,
    new_value: str,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Mencatat perubahan konfigurasi sistem ke tabel audit_logs."""
    details_payload = {
        "config_key": config_key,
        "old_value": old_value,
        "new_value": new_value,
    }
    desc_notes = notes or f"Mengubah parameter {config_key}: '{old_value}' -> '{new_value}'"
    log_entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.full_name,
        action_type="update_system_config",
        target_type="system_config",
        target_id=None,
        ticket_number=config_key,
        old_status=str(old_value),
        new_status=str(new_value),
        notes=desc_notes,
        details=json.dumps(details_payload, ensure_ascii=False),
        ip_address=ip_address,
        created_at=get_wib_now(),
    )
    db.add(log_entry)
    db.flush()
    return log_entry


def record_user_action(
    db: Session,
    admin: User,
    target_user: User,
    action_type: str,  # 'update_user' or 'toggle_user_status'
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    notes: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Mencatat aktivitas pengelolaan user/warga oleh admin ke tabel audit_logs."""
    details_str = json.dumps(details or {}, ensure_ascii=False) if details else None
    desc_notes = notes or f"Aksi {action_type} pada akun warga #{target_user.id} ({target_user.full_name})"
    log_entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.full_name,
        action_type=action_type,
        target_type="user",
        target_id=target_user.id,
        ticket_number=target_user.email,
        old_status=old_value,
        new_status=new_value,
        notes=desc_notes,
        details=details_str,
        ip_address=ip_address,
        created_at=get_wib_now(),
    )
    db.add(log_entry)
    db.flush()
    return log_entry


