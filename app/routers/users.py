"""
Router: Manajemen User & Kependudukan (/users) — khusus Admin Pusdalops BPBD.
Fitur:
  1. GET   /users/stats        — Statistik demografi & kelompok rentan per desa
  2. GET   /users/export       — Ekspor data warga terdampak ke file CSV
  3. GET   /users              — Daftar warga dengan filter wilayah, kerentanan, pencarian, & pagination
  4. GET   /users/{user_id}    — Detail profil warga & riwayat tiket SOS
  5. PATCH /users/{user_id}/status — Aktivasi / Deaktivasi akun warga
  6. PUT   /users/{user_id}    — Pemutakhiran data kependudukan oleh admin
  7. DELETE/users/{user_id}    — Hapus akun pengguna
"""

import csv
import io
import math
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, desc

from ..core.database import get_db
from ..core.deps import get_current_admin_user
from ..core.timezone import get_wib_now
from ..models.user import User
from ..models.village import Village
from ..models.sos_ticket import SOSTicket
from ..models.emergency_status import EmergencyStatus
from ..schemas.user import (
    CitizenDetailResponse,
    CitizenListResponse,
    CitizenDemographicsStats,
    VillageDemographicItem,
    AdminUpdateUserRequest,
    ToggleActiveRequest,
)
from ..services.audit_service import record_user_action

router = APIRouter(prefix="/users", tags=["User Management"])


def _format_citizen_detail(user: User, db: Session) -> CitizenDetailResponse:
    v_name = user.village.name if user.village else None
    v_risk = user.village.current_risk_level if user.village else None
    sos_count = db.query(SOSTicket).filter(SOSTicket.reporter_id == user.id).count()

    elderly = user.elderly_count or 0
    toddler = user.toddler_count or 0
    pregnant = user.pregnant_count or 0
    disabled = user.disabled_count or 0
    has_vuln = (elderly > 0 or toddler > 0 or pregnant > 0 or disabled > 0)

    return CitizenDetailResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        village_id=user.village_id,
        village_name=v_name,
        village_risk_level=v_risk,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        notification_enabled=user.notification_enabled,
        nik=user.nik,
        address=user.address,
        family_count=user.family_count if user.family_count is not None else 1,
        elderly_count=elderly,
        toddler_count=toddler,
        pregnant_count=pregnant,
        disabled_count=disabled,
        has_vulnerable=has_vuln,
        notes=user.notes,
        sos_count=sos_count,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/stats", response_model=CitizenDemographicsStats)
