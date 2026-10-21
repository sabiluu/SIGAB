"""
Service untuk pengolahan data arsip banjir, histori kejadian lampau,
dan kalkulasi statistik hidrometeorologi.
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, and_, or_, extract

from ..models.flood_incident import FloodIncident
from ..models.flood_probability_log import FloodProbabilityLog
from ..models.village import Village
from ..models.river_discharge_log import RiverDischargeLog
from ..models.weather_data_log import WeatherDataLog
from ..schemas.flood_incident import (
    FloodIncidentResponse,
    FloodArchiveStatsResponse,
    FloodCalculationLogArchiveItem,
    FloodCalculationLogStatsResponse,
)

# Pemetaan warna kategori kejadian banjir
CATEGORY_COLOR_MAP = {
    "awas": "red",
    "siaga": "yellow",
    "waspada": "blue",
    "aman": "green",
}

ID_MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
]


def format_display_date(dt: Optional[datetime]) -> str:
    """Format datetime ke string ramah pengguna: '12 Feb 2026 • 03:20'."""
    if not dt:
        return "-"
    month_name = ID_MONTHS[dt.month] if 1 <= dt.month <= 12 else str(dt.month)
    return f"{dt.day:02d} {month_name} {dt.year} • {dt.strftime('%H:%M')}"


def format_incident_response(incident: FloodIncident, village_name: Optional[str] = None) -> FloodIncidentResponse:
    """
    Format entity model FloodIncident ke FloodIncidentResponse dengan
    field pelengkap UI (color, formatted date, tma, rainfall, evacuation).
    """
    category_lower = (incident.category or "siaga").lower()
    color = CATEGORY_COLOR_MAP.get(category_lower, "yellow")

    # Water level string formatting
    tma_str = f"{float(incident.water_level_m):.1f} mdpl" if incident.water_level_m is not None else "-"
    rainfall_str = f"{float(incident.rainfall_mm):.0f} mm" if incident.rainfall_mm is not None else "-"
    evacuation_str = f"{incident.evacuated_count} org"

    v_name = village_name
    if not v_name and incident.village:
        v_name = incident.village.name

    return FloodIncidentResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        desc=incident.description,
        category=category_lower,
        color=color,
        village_id=incident.village_id,
        village_name=v_name,
        affected_villages=incident.affected_villages,
        water_level_m=float(incident.water_level_m) if incident.water_level_m is not None else None,
        tma=tma_str,
        discharge_m3s=float(incident.discharge_m3s) if incident.discharge_m3s is not None else None,
        rainfall_mm=float(incident.rainfall_mm) if incident.rainfall_mm is not None else None,
        rainfall=rainfall_str,
        evacuated_count=incident.evacuated_count or 0,
        evacuation=evacuation_str,
        affected_people_count=incident.affected_people_count or 0,
        shelter_count=incident.shelter_count or 0,
        event_date=incident.event_date,
        date=format_display_date(incident.event_date),
        end_date=incident.end_date,
        status=incident.status or "selesai",
        is_archived=incident.is_archived if incident.is_archived is not None else True,
        created_by=incident.created_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )


def compute_archive_stats(
    db: Session,
    year: Optional[int] = None,
    village_id: Optional[int] = None,
) -> FloodArchiveStatsResponse:
    """
    Menghitung statistik agregat arsip kejadian banjir lampau
    (total kejadian, status awas, total dievakuasi, TMA puncak, dll).
    """
    query = db.query(FloodIncident)

    if year is not None:
        query = query.filter(extract("year", FloodIncident.event_date) == year)

    if village_id is not None:
        query = query.filter(
            or_(
                FloodIncident.village_id == village_id,
                FloodIncident.village_id == None,
            )
        )

    all_incidents = query.all()
    total_incidents = len(all_incidents)

    awas_count = sum(1 for inc in all_incidents if (inc.category or "").lower() == "awas")
    siaga_count = sum(1 for inc in all_incidents if (inc.category or "").lower() == "siaga")
    waspada_count = sum(1 for inc in all_incidents if (inc.category or "").lower() == "waspada")
    aman_count = sum(1 for inc in all_incidents if (inc.category or "").lower() == "aman")

    total_evacuated = sum(inc.evacuated_count or 0 for inc in all_incidents)

    # Nilai puncak hidrologi
    tma_vals = [float(inc.water_level_m) for inc in all_incidents if inc.water_level_m is not None]
    max_tma = max(tma_vals) if tma_vals else None

    discharge_vals = [float(inc.discharge_m3s) for inc in all_incidents if inc.discharge_m3s is not None]
    max_discharge = max(discharge_vals) if discharge_vals else None

    rainfall_vals = [float(inc.rainfall_mm) for inc in all_incidents if inc.rainfall_mm is not None]
    max_rainfall = max(rainfall_vals) if rainfall_vals else None

    period_str = f"Tahun {year}" if year else "Semua Periode"

    return FloodArchiveStatsResponse(
        total_incidents=total_incidents,
        awas_count=awas_count,
        siaga_count=siaga_count,
        waspada_count=waspada_count,
        aman_count=aman_count,
        total_evacuated=total_evacuated,
        max_tma_mdpl=round(max_tma, 2) if max_tma is not None else None,
        max_discharge_m3s=round(max_discharge, 2) if max_discharge is not None else None,
        max_rainfall_mm=round(max_rainfall, 2) if max_rainfall is not None else None,
        period=period_str,
    )


def compute_calculation_logs_stats(
    db: Session,
    village_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> FloodCalculationLogStatsResponse:
    """
    Menghitung statistik log probabilitas kalkulasi banjir historis.
    """
    query = db.query(FloodProbabilityLog)

    if village_id is not None:
        query = query.filter(FloodProbabilityLog.village_id == village_id)
    if start_date is not None:
        query = query.filter(FloodProbabilityLog.calculated_at >= start_date)
    if end_date is not None:
        query = query.filter(FloodProbabilityLog.calculated_at <= end_date)

    total_logs = query.count()
    if total_logs == 0:
        return FloodCalculationLogStatsResponse(
            total_logs=0,
            avg_probability=0.0,
            max_probability=0.0,
            min_probability=0.0,
            risk_distribution={"rendah": 0, "sedang": 0, "tinggi": 0, "awas": 0},
            max_discharge_raw=None,
            max_rainfall_raw=None,
        )

    # Aggregations
    agg = query.with_entities(
        func.avg(FloodProbabilityLog.probability_score),
        func.max(FloodProbabilityLog.probability_score),
        func.min(FloodProbabilityLog.probability_score),
        func.max(FloodProbabilityLog.discharge_raw),
        func.max(FloodProbabilityLog.rainfall_raw),
    ).first()

    # Risk level breakdown
    risk_counts = (
        query.with_entities(FloodProbabilityLog.risk_level, func.count(FloodProbabilityLog.id))
        .group_by(FloodProbabilityLog.risk_level)
        .all()
    )
    dist = {"rendah": 0, "sedang": 0, "tinggi": 0, "awas": 0}
    for level, cnt in risk_counts:
        if level in dist:
            dist[level] = cnt

    return FloodCalculationLogStatsResponse(
        total_logs=total_logs,
        avg_probability=round(float(agg[0] or 0.0), 2),
        max_probability=round(float(agg[1] or 0.0), 2),
        min_probability=round(float(agg[2] or 0.0), 2),
        risk_distribution=dist,
        max_discharge_raw=round(float(agg[3]), 2) if agg[3] is not None else None,
        max_rainfall_raw=round(float(agg[4]), 2) if agg[4] is not None else None,
    )
