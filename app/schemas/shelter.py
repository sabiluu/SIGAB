"""Pydantic schemas untuk Shelter."""

from pydantic import BaseModel
from datetime import datetime


class ShelterResponse(BaseModel):
    id: int
    nama: str
    alamat: str | None
    latitude: float
    longitude: float
    kapasitas: int
    terisi: int
    status: str
    desa_id: int | None
    created_at: datetime | None

    class Config:
        from_attributes = True
