from sqlalchemy.orm import Session
from datetime import datetime

from ..models.weather_data_log import WeatherDataLog
from ..models.river_discharge_log import RiverDischargeLog
from ..models.village import Village
from ..models.shelter import Shelter

def build_dashboard_snapshot(db: Session) -> dict:
    """Membangun payload lengkap data real-time untuk broadcast."""
    now = datetime.now()

    # 1. Data cuaca terakhir
    weather_log = (
        db.query(WeatherDataLog)
        .order_by(WeatherDataLog.recorded_at.desc())
        .first()
    )
    weather = None
    if weather_log:
        weather = {
            "precipitation_mm": float(weather_log.precipitation_mm or 0),
            "accumulated_6h": float(weather_log.accumulated_6h or 0),
            "accumulated_12h": float(weather_log.accumulated_12h or 0),
            "temperature_c": float(weather_log.temperature_c or 28),
            "wind_speed_kmh": float(weather_log.wind_speed_kmh or 8),
            "recorded_at": str(weather_log.recorded_at),
        }

    # 2. Data debit sungai terakhir
    discharge_log = (
        db.query(RiverDischargeLog)
        .order_by(RiverDischargeLog.recorded_at.desc())
        .first()
    )
    discharge = None
    if discharge_log:
        discharge = {
            "discharge_m3s": float(discharge_log.discharge_m3s or 0),
            "forecast_1d": float(discharge_log.forecast_1d or 0),
            "forecast_3d": float(discharge_log.forecast_3d or 0),
            "forecast_7d": float(discharge_log.forecast_7d or 0),
            "recorded_at": str(discharge_log.recorded_at),
        }

    # 3. Data probabilitas & risiko 25 desa
    villages = db.query(Village).order_by(Village.name).all()
    villages_data = []
    for v in villages:
        villages_data.append({
            "id": v.id,
            "name": v.name,
            "latitude": float(v.latitude),
            "longitude": float(v.longitude),
            "probability": float(v.current_probability or 0),
            "risk_level": v.current_risk_level or "rendah",
            "last_calculated_at": str(v.last_calculated_at) if v.last_calculated_at else None,
        })

    # 4. Data shelter / posko
    shelters = db.query(Shelter).filter(Shelter.is_active == True).all()
    shelters_data = []
    for s in shelters:
        shelters_data.append({
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "latitude": float(s.latitude),
            "longitude": float(s.longitude),
            "capacity_total": s.capacity_total,
            "capacity_occupied": s.capacity_occupied,
            "contact_person": s.contact_person,
            "contact_phone": s.contact_phone,
        })

    # 5. Aggregated status kecamatan
    total_villages = len(villages_data)
    awas_count = sum(1 for v in villages_data if v["risk_level"] == "awas")
    tinggi_count = sum(1 for v in villages_data if v["risk_level"] == "tinggi")
    sedang_count = sum(1 for v in villages_data if v["risk_level"] == "sedang")
    rendah_count = sum(1 for v in villages_data if v["risk_level"] == "rendah")
    avg_prob = round(sum(v["probability"] for v in villages_data) / max(total_villages, 1), 2) if total_villages > 0 else 0

    # Determine overall status
    if awas_count > 0:
        overall_status = "awas"
    elif tinggi_count > 0:
        overall_status = "tinggi"
    elif sedang_count > 0:
        overall_status = "sedang"
    else:
        overall_status = "rendah"

    return {
        "type": "dashboard_update",
        "timestamp": str(now),
        "weather": weather,
        "discharge": discharge,
        "villages": villages_data,
        "shelters": shelters_data,
        "kecamatan_summary": {
            "overall_status": overall_status,
            "average_probability": avg_prob,
            "awas_count": awas_count,
            "tinggi_count": tinggi_count,
            "sedang_count": sedang_count,
            "rendah_count": rendah_count,
            "total_villages": total_villages,
        },
    }
