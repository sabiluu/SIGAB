"""
Model EmergencyStatus — tabel 'emergency_status'.
Log aktivasi/deaktivasi Mode Evakuasi Darurat per desa.
"""

from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, Boolean, DECIMAL, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class EmergencyStatus(Base):
    __tablename__ = "emergency_status"

    id = Column(Integer, primary_key=True, autoincrement=True)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False)
    is_emergency_active = Column(Boolean, nullable=False, default=False)
    trigger_type = Column(
        Enum("auto_probability", "manual_admin", name="trigger_type_enum"),
        nullable=False
    )
    triggered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    probability_at_trigger = Column(DECIMAL(5, 2), nullable=True)
    notes = Column(Text, nullable=True)
    activated_at = Column(DateTime, server_default=func.now())
    deactivated_at = Column(DateTime, nullable=True)
    
    village = relationship("Village", back_populates="emergency_statuses")
    triggered_by_user = relationship("User", back_populates="emergency_statuses_triggered")
