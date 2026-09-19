"""
Model FloodProbabilityLog — tabel 'flood_probability_logs'.
Log historis kalkulasi probabilitas banjir per desa.
"""

from sqlalchemy import Column, Integer, BigInteger, String, Enum, DateTime, DECIMAL, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class FloodProbabilityLog(Base):
    __tablename__ = "flood_probability_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False)
    probability_score = Column(DECIMAL(5, 2), nullable=False)
    discharge_score = Column(DECIMAL(5, 2), nullable=False)
    rainfall_score = Column(DECIMAL(5, 2), nullable=False)
    elevation_score = Column(DECIMAL(5, 2), nullable=False)
    history_score = Column(DECIMAL(5, 2), nullable=False)
    risk_level = Column(
        Enum('rendah', 'sedang', 'tinggi', 'awas', name='risk_level_enum'),
        nullable=False
    )
    discharge_raw = Column(DECIMAL(10, 2), nullable=True)
    rainfall_raw = Column(DECIMAL(8, 2), nullable=True)
    calculated_at = Column(DateTime, server_default=func.now())
    
    village = relationship("Village", back_populates="flood_logs")
