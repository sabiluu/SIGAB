"""
Router: System Config — manajemen parameter sistem & bobot kalkulasi banjir.
Memungkinkan Admin BPBD mengatur bobot formula probabilitas banjir, ambang batas kritis debit air,
dan parameter operasional lainnya secara dinamis.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_admin_user
from ..core.timezone import get_wib_now
from ..models.system_config import SystemConfig
from ..models.user import User
from ..schemas.system_config import (
    SystemConfigItem,
    SystemConfigUpdate,
    FloodWeightsUpdate,
    FloodWeightsResponse,
)
from ..services.audit_service import record_config_change
from ..services.flood_engine import assess_and_update_flood_risks

router = APIRouter(prefix="/config", tags=["System Config"])


def _get_cfg_float(db: Session, key: str, default: float) -> float:
    cfg = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    if cfg and cfg.config_value:
        try:
            return float(cfg.config_value)
        except ValueError:
            pass
    return default


def _format_config_item(cfg: SystemConfig) -> SystemConfigItem:
    return SystemConfigItem(
        id=cfg.id,
        config_key=cfg.config_key,
        config_value=cfg.config_value,
        config_type=cfg.config_type,
        description=cfg.description,
        updated_at=cfg.updated_at,
        updated_by=cfg.updated_by,
        updated_by_name=cfg.updated_by_user.full_name if cfg.updated_by_user else None,
    )


@router.get("", response_model=List[SystemConfigItem])
def get_all_system_configs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil semua daftar parameter konfigurasi sistem."""
    configs = db.query(SystemConfig).order_by(SystemConfig.config_key.asc()).all()
    return [_format_config_item(c) for c in configs]


@router.get("/flood-weights", response_model=FloodWeightsResponse)
def get_flood_calculation_weights(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Mengambil parameter bobot kalkulasi risiko banjir terkini:
    - w1: weight_discharge (Debit Bengawan Solo)
    - w2: weight_rainfall (Curah Hujan Baureno)
    - w3: weight_elevation (Elevasi Topografi Desa)
    - w4: weight_history (Histori Kejadian Banjir)
    - critical_discharge_threshold: Ambang batas kritis debit limpasan sungai (m3/s)
    - emergency_probability_threshold: Ambang aktivasi otomatis darurat (%)
    """
    w1 = _get_cfg_float(db, "weight_discharge", 0.35)
    w2 = _get_cfg_float(db, "weight_rainfall", 0.30)
    w3 = _get_cfg_float(db, "weight_elevation", 0.20)
    w4 = _get_cfg_float(db, "weight_history", 0.15)
    critical = _get_cfg_float(db, "critical_discharge_threshold", 1500.0)
    emergency_threshold = _get_cfg_float(db, "emergency_probability_threshold", 76.0)

    total = round(w1 + w2 + w3 + w4, 4)
    is_valid = abs(total - 1.0) < 0.001

    latest_cfg = (
        db.query(SystemConfig)
        .filter(SystemConfig.config_key.in_(["weight_discharge", "weight_rainfall", "weight_elevation", "weight_history"]))
        .order_by(SystemConfig.updated_at.desc())
        .first()
    )

    return FloodWeightsResponse(
        weight_discharge=w1,
        weight_rainfall=w2,
        weight_elevation=w3,
        weight_history=w4,
        total_weight=total,
        is_valid_total=is_valid,
        critical_discharge_threshold=critical,
        emergency_probability_threshold=emergency_threshold,
        last_updated_at=latest_cfg.updated_at if latest_cfg else None,
        last_updated_by=latest_cfg.updated_by_user.full_name if (latest_cfg and latest_cfg.updated_by_user) else None,
    )


@router.put("", response_model=FloodWeightsResponse)
@router.put("/flood-weights", response_model=FloodWeightsResponse)
async def update_flood_calculation_weights(
    payload: FloodWeightsUpdate,
    request: Request,
    recalculate: bool = Query(True, description="Jalankan kalkulasi ulang risiko 25 desa secara langsung dengan bobot baru"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Memperbarui bobot formula kalkulasi risiko banjir (w1, w2, w3, w4)
    dan ambang batas kritis. Total bobot w1 + w2 + w3 + w4 harus berjumlah 1.00 (100%).
    """
    total = round(payload.weight_discharge + payload.weight_rainfall + payload.weight_elevation + payload.weight_history, 4)
    if abs(total - 1.0) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total kombinasi bobot w1+w2+w3+w4 harus sama dengan 1.00 (100%). Total saat ini: {total}",
        )

    client_ip = request.client.host if request.client else None
    now = get_wib_now()

    updates = [
        ("weight_discharge", str(payload.weight_discharge), "float", "Bobot debit sungai (w1) dalam formula probabilitas banjir"),
        ("weight_rainfall", str(payload.weight_rainfall), "float", "Bobot curah hujan (w2) dalam formula probabilitas banjir"),
        ("weight_elevation", str(payload.weight_elevation), "float", "Bobot elevasi desa (w3) dalam formula probabilitas banjir"),
        ("weight_history", str(payload.weight_history), "float", "Bobot riwayat historis banjir (w4) dalam formula probabilitas banjir"),
    ]

    if payload.critical_discharge_threshold is not None:
        updates.append(("critical_discharge_threshold", str(payload.critical_discharge_threshold), "float", "Ambang batas debit kritis limpasan sungai (m3/s)"))

    if payload.emergency_probability_threshold is not None:
        updates.append(("emergency_probability_threshold", str(payload.emergency_probability_threshold), "float", "Batas probabilitas aktivasi otomatis darurat (%)"))

    for key, val_str, val_type, desc in updates:
        cfg = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
        old_val = cfg.config_value if cfg else "-"
        if not cfg:
            cfg = SystemConfig(
                config_key=key,
                config_value=val_str,
                config_type=val_type,
                description=desc,
                updated_by=current_admin.id,
                updated_at=now,
            )
            db.add(cfg)
        else:
            cfg.config_value = val_str
            cfg.updated_by = current_admin.id
            cfg.updated_at = now

        # Catat jejak audit log jika nilainya berubah
        if old_val != val_str:
            record_config_change(
                db=db,
                admin=current_admin,
                config_key=key,
                old_value=old_val,
                new_value=val_str,
                notes=f"Penyesuaian bobot/ambang banjir '{key}' oleh {current_admin.full_name}",
                ip_address=client_ip,
            )

    db.commit()

    # Opsi: Jalankan kalkulasi ulang risiko langsung dengan parameter baru
    if recalculate:
        try:
            await assess_and_update_flood_risks(db)
        except Exception as e:
            # Tidak membatalkan update konfigurasi jika panggilan API eksternal gagal sesaat
            pass

    return get_flood_calculation_weights(db=db, current_admin=current_admin)


