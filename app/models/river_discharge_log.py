"""
Model RiverDischargeLog — tabel 'river_discharge_logs'.
Log data debit Sungai Bengawan Solo dari Open-Meteo Flood API.
"""

from sqlalchemy import Column, BigInteger, String, DateTime, DECIMAL, func
from ..core.database import Base


class RiverDischargeLog(Base):
    __tablename__ = "river_discharge_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    discharge_m3s = Column(DECIMAL(10, 2), nullable=False)
    forecast_1d = Column(DECIMAL(10, 2), nullable=True)
    forecast_3d = Column(DECIMAL(10, 2), nullable=True)
    forecast_7d = Column(DECIMAL(10, 2), nullable=True)
    api_source = Column(String(100), nullable=False, default="open-meteo-flood")
    latitude = Column(DECIMAL(10, 7), nullable=False, default=-7.1200000)
    longitude = Column(DECIMAL(10, 7), nullable=False, default=112.0800000)
    recorded_at = Column(DateTime, server_default=func.now())
