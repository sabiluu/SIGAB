"""Pydantic schemas untuk User."""

from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    nama: str
    email: EmailStr
    password: str
    role: str = "warga"
    desa_id: int | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    nama: str
    email: str
    role: str
    desa_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True
