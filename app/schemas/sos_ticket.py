"""Pydantic schemas untuk SOS Ticket."""

from pydantic import BaseModel
from datetime import datetime


class SOSTicketCreate(BaseModel):
    latitude: float
    longitude: float
    pesan: str | None = None
    jumlah_orang: int = 1


class SOSTicketResponse(BaseModel):
    id: int
    user_id: int
    latitude: float
    longitude: float
    pesan: str | None
    jumlah_orang: int
    status: str
    shelter_tujuan_id: int | None
    created_at: datetime | None
    updated_at: datetime | None

    class Config:
        from_attributes = True
