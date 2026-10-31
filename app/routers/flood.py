"""Router: Data Banjir (Flood Logs, Cuaca & Debit Sungai, Kalkulasi Probabilitas, serta Arsip & Log Kejadian Banjir Lampau)."""

import csv
import io
import math
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from ..core.database import get_db
from ..core.deps import get_current_admin_user
from ..models.flood_probability_log import FloodProbabilityLog
from ..models.weather_data_log import WeatherDataLog
from ..models.river_discharge_log import RiverDischargeLog
from ..models.flood_incident import FloodIncident
from ..models.village import Village

from ..schemas.flood_log import FloodLogResponse
from ..schemas.external import (
    WeatherInfoResponse,
    RiverDischargeResponse,
    FloodSyncResponse,
)
from ..schemas.flood_incident import (
    FloodIncidentCreate,
    FloodIncidentUpdate,
    FloodIncidentResponse,
    FloodArchiveStatsResponse,
    FloodArchiveListResponse,
    FloodCalculationLogArchiveItem,
    FloodCalculationLogArchiveResponse,
    FloodCalculationLogStatsResponse,
)

from ..services.flood_engine import assess_and_update_flood_risks
from ..services.external_api import fetch_rainfall, fetch_river_discharge
from ..services.flood_archive_service import (
    format_incident_response,
    compute_archive_stats,
    compute_calculation_logs_stats,
    format_display_date,
)

router = APIRouter(prefix="/flood", tags=["Flood"])


# =============================================================================
# 1. REALTIME & SENSOR LOGS
# =============================================================================

@router.get("/latest", response_model=List[FloodLogResponse])
def get_latest_flood_logs(db: Session = Depends(get_db)):
    """Mengambil data probabilitas banjir terkini (terakhir dihitung) untuk semua desa."""
    logs = (
        db.query(FloodProbabilityLog)
        .order_by(FloodProbabilityLog.calculated_at.desc())
        .limit(100)
        .all()
    )
    return logs


@router.get("/history/{village_id}", response_model=List[FloodLogResponse])
def get_flood_history_by_village(village_id: int, db: Session = Depends(get_db)):
    """Mengambil histori log probabilitas banjir untuk satu desa tertentu."""
    logs = (
        db.query(FloodProbabilityLog)
        .filter(FloodProbabilityLog.village_id == village_id)
        .order_by(FloodProbabilityLog.calculated_at.desc())
        .all()
    )
    return logs


