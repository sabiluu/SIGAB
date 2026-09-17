"""
Model WeatherDataLog — tabel 'weather_data_logs'.
Log data cuaca & curah hujan dari Open-Meteo Weather API.
"""

from sqlalchemy import Column, BigInteger, String, DateTime, DECIMAL, func
from ..core.database import Base


class WeatherDataLog(Base):
    __tablename__ = "weather_data_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    precipitation_mm = Column(DECIMAL(8, 2), nullable=False)
    accumulated_6h = Column(DECIMAL(8, 2), nullable=True)
    accumulated_12h = Column(DECIMAL(8, 2), nullable=True)
    temperature_c = Column(DECIMAL(5, 2), nullable=True)
    wind_speed_kmh = Column(DECIMAL(6, 2), nullable=True)
    api_source = Column(String(100), nullable=False, default="open-meteo-weather")
    latitude = Column(DECIMAL(10, 7), nullable=False, default=-7.1200000)
    longitude = Column(DECIMAL(10, 7), nullable=False, default=112.0800000)
    recorded_at = Column(DateTime, server_default=func.now())
