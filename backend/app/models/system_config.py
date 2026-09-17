"""
Model SystemConfig — tabel 'system_config'.
Konfigurasi ambang batas & parameter sistem.
"""

from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(100), nullable=False, unique=True)
    config_value = Column(String(500), nullable=False)
    config_type = Column(
        Enum("float", "integer", "string", "boolean", name="config_type_enum"),
        nullable=False,
        default="string"
    )
    description = Column(String(300), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    updated_by_user = relationship("User", back_populates="system_configs_updated")