def get_citizen_demographics_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil ringkasan statistik demografi warga & kelompok rentan terdaftar."""
    total_users = db.query(User).count()
    total_citizens = db.query(User).filter(User.role == "user").count()
    total_admins = db.query(User).filter(User.role == "admin").count()
    total_active = db.query(User).filter(User.is_active == True).count()

    # Agregasi data keluarga & kelompok rentan
    sums = db.query(
        func.sum(User.family_count),
        func.sum(User.elderly_count),
        func.sum(User.toddler_count),
        func.sum(User.pregnant_count),
        func.sum(User.disabled_count),
    ).filter(User.role == "user").first()

    total_fam = int(sums[0] or 0)
    total_eld = int(sums[1] or 0)
    total_tod = int(sums[2] or 0)
    total_prg = int(sums[3] or 0)
    total_dis = int(sums[4] or 0)
    total_vuln = total_eld + total_tod + total_prg + total_dis

    # Breakdown per 25 desa
    villages = db.query(Village).order_by(Village.name.asc()).all()
    villages_breakdown: List[VillageDemographicItem] = []
    vulnerable_in_high_risk = 0

    for v in villages:
        c_count = db.query(User).filter(User.village_id == v.id, User.role == "user").count()
        v_sums = db.query(
            func.sum(User.family_count),
            func.sum(User.elderly_count),
            func.sum(User.toddler_count),
            func.sum(User.pregnant_count),
            func.sum(User.disabled_count),
        ).filter(User.village_id == v.id, User.role == "user").first()

        fam_c = int(v_sums[0] or 0)
        eld_c = int(v_sums[1] or 0)
        tod_c = int(v_sums[2] or 0)
        vuln_c = eld_c + tod_c + int(v_sums[3] or 0) + int(v_sums[4] or 0)

        # Cek emergency aktif
        is_em = db.query(EmergencyStatus).filter(
            EmergencyStatus.village_id == v.id,
            EmergencyStatus.is_emergency_active == True
        ).first() is not None

        if v.current_risk_level in ["awas", "tinggi"] or is_em:
            vulnerable_in_high_risk += vuln_c

        villages_breakdown.append(VillageDemographicItem(
            village_id=v.id,
            village_name=v.name,
            risk_level=v.current_risk_level or "rendah",
            probability=float(v.current_probability or 0.0),
            is_emergency=is_em,
            citizens_count=c_count,
            family_members_count=fam_c,
            vulnerable_count=vuln_c,
            elderly_count=eld_c,
            toddler_count=tod_c,
        ))

    return CitizenDemographicsStats(
        total_registered_users=total_users,
        total_citizens=total_citizens,
        total_admins=total_admins,
        total_active_accounts=total_active,
        total_family_members=total_fam,
        total_elderly=total_eld,
        total_toddlers=total_tod,
        total_pregnant=total_prg,
        total_disabled=total_dis,
        total_vulnerable=total_vuln,
        vulnerable_in_high_risk=vulnerable_in_high_risk,
        villages_breakdown=villages_breakdown,
    )


@router.get("/export")
def export_citizens_csv(
    village_id: Optional[int] = Query(None, description="Filter ID desa spesifik"),
    has_vulnerable: Optional[bool] = Query(None, description="Hanya ekspor keluarga dengan anggota rentan"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengekspor data kependudukan warga terdampak ke file CSV untuk laporan BPBD / Dinsos."""
    query = db.query(User).filter(User.role == "user")

    if village_id is not None:
        query = query.filter(User.village_id == village_id)

    if has_vulnerable:
        query = query.filter(
            or_(
                User.elderly_count > 0,
                User.toddler_count > 0,
                User.pregnant_count > 0,
                User.disabled_count > 0,
            )
        )

    users = query.order_by(User.village_id.asc(), User.full_name.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "ID",
        "Nama Lengkap",
        "NIK",
        "Email",
        "Nomor HP",
        "Desa Domisili",
        "Alamat Detail",
        "Jumlah Jiwa KK",
        "Lansia (60+)",
        "Balita (0-5)",
        "Ibu Hamil",
        "Disabilitas",
        "Status Akun",
        "Catatan Kesehatan / Khusus",
        "Waktu Terdaftar",
    ])

    for u in users:
        v_name = u.village.name if u.village else "-"
        writer.writerow([
            u.id,
            u.full_name,
            f"'{u.nik}" if u.nik else "-",
            u.email,
            f"'{u.phone}" if u.phone else "-",
            v_name,
            u.address or "-",
            u.family_count or 1,
            u.elderly_count or 0,
            u.toddler_count or 0,
            u.pregnant_count or 0,
            u.disabled_count or 0,
            "Aktif" if u.is_active else "Nonaktif",
            u.notes or "-",
            u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "-",
        ])

    filename = f"data_kependudukan_warga_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("", response_model=CitizenListResponse)
