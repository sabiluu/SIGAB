"""Pydantic schemas untuk Village."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class VillageCreate(BaseModel):
    name: str
    latitude: Decimal
    longitude: Decimal
    elevation_index: Decimal
    history_score: Decimal

class VillageUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    elevation_index: Optional[Decimal] = None
    history_score: Optional[Decimal] = None
    current_risk_level: Optional[str] = None
    current_probability: Optional[Decimal] = None

class VillageResponse(BaseModel):
    id: int
    name: str
    latitude: Decimal
    longitude: Decimal
    elevation_index: Decimal
    history_score: Decimal
    current_risk_level: str
    current_probability: Decimal
    last_calculated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
