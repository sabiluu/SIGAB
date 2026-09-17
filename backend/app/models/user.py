"""
Model User — tabel 'users'.
Akun pengguna platform — Warga (User) & Petugas BPBD (Admin).
"""

from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("user", "admin", name="user_role_enum"), default="user", nullable=False)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="SET NULL"), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notification_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    village = relationship("Village", back_populates="users")
    sos_tickets_reported = relationship("SOSTicket", foreign_keys="[SOSTicket.reporter_id]", back_populates="reporter")
    sos_tickets_assigned = relationship("SOSTicket", foreign_keys="[SOSTicket.assigned_admin_id]", back_populates="assigned_admin")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    emergency_statuses_triggered = relationship("EmergencyStatus", back_populates="triggered_by_user")
    system_configs_updated = relationship("SystemConfig", back_populates="updated_by_user")
