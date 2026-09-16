"""Pydantic schemas untuk Village."""

from pydantic import BaseModel
from datetime import datetime


class VillageResponse(BaseModel):
    id: int
    nama: str
    latitude: float
    longitude: float
    risk_score: float
    risk_level: str
    updated_at: datetime | None

    class Config:
        from_attributes = True
