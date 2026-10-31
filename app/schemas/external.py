"""
Skema Pydantic untuk respon integrasi API eksternal (Open-Meteo & OSRM) dan sinkronisasi.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class WeatherInfoResponse(BaseModel):
    precipitation_mm: float = Field(..., description="Curah hujan aktual (mm/jam)")
    accumulated_6h: Optional[float] = Field(None, description="Akumulasi hujan 6 jam terakhir (mm)")
    accumulated_12h: Optional[float] = Field(None, description="Akumulasi hujan 12 jam terakhir (mm)")
    temperature_c: Optional[float] = Field(None, description="Suhu udara (°C)")
    wind_speed_kmh: Optional[float] = Field(None, description="Kecepatan angin (km/jam)")
    api_source: str = Field(..., description="Sumber API data (open-meteo-weather atau mock)")
    latitude: float
    longitude: float
    recorded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RiverDischargeResponse(BaseModel):
    discharge_m3s: float = Field(..., description="Debit aliran sungai Bengawan Solo (m³/s)")
    forecast_1d: Optional[float] = Field(None, description="Prediksi debit 1 hari ke depan")
    forecast_3d: Optional[float] = Field(None, description="Prediksi debit 3 hari ke depan")
    forecast_7d: Optional[float] = Field(None, description="Prediksi debit 7 hari ke depan")
    api_source: str = Field(..., description="Sumber API data (open-meteo-flood atau mock)")
    latitude: float
    longitude: float
    recorded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RouteResponse(BaseModel):
    origin: List[float] = Field(..., description="[latitude, longitude] asal")
    destination: List[float] = Field(..., description="[latitude, longitude] tujuan (shelter)")
    distance_meters: float = Field(..., description="Jarak dalam meter")
    distance_km: float = Field(..., description="Jarak dalam kilometer")
    duration_seconds: float = Field(..., description="Durasi perjalanan dalam detik")
    duration_minutes: float = Field(..., description="Durasi perjalanan dalam menit")
    geometry_type: str = "LineString"
    coordinates: List[List[float]] = Field(..., description="Daftar titik koordinat [[lon, lat], ...]")
    is_fallback: bool = Field(False, description="Apakah menggunakan data fallback offline/simulasi")
    summary: Optional[str] = None


class FloodSyncResponse(BaseModel):
    status: str
    message: str
    villages_updated: int
    weather: WeatherInfoResponse
    discharge: RiverDischargeResponse
    synced_at: datetime
