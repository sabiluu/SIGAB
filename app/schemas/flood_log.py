"""Pydantic schemas untuk Flood Log."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class FloodLogResponse(BaseModel):
    id: int
    village_id: int
    probability_score: Decimal
    discharge_score: Decimal
    rainfall_score: Decimal
    elevation_score: Decimal
    history_score: Decimal
    risk_level: str
    discharge_raw: Optional[Decimal]
    rainfall_raw: Optional[Decimal]
    calculated_at: datetime

    class Config:
        from_attributes = True
