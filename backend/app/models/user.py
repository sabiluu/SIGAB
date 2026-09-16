"""
Model User — tabel 'users'.
Menyimpan data akun warga dan admin.
"""

from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("warga", "admin", name="user_role"), default="warga", nullable=False)
    desa_id = Column(Integer, nullable=True)  # FK ke villages — ditambah nanti
    created_at = Column(DateTime, server_default=func.now())
