"""
Model Shelter — tabel 'shelters'.
Data posko pengungsian / shelter evakuasi.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, func
from ..core.database import Base


class Shelter(Base):
    __tablename__ = "shelters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(150), nullable=False)
    alamat = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    kapasitas = Column(Integer, default=0)
    terisi = Column(Integer, default=0)
    status = Column(String(20), default="Tersedia")  # Tersedia / Penuh
    desa_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
