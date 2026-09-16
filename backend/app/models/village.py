"""
Model Village — tabel 'villages'.
Data 23 desa di Kecamatan Baureno.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, func
from ..core.database import Base


class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    risk_score = Column(Float, default=0.0)        # 0–100, dihitung oleh flood engine
    risk_level = Column(String(20), default="Aman") # Aman / Waspada / Siaga / Awas
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
