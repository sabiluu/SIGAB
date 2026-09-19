"""
Model Shelter — tabel 'shelters'.
Data posko pengungsian & manajemen kapasitas.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, DECIMAL, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Shelter(Base):
    __tablename__ = "shelters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    address = Column(String(300), nullable=False)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False)
    latitude = Column(DECIMAL(10, 7), nullable=False)
    longitude = Column(DECIMAL(10, 7), nullable=False)
    capacity_total = Column(Integer, default=0, nullable=False)
    capacity_occupied = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    contact_person = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    village = relationship("Village", back_populates="shelters")
    sos_tickets = relationship("SOSTicket", back_populates="shelter_destination")