def get_citizens_list(
    page: int = Query(1, ge=1, description="Halaman ke- (1-indexed)"),
    page_size: int = Query(20, ge=1, le=200, description="Jumlah data per halaman"),
    search: Optional[str] = Query(None, description="Cari nama, NIK, email, no HP, atau alamat"),
    village_id: Optional[int] = Query(None, description="Filter ID desa domisili"),
    role: Optional[str] = Query(None, description="Filter peran: user atau admin"),
    is_active: Optional[bool] = Query(None, description="Filter status aktif"),
    has_vulnerable: Optional[bool] = Query(None, description="Hanya keluarga dengan anggota rentan"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Mengambil daftar warga & pengguna terdaftar dengan pagination,
    pencarian teks, dan filter desa/status kerentanan.
    """
    query = db.query(User)

    if role:
        norm_role = "admin" if role.lower() in ("admin", "petugas") else "user"
        query = query.filter(User.role == norm_role)

    if village_id is not None:
        query = query.filter(User.village_id == village_id)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if has_vulnerable:
        query = query.filter(
            or_(
                User.elderly_count > 0,
                User.toddler_count > 0,
                User.pregnant_count > 0,
                User.disabled_count > 0,
            )
        )

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s),
                User.email.ilike(s),
                User.phone.ilike(s),
                User.nik.ilike(s),
                User.address.ilike(s),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    records = (
        query.options(joinedload(User.village))
        .order_by(desc(User.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_format_citizen_detail(u, db) for u in records]

    return CitizenListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{user_id}", response_model=CitizenDetailResponse)
def get_citizen_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil detail lengkap satu profil warga beserta histori SOS."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warga dengan ID #{user_id} tidak ditemukan",
        )
    return _format_citizen_detail(user, db)


@router.patch("/{user_id}/status", response_model=CitizenDetailResponse)
def toggle_citizen_active_status(
    user_id: int,
    payload: ToggleActiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengubah status aktif/nonaktif akun warga."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pengguna dengan ID #{user_id} tidak ditemukan",
        )

    if user.id == current_admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin tidak dapat menonaktifkan akunnya sendiri.",
        )

    if user.role == "admin" and not payload.is_active:
        active_admins_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True)
            .count()
        )
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menonaktifkan akun admin terakhir. Sistem membutuhkan minimal satu akun admin aktif.",
            )

    old_status_str = "Aktif" if user.is_active else "Nonaktif"
    new_status_str = "Aktif" if payload.is_active else "Nonaktif"

    user.is_active = payload.is_active
    user.updated_at = get_wib_now()

    client_ip = request.client.host if request.client else None
    notes = f"Admin {current_admin.full_name} mengubah status akun {user.full_name} menjadi {new_status_str}"
    if payload.reason:
        notes += f". Alasan: {payload.reason}"

    record_user_action(
        db=db,
        admin=current_admin,
        target_user=user,
        action_type="toggle_user_status",
        old_value=old_status_str,
        new_value=new_status_str,
        notes=notes,
        details={"reason": payload.reason, "target_user_id": user.id},
        ip_address=client_ip,
    )

    db.commit()
    db.refresh(user)
    return _format_citizen_detail(user, db)


@router.put("/{user_id}", response_model=CitizenDetailResponse)
def update_citizen_profile(
    user_id: int,
    payload: AdminUpdateUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Memperbarui data profil kependudukan warga (desa, NIK, anggota keluarga, dll)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pengguna dengan ID #{user_id} tidak ditemukan",
        )

    update_dict = payload.model_dump(exclude_unset=True)

    if "role" in update_dict and update_dict["role"] != "admin" and user.role == "admin":
        active_admins_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True)
            .count()
        )
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menurunkan peran admin terakhir. Sistem membutuhkan minimal satu akun admin aktif.",
            )

    if "village_id" in update_dict and update_dict["village_id"] is not None:
        v = db.query(Village).filter(Village.id == update_dict["village_id"]).first()
        if not v:
            raise HTTPException(status_code=400, detail="ID Desa tidak valid atau tidak terdaftar")

    old_snapshot = {
        "full_name": user.full_name,
        "phone": user.phone,
        "village_id": user.village_id,
        "nik": user.nik,
        "address": user.address,
        "family_count": user.family_count,
    }

    for field, value in update_dict.items():
        setattr(user, field, value)

    user.updated_at = get_wib_now()

    client_ip = request.client.host if request.client else None
    record_user_action(
        db=db,
        admin=current_admin,
        target_user=user,
        action_type="update_user",
        old_value=str(old_snapshot),
        new_value=str(update_dict),
        notes=f"Admin {current_admin.full_name} memperbarui data warga #{user.id} ({user.full_name})",
        details={"updated_fields": list(update_dict.keys()), "target_user_id": user.id},
        ip_address=client_ip,
    )

    db.commit()
    db.refresh(user)
    return _format_citizen_detail(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_citizen_account(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Menghapus akun pengguna."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pengguna dengan ID #{user_id} tidak ditemukan",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin tidak dapat menghapus akunnya sendiri.",
        )

    if user.role == "admin":
        active_admins_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True)
            .count()
        )
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus akun admin terakhir. Sistem membutuhkan minimal satu akun admin aktif.",
            )

    client_ip = request.client.host if request.client else None
    record_user_action(
        db=db,
        admin=current_admin,
        target_user=user,
        action_type="delete_user",
        old_value=f"{user.full_name} ({user.email})",
        new_value="DELETED",
        notes=f"Admin {current_admin.full_name} menghapus akun warga #{user.id} ({user.full_name})",
        ip_address=client_ip,
    )

    db.delete(user)
    db.commit()
    return None
