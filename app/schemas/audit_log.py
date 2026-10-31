"""
Pydantic Schemas untuk Audit Log aktivitas Admin
(Disposisi Armada, Perubahan Status SOS, dan Status Darurat).
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action_type: str = Field(..., description="Tipe aksi: disposisi_armada, ubah_status_sos, emergency_activate, emergency_deactivate")
    action_label: Optional[str] = None
    target_type: str = Field(..., description="Tipe target: sos_ticket, emergency_status, dll")
    target_id: Optional[int] = None
    ticket_number: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    assigned_unit: Optional[str] = None
    shelter_id: Optional[int] = None
    shelter_name: Optional[str] = None
    notes: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    time_formatted: Optional[str] = None


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditLogStatsResponse(BaseModel):
    total_logs: int
    total_disposisi: int
    total_status_changes: int
    total_emergency_actions: int
    actions_by_type: Dict[str, int]
    top_admins: List[Dict[str, Any]]
