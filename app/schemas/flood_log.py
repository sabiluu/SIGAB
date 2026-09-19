"""Pydantic schemas untuk Flood Log."""

from pydantic import BaseModel
from datetime import datetime


class FloodLogResponse(BaseModel):
    id: int
    village_id: int
    curah_hujan: float | None
    debit_air: float | None
    probabilitas: float
    risk_level: str
    recorded_at: datetime | None

    class Config:
        from_attributes = True
