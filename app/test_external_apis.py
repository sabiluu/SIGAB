"""
Script uji integrasi API eksternal (Open-Meteo Weather, Flood, dan OSRM).
"""

import asyncio
import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.external_api import (
    fetch_rainfall,
    fetch_river_discharge,
    get_evacuation_route
)


async def main():
    print("=== 1. Test Open-Meteo Weather API ===")
    weather = await fetch_rainfall(lat=-7.1282, lon=112.1039)
    print("Weather Result:")
    for k, v in weather.items():
        print(f"  {k}: {v}")

    print("\n=== 2. Test Open-Meteo Flood API ===")
    discharge = await fetch_river_discharge(lat=-7.1200, lon=112.0800)
    print("Discharge Result:")
    for k, v in discharge.items():
        print(f"  {k}: {v}")

    print("\n=== 3. Test OSRM Routing API ===")
    # From Baureno village center to shelter (e.g. SMAN 1 Baureno / Balai Desa)
    route = await get_evacuation_route(
        origin_lat=-7.1282,
        origin_lon=112.1039,
        dest_lat=-7.1198,
        dest_lon=112.1221
    )
    print("Route Result:")
    print(f"  Distance: {route['distance_km']} km ({route['distance_meters']} m)")
    print(f"  Duration: {route['duration_minutes']} menit")
    print(f"  Is Fallback: {route['is_fallback']}")
    print(f"  Points Count: {len(route['coordinates'])}")
    print(f"  Summary: {route.get('summary')}")

    print("\n[OK] Semua pengujian fungsi API pihak ketiga berhasil diselesaikan!")


if __name__ == "__main__":
    asyncio.run(main())
