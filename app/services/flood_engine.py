"""
Service: Flood Engine — mesin perhitungan probabilitas risiko banjir.
Mengintegrasikan data real-time / simulasi cuaca (Open-Meteo) dan debit sungai Bengawan Solo,
menghitung probabilitas per desa (25 desa), mengklasifikasikan level risiko,
dan mencatatnya ke database.
"""

from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from .external_api import fetch_rainfall, fetch_river_discharge
from .notifier import broadcast_flood_alert, create_emergency_notifications, broadcast_emergency_status
from ..models.village import Village
from ..models.emergency_status import EmergencyStatus
from ..models.flood_probability_log import FloodProbabilityLog
from ..models.weather_data_log import WeatherDataLog
from ..models.river_discharge_log import RiverDischargeLog
from ..models.system_config import SystemConfig


def _get_system_config_value(db: Session, key: str, default: float) -> float:
    """Mengambil nilai konfigurasi dari tabel system_config dengan fallback default."""
    try:
        cfg = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
        if cfg and cfg.config_value:
            return float(cfg.config_value)
    except Exception:
        pass
    return default


def _determine_risk_level(probability: float) -> str:
    """Menentukan level risiko berdasarkan skor probabilitas 0-100%."""
    if probability >= 76.0:
        return "awas"
    elif probability >= 51.0:
        return "tinggi"
    elif probability >= 25.0:
        return "sedang"
    return "rendah"