@router.post("/sync", response_model=FloodSyncResponse)
async def sync_and_calculate_flood(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """
    Sinkronisasi API pihak ketiga (Open-Meteo Weather & Flood) dan
    menjalankan kalkulasi ulang probabilitas banjir untuk seluruh 25 desa.
    """
    result = await assess_and_update_flood_risks(db)
    return result


@router.get("/weather/latest", response_model=Optional[WeatherInfoResponse])
def get_latest_weather_log(db: Session = Depends(get_db)):
    """Mengambil data log cuaca & curah hujan terakhir yang tercatat di database."""
    log = (
        db.query(WeatherDataLog)
        .order_by(WeatherDataLog.recorded_at.desc())
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Belum ada data cuaca yang tersimpan")
    return log


@router.get("/discharge/latest", response_model=Optional[RiverDischargeResponse])
def get_latest_discharge_log(db: Session = Depends(get_db)):
    """Mengambil data log debit Bengawan Solo terakhir yang tercatat di database."""
    log = (
        db.query(RiverDischargeLog)
        .order_by(RiverDischargeLog.recorded_at.desc())
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Belum ada data debit air yang tersimpan")
    return log


@router.get("/weather/external", response_model=WeatherInfoResponse)
async def get_direct_weather(
    lat: float = Query(-7.1282, description="Latitude lokasi"),
    lon: float = Query(112.1039, description="Longitude lokasi"),
):
    """
    Mengambil data cuaca langsung dari Open-Meteo Weather API secara real-time.
    """
    return await fetch_rainfall(lat=lat, lon=lon)


@router.get("/discharge/external", response_model=RiverDischargeResponse)
async def get_direct_discharge(
    lat: float = Query(-7.1200, description="Latitude Sungai Bengawan Solo"),
    lon: float = Query(112.0800, description="Longitude Sungai Bengawan Solo"),
):
    """
    Mengambil data debit sungai langsung dari Open-Meteo Flood API secara real-time.
    """
    return await fetch_river_discharge(lat=lat, lon=lon)


# =============================================================================
# 2. ARSIP & LOG KEJADIAN BANJIR LAMPAU (INCIDENTS & STATS)
# =============================================================================

@router.get("/incidents/stats", response_model=FloodArchiveStatsResponse)
@router.get("/archive/stats", response_model=FloodArchiveStatsResponse)
def get_archive_stats_endpoint(
    year: Optional[int] = Query(None, description="Filter tahun kejadian, contoh: 2026"),
    village_id: Optional[int] = Query(None, description="Filter ID desa spesifik"),
    db: Session = Depends(get_db),
):
    """
    Mengambil ringkasan statistik arsip kejadian banjir lampau
    (total kejadian, status awas, total dievakuasi, TMA puncak, dll).
    """
    return compute_archive_stats(db, year=year, village_id=village_id)


@router.post("/archive/sync-csv")
@router.post("/incidents/sync-csv")
def sync_flood_csv_endpoint(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """
    Menyinkronkan data arsip kejadian banjir di database secara 1:1 dengan berkas rekap_banjir_baureno.csv.
    """
    try:
        from sync_flood_database import sync_from_csv
        sync_from_csv("rekap_banjir_baureno.csv")
        total = db.query(FloodIncident).count()
        return {
            "success": True,
            "message": f"Sinkronisasi berhasil! Sebanyak {total} kejadian banjir riil dari rekap_banjir_baureno.csv telah aktif.",
            "total_incidents": total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyinkronkan CSV: {str(e)}")


@router.get("/archive/export")
def export_flood_archive(
    format: str = Query("csv", description="Format file: csv atau json"),
    year: Optional[int] = Query(None, description="Filter tahun kejadian"),
    category: Optional[str] = Query(None, description="Filter kategori status"),
    village_id: Optional[int] = Query(None, description="Filter ID desa"),
    db: Session = Depends(get_db),
):
    """
    Mengekspor data arsip kejadian banjir lampau ke file CSV atau JSON untuk keperluan pelaporan BPBD.
    """
    query = db.query(FloodIncident)
    if year:
        query = query.filter(extract("year", FloodIncident.event_date) == year)
    if category and category.lower() != "semua":
        query = query.filter(FloodIncident.category == category.lower())
    if village_id:
        query = query.filter(FloodIncident.village_id == village_id)

    incidents = query.order_by(FloodIncident.event_date.desc()).all()

    if format.lower() == "json":
        data = [format_incident_response(inc).model_dump() for inc in incidents]
        return data

    # Default CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
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
        "Warga Terdampak",
        "Posko Aktif",
        "Status",
        "Deskripsi",
    ])

    for inc in incidents:
        v_name = inc.village.name if inc.village else "-"
        writer.writerow([
            inc.id,
            inc.title,
            inc.category,
            inc.event_date.strftime("%Y-%m-%d %H:%M") if inc.event_date else "-",
            v_name,
            inc.affected_villages or "-",
            float(inc.water_level_m) if inc.water_level_m is not None else "-",
            float(inc.discharge_m3s) if inc.discharge_m3s is not None else "-",
            float(inc.rainfall_mm) if inc.rainfall_mm is not None else "-",
            inc.evacuated_count or 0,
            inc.affected_people_count or 0,
            inc.shelter_count or 0,
            inc.status or "selesai",
            inc.description or "-",
        ])

    filename = f"arsip_kejadian_banjir_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/incidents", response_model=FloodArchiveListResponse)
@router.get("/archive/incidents", response_model=FloodArchiveListResponse)
def get_flood_incidents(
    category: Optional[str] = Query(None, description="Filter kategori: awas, siaga, waspada, aman, atau semua"),
    village_id: Optional[int] = Query(None, description="Filter ID desa tertentu"),
    year: Optional[int] = Query(None, description="Filter tahun, misal 2026"),
    start_date: Optional[datetime] = Query(None, description="Rentang tanggal awal"),
    end_date: Optional[datetime] = Query(None, description="Rentang tanggal akhir"),
    search: Optional[str] = Query(None, description="Pencarian judul kejadian, deskripsi, atau wilayah desa"),
    status: Optional[str] = Query(None, description="Filter status insiden: selesai, pemulihan, aktif, arsip"),
    page: int = Query(1, ge=1, description="Nomor halaman (1-indexed)"),
    page_size: int = Query(20, ge=1, le=200, description="Jumlah item per halaman"),
    include_stats: bool = Query(True, description="Sertakan kalkulasi ringkasan statistik kartu atas"),
    db: Session = Depends(get_db),
):
    """
    Mengambil data arsip & log kejadian banjir lampau (Arsip Kejadian Hidrometeorologi).
    Mendukung filter kategori (Awas, Siaga, Aman), wilayah desa, tahun/rentang tanggal,
    pencarian teks, serta pagination lengkap.
    """
    query = db.query(FloodIncident)

    if category and category.strip().lower() != "semua":
        query = query.filter(FloodIncident.category == category.strip().lower())

    if village_id is not None:
        query = query.filter(
            or_(
                FloodIncident.village_id == village_id,
                FloodIncident.village_id == None,
            )
        )

    if year is not None:
        query = query.filter(extract("year", FloodIncident.event_date) == year)

    if start_date is not None:
        query = query.filter(FloodIncident.event_date >= start_date)

    if end_date is not None:
        query = query.filter(FloodIncident.event_date <= end_date)

    if status and status.strip():
        query = query.filter(FloodIncident.status == status.strip().lower())

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                FloodIncident.title.ilike(s),
                FloodIncident.description.ilike(s),
                FloodIncident.affected_villages.ilike(s),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    records = (
        query.order_by(FloodIncident.event_date.desc(), FloodIncident.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [format_incident_response(r) for r in records]

    stats = None
    if include_stats:
        stats = compute_archive_stats(db, year=year, village_id=village_id)

    return FloodArchiveListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        stats=stats,
    )


@router.get("/incidents/{incident_id}", response_model=FloodIncidentResponse)
@router.get("/archive/incidents/{incident_id}", response_model=FloodIncidentResponse)
def get_flood_incident_detail(
    incident_id: int,
    db: Session = Depends(get_db),
):
    """
    Mengambil detail satu arsip log kejadian banjir lampau berdasarkan ID.
    """
    incident = db.query(FloodIncident).filter(FloodIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Arsip kejadian banjir tidak ditemukan")
    return format_incident_response(incident)


@router.post("/incidents", response_model=FloodIncidentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/archive/incidents", response_model=FloodIncidentResponse, status_code=status.HTTP_201_CREATED)
def create_flood_incident(
    data: FloodIncidentCreate,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """
    (Admin) Menambahkan entri arsip log kejadian banjir baru.
    """
    if data.village_id:
        v = db.query(Village).filter(Village.id == data.village_id).first()
        if not v:
            raise HTTPException(status_code=400, detail="ID Desa tidak valid atau tidak terdaftar")

    incident = FloodIncident(
        title=data.title,
        description=data.description,
        category=(data.category or "siaga").lower(),
        village_id=data.village_id,
        affected_villages=data.affected_villages,
        water_level_m=data.water_level_m,
        discharge_m3s=data.discharge_m3s,
        rainfall_mm=data.rainfall_mm,
        evacuated_count=data.evacuated_count,
        affected_people_count=data.affected_people_count,
        shelter_count=data.shelter_count,
        event_date=data.event_date,
        end_date=data.end_date,
        status=data.status or "selesai",
        is_archived=data.is_archived,
        created_by=current_admin.id,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return format_incident_response(incident)


@router.put("/incidents/{incident_id}", response_model=FloodIncidentResponse)
@router.put("/archive/incidents/{incident_id}", response_model=FloodIncidentResponse)
def update_flood_incident(
    incident_id: int,
    data: FloodIncidentUpdate,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """
    (Admin) Memperbarui data arsip kejadian banjir lampau.
    """
    incident = db.query(FloodIncident).filter(FloodIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Arsip kejadian banjir tidak ditemukan")

    update_dict = data.model_dump(exclude_unset=True)

    if "village_id" in update_dict and update_dict["village_id"] is not None:
        v = db.query(Village).filter(Village.id == update_dict["village_id"]).first()
        if not v:
            raise HTTPException(status_code=400, detail="ID Desa tidak valid atau tidak terdaftar")

    if "category" in update_dict and update_dict["category"]:
        update_dict["category"] = update_dict["category"].lower()

    for field, value in update_dict.items():
        setattr(incident, field, value)

    db.commit()
    db.refresh(incident)
    return format_incident_response(incident)


@router.delete("/incidents/{incident_id}")
@router.delete("/archive/incidents/{incident_id}")
def delete_flood_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """
    (Admin) Menghapus entri arsip kejadian banjir.
    """
    incident = db.query(FloodIncident).filter(FloodIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Arsip kejadian banjir tidak ditemukan")

    db.delete(incident)
    db.commit()
    return {
        "success": True,
        "message": f"Arsip kejadian banjir '{incident.title}' (#{incident_id}) berhasil dihapus",
    }


# =============================================================================
# 3. DATA ARSIP LOG KALKULASI & SENSOR HISTORIS
# =============================================================================

@router.get("/archive/logs", response_model=FloodCalculationLogArchiveResponse)
def get_historical_calculation_logs(
    village_id: Optional[int] = Query(None, description="Filter ID desa"),
    risk_level: Optional[str] = Query(None, description="Filter tingkat risiko: rendah, sedang, tinggi, awas"),
    start_date: Optional[datetime] = Query(None, description="Filter rentang tanggal awal"),
    end_date: Optional[datetime] = Query(None, description="Filter rentang tanggal akhir"),
    min_probability: Optional[float] = Query(None, description="Skor probabilitas minimum (0-100)"),
    max_probability: Optional[float] = Query(None, description="Skor probabilitas maksimum (0-100)"),
    page: int = Query(1, ge=1, description="Nomor halaman (1-indexed)"),
    page_size: int = Query(50, ge=1, le=500, description="Jumlah data per halaman"),
    db: Session = Depends(get_db),
):
    """
    Mengambil data arsip log kalkulasi probabilitas banjir berkala (FloodProbabilityLog)
    dengan berbagai filter (wilayah, tingkat risiko, tanggal, ambang probabilitas) dan pagination.
    """
    query = db.query(FloodProbabilityLog).join(Village, FloodProbabilityLog.village_id == Village.id)

    if village_id is not None:
        query = query.filter(FloodProbabilityLog.village_id == village_id)

    if risk_level and risk_level.strip():
        query = query.filter(FloodProbabilityLog.risk_level == risk_level.strip().lower())

    if start_date is not None:
        query = query.filter(FloodProbabilityLog.calculated_at >= start_date)

    if end_date is not None:
        query = query.filter(FloodProbabilityLog.calculated_at <= end_date)

    if min_probability is not None:
        query = query.filter(FloodProbabilityLog.probability_score >= min_probability)

    if max_probability is not None:
        query = query.filter(FloodProbabilityLog.probability_score <= max_probability)

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    records = (
        query.order_by(FloodProbabilityLog.calculated_at.desc(), FloodProbabilityLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        FloodCalculationLogArchiveItem(
            id=r.id,
            village_id=r.village_id,
            village_name=r.village.name if r.village else None,
            probability_score=float(r.probability_score),
            discharge_score=float(r.discharge_score),
            rainfall_score=float(r.rainfall_score),
            elevation_score=float(r.elevation_score),
            history_score=float(r.history_score),
            risk_level=r.risk_level,
            discharge_raw=float(r.discharge_raw) if r.discharge_raw is not None else None,
            rainfall_raw=float(r.rainfall_raw) if r.rainfall_raw is not None else None,
            calculated_at=r.calculated_at,
        )
        for r in records
    ]

    return FloodCalculationLogArchiveResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/archive/logs/summary", response_model=FloodCalculationLogStatsResponse)
def get_historical_calculation_logs_summary(
    village_id: Optional[int] = Query(None, description="Filter ID desa spesifik"),
    start_date: Optional[datetime] = Query(None, description="Rentang tanggal awal"),
    end_date: Optional[datetime] = Query(None, description="Rentang tanggal akhir"),
    db: Session = Depends(get_db),
):
    """
    Mengambil ringkasan statistik dari arsip log kalkulasi probabilitas banjir
    (rata-rata skor, nilai tertinggi, distribusi level risiko, debit dan curah hujan tertinggi).
    """
    return compute_calculation_logs_stats(
        db, village_id=village_id, start_date=start_date, end_date=end_date
    )
