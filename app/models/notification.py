"""
Model Notification — tabel 'notifications'.
Riwayat notifikasi peringatan dini & update tiket SOS.
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(
        Enum("early_warning", "emergency_alert", "sos_update", "system_info", name="notification_type_enum"),
        nullable=False
    )
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(BigInteger, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    is_pushed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    user = relationship("User", back_populates="notifications")
