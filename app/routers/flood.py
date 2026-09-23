"""Router: Data Banjir (Flood Logs, Cuaca & Debit Sungai, serta Kalkulasi Probabilitas)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..core.database import get_db
from ..models.flood_probability_log import FloodProbabilityLog
from ..models.weather_data_log import WeatherDataLog
from ..models.river_discharge_log import RiverDischargeLog
from ..schemas.flood_log import FloodLogResponse
from ..schemas.external import (
    WeatherInfoResponse,
    RiverDischargeResponse,
    FloodSyncResponse,
)
from ..services.flood_engine import assess_and_update_flood_risks
from ..services.external_api import fetch_rainfall, fetch_river_discharge

router = APIRouter(prefix="/flood", tags=["Flood"])


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


from ..core.deps import get_current_admin_user

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
