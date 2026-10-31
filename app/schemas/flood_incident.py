"""
Pydantic Schemas untuk Arsip Kejadian Banjir & Log Historis Hidrometeorologi.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from decimal import Decimal

FloodCategory = Literal["awas", "siaga", "waspada", "aman"]
FloodStatus = Literal["selesai", "pemulihan", "aktif", "arsip"]


class FloodIncidentBase(BaseModel):
    title: str = Field(..., max_length=200, description="Judul peristiwa / insiden banjir")
    description: Optional[str] = Field(None, description="Deskripsi dampak atau detail kejadian")
    category: FloodCategory = Field("siaga", description="Kategori tingkat keparahan: awas, siaga, waspada, aman")
    village_id: Optional[int] = Field(None, description="ID desa terdampak utama (opsional jika multi-desa)")
    affected_villages: Optional[str] = Field(None, max_length=500, description="Daftar nama desa terdampak")
    water_level_m: Optional[float] = Field(None, description="Tinggi Muka Air (TMA) puncak dalam mdpl atau meter")
    discharge_m3s: Optional[float] = Field(None, description="Debit puncak sungai Bengawan Solo (m³/s)")
    rainfall_mm: Optional[float] = Field(None, description="Akumulasi curah hujan saat insiden (mm)")
    evacuated_count: int = Field(0, ge=0, description="Jumlah jiwa yang dievakuasi")
    affected_people_count: int = Field(0, ge=0, description="Estimasi total warga terdampak")
    shelter_count: int = Field(0, ge=0, description="Jumlah posko pengungsian yang difungsikan")
    event_date: datetime = Field(..., description="Waktu awal mulai kejadian")
    end_date: Optional[datetime] = Field(None, description="Waktu kejadian selesai / air surut")
    status: FloodStatus = Field("selesai", description="Status peristiwa: selesai, pemulihan, aktif, arsip")
    is_archived: bool = Field(True, description="Penanda status arsip")


class FloodIncidentCreate(FloodIncidentBase):
    pass


class FloodIncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    category: Optional[FloodCategory] = None
    village_id: Optional[int] = None
    affected_villages: Optional[str] = None
    water_level_m: Optional[float] = None
    discharge_m3s: Optional[float] = None
    rainfall_mm: Optional[float] = None
    evacuated_count: Optional[int] = Field(None, ge=0)
    affected_people_count: Optional[int] = Field(None, ge=0)
    shelter_count: Optional[int] = Field(None, ge=0)
    event_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[FloodStatus] = None
    is_archived: Optional[bool] = None


class FloodIncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    desc: Optional[str] = None
    category: str
    color: str
    village_id: Optional[int] = None
    village_name: Optional[str] = None
    affected_villages: Optional[str] = None
    water_level_m: Optional[float] = None
    tma: Optional[str] = None
    discharge_m3s: Optional[float] = None
    rainfall_mm: Optional[float] = None
    rainfall: Optional[str] = None
    evacuated_count: int = 0
    evacuation: Optional[str] = None
    affected_people_count: int = 0
    shelter_count: int = 0
    event_date: datetime
    date: str
    end_date: Optional[datetime] = None
    status: str
    is_archived: bool
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FloodArchiveStatsResponse(BaseModel):
    total_incidents: int
    awas_count: int
    siaga_count: int
    waspada_count: int
    aman_count: int
    total_evacuated: int
    max_tma_mdpl: Optional[float] = None
    max_discharge_m3s: Optional[float] = None
    max_rainfall_mm: Optional[float] = None
    period: str = "Semua Periode"


class FloodArchiveListResponse(BaseModel):
    items: List[FloodIncidentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    stats: Optional[FloodArchiveStatsResponse] = None


class FloodCalculationLogArchiveItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    village_id: int
    village_name: Optional[str] = None
    probability_score: float
    discharge_score: float
    rainfall_score: float
    elevation_score: float
    history_score: float
    risk_level: str
    discharge_raw: Optional[float] = None
    rainfall_raw: Optional[float] = None
    calculated_at: datetime


class FloodCalculationLogArchiveResponse(BaseModel):
    items: List[FloodCalculationLogArchiveItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class FloodCalculationLogStatsResponse(BaseModel):
    total_logs: int
    avg_probability: float
    max_probability: float
    min_probability: float
    risk_distribution: Dict[str, int]
    max_discharge_raw: Optional[float] = None
    max_rainfall_raw: Optional[float] = None
