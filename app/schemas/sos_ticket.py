"""Pydantic schemas untuk SOS Ticket."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal
from decimal import Decimal

SOSTicketStatus = Literal[
    "submitted", "verified", "rejected", "dispatched", "on_route", "arrived", "completed"
]

class SOSTicketCreate(BaseModel):
    reporter_id: Optional[int] = None
    village_id: int
    gps_latitude: Decimal
    gps_longitude: Decimal
    gps_address: Optional[str] = None
    family_count: int = Field(1, ge=1, le=100, description="Jumlah anggota keluarga (minimal 1)")
    has_elderly: bool = False
    has_toddler: bool = False
    has_disability: bool = False
    has_pregnant: bool = False
    photo_url: Optional[str] = None
    is_simulation: bool = False

class SOSTicketUpdate(BaseModel):
    status: SOSTicketStatus
    priority_score: Optional[int] = Field(None, ge=0)
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
    shelter_destination_id: Optional[int] = None
    submitted_at: datetime
    updated_at: datetime
    reporter_name: Optional[str] = None
    village_name: Optional[str] = None

    class Config:
        from_attributes = True
