"""
Service: External API — integrasi Open-Meteo & OSRM.
Menyediakan pengambilan data cuaca, debit air sungai, dan kalkulasi rute evakuasi
dengan dukungan fallback offline (mock JSON) otomatis.
"""

import json
import logging
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from ..core.config import settings

logger = logging.getLogger("sigab.external_api")

MOCK_FILE_PATH = Path(__file__).parent.parent / "data" / "mock_external_data.json"


def _load_mock_file() -> Dict[str, Any]:
    """Membaca data mock cadangan dari file JSON lokal."""
    try:
        if MOCK_FILE_PATH.exists():
            with open(MOCK_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Gagal memuat mock data JSON: {e}")
    
    # Default hardcoded jika file tidak terbaca
    return {
        "weather": {
            "precipitation_mm": 12.0,
            "accumulated_6h": 35.0,
            "accumulated_12h": 50.0,
            "temperature_c": 28.0,
            "wind_speed_kmh": 10.0,
            "api_source": "mock-local-weather"
        },
        "river_discharge": {
            "discharge_m3s": 1150.0,
            "forecast_1d": 1300.0,
            "forecast_3d": 1450.0,
            "forecast_7d": 1200.0,
            "api_source": "mock-local-flood"
        }
    }


def _calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Menghitung jarak garis lurus dalam meter (Haversine formula)."""
    R = 6371000  # Radius bumi dalam meter
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def fetch_rainfall(lat: float = -7.1282, lon: float = 112.1039) -> Dict[str, Any]:
    """
    Mengambil data curah hujan & kondisi cuaca dari Open-Meteo Weather API.
    Jika request gagal, otomatis menggunakan fallback mock JSON.
    """
    url = f"{settings.OPEN_METEO_BASE_URL}/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        "hourly": "precipitation",
        "timezone": "Asia/Jakarta",
        "forecast_days": 1
    }

    try:
        async with httpx.AsyncClient(timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            current = data.get("current", {})
            hourly = data.get("hourly", {})
            hourly_precip: List[float] = hourly.get("precipitation", [])

            # Hitung akumulasi hujan 6 jam dan 12 jam terakhir
            precip_now = float(current.get("precipitation") or 0.0)
            accum_6h = round(sum(hourly_precip[:6]), 2) if len(hourly_precip) >= 6 else round(precip_now * 4, 2)
            accum_12h = round(sum(hourly_precip[:12]), 2) if len(hourly_precip) >= 12 else round(precip_now * 8, 2)

            return {
                "precipitation_mm": precip_now,
                "accumulated_6h": accum_6h,
                "accumulated_12h": accum_12h,
                "temperature_c": float(current.get("temperature_2m") or 28.0),
                "wind_speed_kmh": float(current.get("wind_speed_10m") or 12.0),
                "api_source": "open-meteo-weather",
                "latitude": lat,
                "longitude": lon,
            }
    except Exception as e:
        logger.warning(f"Open-Meteo Weather API error ({e}), menggunakan mock fallback.")
        mock = _load_mock_file().get("weather", {})
        return {
            "precipitation_mm": float(mock.get("precipitation_mm", 15.0)),
            "accumulated_6h": float(mock.get("accumulated_6h", 35.0)),
            "accumulated_12h": float(mock.get("accumulated_12h", 60.0)),
            "temperature_c": float(mock.get("temperature_c", 28.0)),
            "wind_speed_kmh": float(mock.get("wind_speed_kmh", 12.0)),
            "api_source": "mock-local-weather",
            "latitude": lat,
            "longitude": lon,
        }


async def fetch_river_discharge(lat: float = -7.1200, lon: float = 112.0800) -> Dict[str, Any]:
    """
    Mengambil data debit aliran Sungai Bengawan Solo dari Open-Meteo Flood API.
    Jika request gagal, otomatis menggunakan fallback mock JSON.
    """
    url = f"{settings.OPEN_METEO_FLOOD_BASE_URL}/flood"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge",
        "forecast_days": 8
    }

    try:
        async with httpx.AsyncClient(timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            daily = data.get("daily", {})
            discharges = daily.get("river_discharge", [])

            # Filter out None values jika ada
            clean_discharges = [d for d in discharges if d is not None]

            if clean_discharges:
                current_discharge = float(clean_discharges[0])
                f1 = float(clean_discharges[1]) if len(clean_discharges) > 1 else current_discharge
                f3 = float(clean_discharges[3]) if len(clean_discharges) > 3 else current_discharge
                f7 = float(clean_discharges[7]) if len(clean_discharges) > 7 else current_discharge

                return {
                    "discharge_m3s": current_discharge,
                    "forecast_1d": f1,
                    "forecast_3d": f3,
                    "forecast_7d": f7,
                    "api_source": "open-meteo-flood",
                    "latitude": lat,
                    "longitude": lon,
                }
    except Exception as e:
        logger.warning(f"Open-Meteo Flood API error ({e}), menggunakan mock fallback.")

    # Fallback jika data kosong atau API gagal
    mock = _load_mock_file().get("river_discharge", {})
    return {
        "discharge_m3s": float(mock.get("discharge_m3s", 1200.0)),
        "forecast_1d": float(mock.get("forecast_1d", 1350.0)),
        "forecast_3d": float(mock.get("forecast_3d", 1500.0)),
        "forecast_7d": float(mock.get("forecast_7d", 1250.0)),
        "api_source": "mock-local-flood",
        "latitude": lat,
        "longitude": lon,
    }


async def get_evacuation_route(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> Dict[str, Any]:
    """
    Mengambil rute jalan evakuasi dari lokasi asal ke posko shelter via OSRM.
    Format koordinat OSRM: {lon1},{lat1};{lon2},{lat2}
    """
    # OSRM menerima {longitude},{latitude}
    coords_str = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true"
    }

    try:
        async with httpx.AsyncClient(timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            routes = data.get("routes", [])
            if routes:
                route = routes[0]
                distance_m = float(route.get("distance", 0.0))
                duration_s = float(route.get("duration", 0.0))
                coordinates = route.get("geometry", {}).get("coordinates", [])

                return {
                    "origin": [origin_lat, origin_lon],
                    "destination": [dest_lat, dest_lon],
                    "distance_meters": distance_m,
                    "distance_km": round(distance_m / 1000.0, 2),
                    "duration_seconds": duration_s,
                    "duration_minutes": round(duration_s / 60.0, 1),
                    "geometry_type": "LineString",
                    "coordinates": coordinates,
                    "is_fallback": False,
                    "summary": f"Rute via OSRM (Jarak {round(distance_m/1000, 2)} km)"
                }
    except Exception as e:
        logger.warning(f"OSRM Routing API error ({e}), menggunakan rute simulasi fallback.")

    # Fallback jika OSRM unreachable
    distance_m = _calculate_haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    # Estimasi kecepatan berkendara evakuasi 30 km/jam (~8.33 m/s)
    duration_s = distance_m / 8.33

    # Buat jalur titik interpolasi garis lurus
    mid_lon = round((origin_lon + dest_lon) / 2.0, 7)
    mid_lat = round((origin_lat + dest_lat) / 2.0, 7)
    simulated_coordinates = [
        [origin_lon, origin_lat],
        [mid_lon, mid_lat],
        [dest_lon, dest_lat]
    ]

    return {
        "origin": [origin_lat, origin_lon],
        "destination": [dest_lat, dest_lon],
        "distance_meters": round(distance_m, 2),
        "distance_km": round(distance_m / 1000.0, 2),
        "duration_seconds": round(duration_s, 1),
        "duration_minutes": round(duration_s / 60.0, 1),
        "geometry_type": "LineString",
        "coordinates": simulated_coordinates,
        "is_fallback": True,
        "summary": f"Rute darurat garis lurus fallback (Jarak {round(distance_m/1000, 2)} km)"
    }
