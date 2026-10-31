"""
Pydantic schemas untuk User & Manajemen Kependudukan (Warga & Admin).
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100, description="Nama lengkap pengguna")
    email: EmailStr = Field(..., description="Alamat email valid")
    phone: str = Field(..., description="Nomor telepon aktif")
    password: str = Field(..., min_length=6, description="Password minimal 6 karakter")
    role: str = Field("user", pattern="^(user|admin|petugas|warga)$", description="Peran: user atau admin")
    village_id: Optional[int] = Field(None, description="ID desa domisili (khusus warga/user)")
    avatar_url: Optional[str] = None
    nik: Optional[str] = None
    address: Optional[str] = None
    family_count: Optional[int] = 4
    elderly_count: Optional[int] = 0
    toddler_count: Optional[int] = 0
    pregnant_count: Optional[int] = 0
    disabled_count: Optional[int] = 0
    notes: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    role: str
    village_id: Optional[int] = None
    avatar_url: Optional[str] = None
    is_active: bool
    notification_enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CitizenDetailResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    role: str
    village_id: Optional[int] = None
    village_name: Optional[str] = None
    village_risk_level: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    notification_enabled: bool
    nik: Optional[str] = None
    address: Optional[str] = None
    family_count: int = 1
    elderly_count: int = 0
    toddler_count: int = 0
    pregnant_count: int = 0
    disabled_count: int = 0
    has_vulnerable: bool = False
    notes: Optional[str] = None
    sos_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CitizenListResponse(BaseModel):
    items: List[CitizenDetailResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class VillageDemographicItem(BaseModel):
    village_id: int
    village_name: str
    risk_level: str
    probability: float
    is_emergency: bool
    citizens_count: int
    family_members_count: int
    vulnerable_count: int
    elderly_count: int
    toddler_count: int


class CitizenDemographicsStats(BaseModel):
    total_registered_users: int
    total_citizens: int
    total_admins: int
    total_active_accounts: int
    total_family_members: int
    total_elderly: int
    total_toddlers: int
    total_pregnant: int
    total_disabled: int
    total_vulnerable: int
    vulnerable_in_high_risk: int
    villages_breakdown: List[VillageDemographicItem]


class AdminUpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    village_id: Optional[int] = None
    role: Optional[str] = Field(None, pattern="^(user|admin)$")
    is_active: Optional[bool] = None
    nik: Optional[str] = None
    address: Optional[str] = None
    family_count: Optional[int] = Field(None, ge=1)
    elderly_count: Optional[int] = Field(None, ge=0)
    toddler_count: Optional[int] = Field(None, ge=0)
    pregnant_count: Optional[int] = Field(None, ge=0)
    disabled_count: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class ToggleActiveRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = Field(None, description="Kata sandi saat ini")
    old_password: Optional[str] = Field(None, description="Alias kata sandi saat ini")
    new_password: str = Field(..., min_length=6, description="Kata sandi baru minimal 6 karakter")
    confirm_password: Optional[str] = Field(None, description="Konfirmasi kata sandi baru (opsional)")


class ChangePasswordResponse(BaseModel):
    status: str = "success"
    message: str

