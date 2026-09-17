"""
Model Village — tabel 'villages'.
Data 25 desa Kecamatan Baureno.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, DECIMAL, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    latitude = Column(DECIMAL(10, 7), nullable=False)
    longitude = Column(DECIMAL(10, 7), nullable=False)
    elevation_index = Column(DECIMAL(5, 2), nullable=False, default=0.00)
    history_score = Column(DECIMAL(5, 2), nullable=False, default=0.00)
    current_risk_level = Column(
        Enum('rendah', 'sedang', 'tinggi', 'awas', name='risk_level_enum'),
        default='rendah',
        nullable=False
    )
    current_probability = Column(DECIMAL(5, 2), nullable=False, default=0.00)
    last_calculated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="village")
    shelters = relationship("Shelter", back_populates="village")
    flood_logs = relationship("FloodProbabilityLog", back_populates="village", cascade="all, delete-orphan")
    emergency_statuses = relationship("EmergencyStatus", back_populates="village", cascade="all, delete-orphan")
    sos_tickets = relationship("SOSTicket", back_populates="village", cascade="all, delete-orphan")
