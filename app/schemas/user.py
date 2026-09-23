"""Pydantic schemas untuk User."""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100, description="Nama lengkap pengguna")
    email: EmailStr = Field(..., description="Alamat email valid")
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$", description="Nomor telepon aktif (10-15 digit)")
    password: str = Field(..., min_length=8, description="Password minimal 8 karakter")
    role: str = Field("user", pattern="^(user|admin)$", description="Peran: user atau admin")
    village_id: Optional[int] = Field(None, description="ID desa domisili (khusus warga/user)")
    avatar_url: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str
    role: str
    village_id: Optional[int]
    avatar_url: Optional[str]
    is_active: bool
    notification_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
