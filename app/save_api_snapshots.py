"""
Script untuk menarik dan menyimpan contoh respon JSON asli (raw snapshot)
dari masing-masing API pihak ketiga (Open-Meteo Weather, Open-Meteo Flood, dan OSRM).
"""

import httpx
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "app" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def fetch_and_save_all():
    headers = {"User-Agent": "SIGAB-Bojonegoro-Disaster-App/1.0"}

    # 1. Open-Meteo Weather API
    print("1. Mengambil snapshot dari Open-Meteo Weather API...")
    weather_url = (
        "https://api.open-meteo.com/v1/forecast"
        "?latitude=-7.1282&longitude=112.1039"
        "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
        "&hourly=precipitation,temperature_2m,relative_humidity_2m"
        "&timezone=Asia%2FJakarta&forecast_days=1"
    )
    with httpx.Client(timeout=10.0, headers=headers) as client:
        res = client.get(weather_url)
        res.raise_for_status()
        weather_data = res.json()
        weather_path = DATA_DIR / "sample_open_meteo_weather.json"
        with open(weather_path, "w", encoding="utf-8") as f:
            json.dump(weather_data, f, indent=2, ensure_ascii=False)
        print(f"   -> Tersimpan ke: {weather_path}")

    # 2. Open-Meteo Flood API
    print("2. Mengambil snapshot dari Open-Meteo Flood API (Bengawan Solo)...")
    flood_url = (
        "https://flood-api.open-meteo.com/v1/flood"
        "?latitude=-7.1200&longitude=112.0800"
        "&daily=river_discharge"
        "&forecast_days=8"
    )
    with httpx.Client(timeout=10.0, headers=headers) as client:
        res = client.get(flood_url)
        res.raise_for_status()
        flood_data = res.json()
        flood_path = DATA_DIR / "sample_open_meteo_flood.json"
        with open(flood_path, "w", encoding="utf-8") as f:
            json.dump(flood_data, f, indent=2, ensure_ascii=False)
        print(f"   -> Tersimpan ke: {flood_path}")

    # 3. OSRM Routing API
    print("3. Mengambil snapshot dari OSRM Routing API...")
    # Rute dari Baureno ke Shelter Bumiayu
    osrm_url = (
        "http://router.project-osrm.org/route/v1/driving/"
        "112.1039,-7.1282;112.1221,-7.1198"
        "?overview=full&geometries=geojson&steps=true"
    )
    with httpx.Client(timeout=10.0, headers=headers) as client:
        res = client.get(osrm_url)
        res.raise_for_status()
        osrm_data = res.json()
        osrm_path = DATA_DIR / "sample_osrm_route.json"
        with open(osrm_path, "w", encoding="utf-8") as f:
            json.dump(osrm_data, f, indent=2, ensure_ascii=False)
        print(f"   -> Tersimpan ke: {osrm_path}")

    print("\n[SELESAI] Semua file JSON snapshot pihak ketiga berhasil dibuat dan disimpan!")


if __name__ == "__main__":
    fetch_and_save_all()
