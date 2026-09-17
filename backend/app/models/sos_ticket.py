"""
Model SOSTicket — tabel 'sos_tickets'.
Tiket permintaan evakuasi darurat (SOS).
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, DateTime, Boolean, DECIMAL, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class SOSTicket(Base):
    __tablename__ = "sos_tickets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    ticket_number = Column(String(30), nullable=False, unique=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False)
    
    gps_latitude = Column(DECIMAL(10, 7), nullable=False)
    gps_longitude = Column(DECIMAL(10, 7), nullable=False)
    gps_address = Column(String(300), nullable=True)
    
    family_count = Column(Integer, nullable=False, default=1)
    has_elderly = Column(Boolean, nullable=False, default=False)
    has_toddler = Column(Boolean, nullable=False, default=False)
    has_disability = Column(Boolean, nullable=False, default=False)
    has_pregnant = Column(Boolean, nullable=False, default=False)
    photo_url = Column(String(500), nullable=True)
    
    status = Column(
        Enum("submitted", "verified", "rejected", "dispatched", "on_route", "arrived", "completed", name="sos_status_enum"),
        default="submitted",
        nullable=False,
    )
    priority_score = Column(Integer, nullable=False, default=0)
    
    assigned_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_unit = Column(String(100), nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    shelter_destination_id = Column(Integer, ForeignKey("shelters.id", ondelete="SET NULL"), nullable=True)
    
    submitted_at = Column(DateTime, server_default=func.now())
    verified_at = Column(DateTime, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="sos_tickets_reported")
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id], back_populates="sos_tickets_assigned")
    village = relationship("Village", back_populates="sos_tickets")
    shelter_destination = relationship("Shelter", back_populates="sos_tickets")
