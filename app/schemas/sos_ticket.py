"""Pydantic schemas untuk SOS Ticket."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class SOSTicketCreate(BaseModel):
    reporter_id: int
    village_id: int
    gps_latitude: Decimal
    gps_longitude: Decimal
    gps_address: Optional[str] = None
    family_count: int = 1
    has_elderly: bool = False
    has_toddler: bool = False
    has_disability: bool = False
    has_pregnant: bool = False
    photo_url: Optional[str] = None

class SOSTicketUpdate(BaseModel):
    status: str
    priority_score: Optional[int] = None
    assigned_admin_id: Optional[int] = None
    assigned_unit: Optional[str] = None
    rejection_reason: Optional[str] = None
    shelter_destination_id: Optional[int] = None

class SOSTicketResponse(BaseModel):
    id: int
    ticket_number: str
    reporter_id: int
    village_id: int
    gps_latitude: Decimal
    gps_longitude: Decimal
    gps_address: Optional[str]
    family_count: int
    has_elderly: bool
    has_toddler: bool
    has_disability: bool
    has_pregnant: bool
    photo_url: Optional[str]
    status: str
    priority_score: int
    assigned_admin_id: Optional[int]
    assigned_unit: Optional[str]
    rejection_reason: Optional[str]
    shelter_destination_id: Optional[int]
    submitted_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