async def assess_and_update_flood_risks(db: Session) -> Dict[str, Any]:
    """
    Menjalankan proses penilaian risiko banjir untuk seluruh 25 desa di Kecamatan Baureno:
    1. Tarik data cuaca aktual dari Open-Meteo Weather API
    2. Tarik data debit sungai Bengawan Solo dari Open-Meteo Flood API
    3. Simpan data mentah ke tabel weather_data_logs & river_discharge_logs
    4. Hitung probabilitas tiap desa dan update tabel villages & flood_probability_logs
    5. Broadcast peringatan banjir via WebSocket jika level risiko berubah
    """
    now = datetime.now()

    # 1. Tarik data eksternal
    weather = await fetch_rainfall()
    discharge = await fetch_river_discharge()

    # 2. Simpan log data eksternal
    weather_log = WeatherDataLog(
        precipitation_mm=weather["precipitation_mm"],
        accumulated_6h=weather["accumulated_6h"],
        accumulated_12h=weather["accumulated_12h"],
        temperature_c=weather["temperature_c"],
        wind_speed_kmh=weather["wind_speed_kmh"],
        api_source=weather["api_source"],
        latitude=weather["latitude"],
        longitude=weather["longitude"],
        recorded_at=now,
    )
    db.add(weather_log)

    discharge_log = RiverDischargeLog(
        discharge_m3s=discharge["discharge_m3s"],
        forecast_1d=discharge["forecast_1d"],
        forecast_3d=discharge["forecast_3d"],
        forecast_7d=discharge["forecast_7d"],
        api_source=discharge["api_source"],
        latitude=discharge["latitude"],
        longitude=discharge["longitude"],
        recorded_at=now,
    )
    db.add(discharge_log)
    db.flush()

    # 3. Muat bobot formula
    w1 = _get_system_config_value(db, "weight_discharge", 0.35)
    w2 = _get_system_config_value(db, "weight_rainfall", 0.30)
    w3 = _get_system_config_value(db, "weight_elevation", 0.20)
    w4 = _get_system_config_value(db, "weight_history", 0.15)
    critical_discharge = _get_system_config_value(db, "critical_discharge_threshold", 1500.0)

    # 4. Normalisasi skor debit & curah hujan
    s_debit = min(100.0, max(0.0, (discharge["discharge_m3s"] / critical_discharge) * 100.0))

    precip_mm = weather["precipitation_mm"]
    accum_6h = weather["accumulated_6h"] or (precip_mm * 4)
    s_hujan = min(100.0, max(0.0, (precip_mm / 25.0) * 50.0 + (accum_6h / 75.0) * 50.0))

    # 5. Iterasi dan hitung untuk setiap desa
    villages: List[Village] = db.query(Village).all()
    created_logs = []
    alerts_sent = 0

    for village in villages:
        elev = float(village.elevation_index or 0.0)
        hist = float(village.history_score or 0.0)

        s_elevasi = max(0.0, min(100.0, (40.0 - elev) * 3.0))
        s_histori = max(0.0, min(100.0, hist))

        # Formula perhitungan probabilitas banjir
        prob_score = (w1 * s_debit) + (w2 * s_hujan) + (w3 * s_elevasi) + (w4 * s_histori)
        prob_score = round(max(0.0, min(100.0, prob_score)), 2)
        risk_level = _determine_risk_level(prob_score)

        # Cek apakah level risiko berubah
        old_risk_level = village.current_risk_level or "rendah"
        risk_changed = old_risk_level != risk_level

        # Update entitas desa
        village.current_probability = prob_score
        village.current_risk_level = risk_level
        village.last_calculated_at = now

        # Simpan ke tabel log historis
        log_entry = FloodProbabilityLog(
            village_id=village.id,
            probability_score=prob_score,
            discharge_score=round(s_debit, 2),
            rainfall_score=round(s_hujan, 2),
            elevation_score=round(s_elevasi, 2),
            history_score=round(s_histori, 2),
            risk_level=risk_level,
            discharge_raw=discharge["discharge_m3s"],
            rainfall_raw=precip_mm,
            calculated_at=now,
        )
        db.add(log_entry)
        created_logs.append(log_entry)

        # Broadcast peringatan banjir via WebSocket jika level berubah
        if risk_changed:
            await broadcast_flood_alert(
                db=db,
                village_name=village.name,
                village_id=village.id,
                risk_level=risk_level,
                probability=prob_score,
            )
            alerts_sent += 1

            # --- LOGIC UNTUK OTOMATISASI EMERGENCY STATUS ---
            active_emergency = db.query(EmergencyStatus).filter(
                EmergencyStatus.village_id == village.id,
                EmergencyStatus.is_emergency_active == True,
            ).first()

            if risk_level in ["tinggi", "awas"] and not active_emergency:
                # Aktifkan emergency secara otomatis
                emergency = EmergencyStatus(
                    village_id=village.id,
                    is_emergency_active=True,
                    trigger_type="auto_system",
                    probability_at_trigger=prob_score,
                    notes=f"Diaktifkan otomatis oleh sistem karena level risiko {risk_level.upper()}",
                )
                db.add(emergency)
                db.flush()

                create_emergency_notifications(
                    db=db,
                    village_id=village.id,
                    village_name=village.name,
                    probability=prob_score,
                    is_active=True,
                    trigger_name="Sistem Otomatis"
                )

                await broadcast_emergency_status(
                    village_name=village.name,
                    village_id=village.id,
                    is_active=True,
                )

            elif risk_level in ["rendah", "sedang"] and active_emergency:
                # Nonaktifkan emergency secara otomatis jika situasi membaik
                active_emergency.is_emergency_active = False
                active_emergency.deactivated_at = now
                active_emergency.notes = (active_emergency.notes or "") + f" | Dinonaktifkan otomatis oleh sistem karena level risiko turun ke {risk_level.upper()}"
                
                create_emergency_notifications(
                    db=db,
                    village_id=village.id,
                    village_name=village.name,
                    probability=prob_score,
                    is_active=False,
                    trigger_name="Sistem Otomatis"
                )

                await broadcast_emergency_status(
                    village_name=village.name,
                    village_id=village.id,
                    is_active=False,
                )

    db.commit()

    return {
        "status": "success",
        "message": f"Kalkulasi probabilitas banjir berhasil diperbarui untuk {len(villages)} desa.",
        "villages_updated": len(villages),
        "alerts_sent": alerts_sent,
        "weather": {
            **weather,
            "recorded_at": now,
        },
        "discharge": {
            **discharge,
            "recorded_at": now,
        },
        "synced_at": now,
    }
