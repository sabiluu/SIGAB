"""
Schema Pydantic untuk SystemConfig (Parameter Bobot & Konfigurasi Sistem).
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SystemConfigItem(BaseModel):
    id: int
    config_key: str
    config_value: str
    config_type: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


class SystemConfigUpdate(BaseModel):
    config_value: str = Field(..., description="Nilai baru untuk konfigurasi")
    description: Optional[str] = Field(None, description="Deskripsi atau catatan konfigurasi opsional")


class FloodWeightsUpdate(BaseModel):
    weight_discharge: float = Field(..., ge=0.0, le=1.0, description="Bobot debit air sungai Bengawan Solo (w1)")
    weight_rainfall: float = Field(..., ge=0.0, le=1.0, description="Bobot curah hujan lokal Baureno (w2)")
    weight_elevation: float = Field(..., ge=0.0, le=1.0, description="Bobot elevasi/topografi desa (w3)")
    weight_history: float = Field(..., ge=0.0, le=1.0, description="Bobot histori banjir masa lalu (w4)")
    critical_discharge_threshold: Optional[float] = Field(None, ge=100.0, description="Ambang batas debit kritis (m3/s)")
    emergency_probability_threshold: Optional[float] = Field(None, ge=10.0, le=100.0, description="Batas probabilitas aktivasi mode darurat otomatis (%)")


class FloodWeightsResponse(BaseModel):
    weight_discharge: float
    weight_rainfall: float
    weight_elevation: float
    weight_history: float
    total_weight: float
    is_valid_total: bool
    critical_discharge_threshold: float
    emergency_probability_threshold: float
    last_updated_at: Optional[datetime] = None
    last_updated_by: Optional[str] = None
