"""
Model AuditLog — tabel 'audit_logs'.
Merekam jejak audit aktivitas admin (disposisi armada, perubahan status SOS, aktivasi darurat).
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


from ..core.timezone import get_wib_now


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    admin_name = Column(String(100), nullable=True)
    action_type = Column(String(50), nullable=False, index=True)  # 'disposisi_armada', 'ubah_status_sos', 'emergency_activate', 'emergency_deactivate'
    target_type = Column(String(50), nullable=False, default="sos_ticket", index=True)  # 'sos_ticket', 'emergency_status', dll
    target_id = Column(Integer, nullable=True, index=True)  # ID entitas target (misal SOSTicket.id)
    ticket_number = Column(String(50), nullable=True, index=True)  # EVAC-BRN-YYYY-MMDD-SEQ
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    assigned_unit = Column(String(100), nullable=True)
    shelter_id = Column(Integer, ForeignKey("shelters.id", ondelete="SET NULL"), nullable=True)
    shelter_name = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # JSON snapshot payload
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=get_wib_now, nullable=False, index=True)

    admin = relationship("User", foreign_keys=[admin_id])
    shelter = relationship("Shelter", foreign_keys=[shelter_id])
