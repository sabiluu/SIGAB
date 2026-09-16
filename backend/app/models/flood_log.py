"""
Model FloodLog — tabel 'flood_logs'.
Log histori perhitungan probabilitas banjir per desa.
"""

from sqlalchemy import Column, Integer, Float, DateTime, func
from ..core.database import Base


class FloodLog(Base):
    __tablename__ = "flood_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    village_id = Column(Integer, nullable=False)
    curah_hujan = Column(Float, nullable=True)    # mm
    debit_air = Column(Float, nullable=True)       # m³/s
    probabilitas = Column(Float, nullable=False)   # 0–100
    risk_level = Column(String(20), nullable=False)
    recorded_at = Column(DateTime, server_default=func.now())