@router.post("/flood-weights/reset", response_model=FloodWeightsResponse)
async def reset_flood_calculation_weights(
    request: Request,
    recalculate: bool = Query(True, description="Jalankan kalkulasi ulang risiko 25 desa secara langsung setelah reset"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    (Admin) Mengembalikan parameter bobot kalkulasi banjir ke nilai default standar PRD:
    - weight_discharge: 0.35 (35%)
    - weight_rainfall: 0.30 (30%)
    - weight_elevation: 0.20 (20%)
    - weight_history: 0.15 (15%)
    - critical_discharge_threshold: 1500.0 m3/s
    - emergency_probability_threshold: 76.0%
    """
    default_payload = FloodWeightsUpdate(
        weight_discharge=0.35,
        weight_rainfall=0.30,
        weight_elevation=0.20,
        weight_history=0.15,
        critical_discharge_threshold=1500.0,
        emergency_probability_threshold=76.0,
    )
    return await update_flood_calculation_weights(
        payload=default_payload,
        request=request,
        recalculate=recalculate,
        db=db,
        current_admin=current_admin,
    )


@router.get("/{config_key}", response_model=SystemConfigItem)
def get_system_config_by_key(
    config_key: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengambil detail satu konfigurasi berdasarkan key unik."""
    cfg = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Konfigurasi dengan kunci '{config_key}' tidak ditemukan",
        )
    return _format_config_item(cfg)


@router.put("/{config_key}", response_model=SystemConfigItem)
def update_system_config_by_key(
    config_key: str,
    payload: SystemConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Mengubah nilai satu konfigurasi tertentu."""
    cfg = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Konfigurasi dengan kunci '{config_key}' tidak ditemukan",
        )

    old_val = cfg.config_value
    cfg.config_value = payload.config_value.strip()
    if payload.description is not None:
        cfg.description = payload.description.strip()
    cfg.updated_by = current_admin.id
    cfg.updated_at = get_wib_now()

    client_ip = request.client.host if request.client else None
    record_config_change(
        db=db,
        admin=current_admin,
        config_key=config_key,
        old_value=old_val,
        new_value=cfg.config_value,
        notes=f"Perubahan parameter '{config_key}' oleh {current_admin.full_name}",
        ip_address=client_ip,
    )

    db.commit()
    db.refresh(cfg)
    return _format_config_item(cfg)


configs_router = APIRouter(tags=["System Config"])


@configs_router.put("/configs", response_model=FloodWeightsResponse)
@configs_router.put("/api/configs", response_model=FloodWeightsResponse)
async def update_configs_table_iii(
    payload: FloodWeightsUpdate,
    request: Request,
    recalculate: bool = Query(True, description="Jalankan kalkulasi ulang risiko 25 desa secara langsung dengan bobot baru"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """(Admin) Endpoint alias sesuai PRD Table III (PUT /api/configs)."""
    return await update_flood_calculation_weights(
        payload=payload,
        request=request,
        recalculate=recalculate,
        db=db,
        current_admin=current_admin,
    )
