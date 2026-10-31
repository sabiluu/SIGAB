"""
Model FloodIncident — tabel 'flood_incidents'.
Log arsip kejadian banjir lampau dan peristiwa hidrometeorologi.
"""

from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, DECIMAL, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class FloodIncident(Base):
    __tablename__ = "flood_incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(
        Enum("awas", "siaga", "waspada", "aman", name="incident_category_enum"),
        nullable=False,
        default="siaga",
        index=True,
    )
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="SET NULL"), nullable=True, index=True)
    affected_villages = Column(String(500), nullable=True)
    water_level_m = Column(DECIMAL(5, 2), nullable=True)
    discharge_m3s = Column(DECIMAL(10, 2), nullable=True)
    rainfall_mm = Column(DECIMAL(8, 2), nullable=True)
    evacuated_count = Column(Integer, nullable=False, default=0)
    affected_people_count = Column(Integer, nullable=False, default=0)
    shelter_count = Column(Integer, nullable=False, default=0)
    event_date = Column(DateTime, nullable=False, index=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default="selesai")
    is_archived = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    village = relationship("Village", back_populates="flood_incidents")
    creator = relationship("User", foreign_keys=[created_by])
