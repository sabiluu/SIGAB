"""Pydantic schemas untuk Shelter."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class ShelterBase(BaseModel):
    name: str
    address: str
    latitude: Decimal
    longitude: Decimal
    capacity_total: int
    capacity_occupied: int
    is_active: bool = True
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    village_id: int

class ShelterUpdate(BaseModel):
    capacity_occupied: int

class ShelterFullUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    capacity_total: Optional[int] = None
    capacity_occupied: Optional[int] = None
    is_active: Optional[bool] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    village_id: Optional[int] = None

class ShelterCreate(ShelterBase):
    pass

class ShelterResponse(ShelterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
