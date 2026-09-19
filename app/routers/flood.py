"""Router: Data Banjir (Flood Logs)."""

from fastapi import APIRouter

router = APIRouter(prefix="/flood", tags=["Flood"])


# TODO Minggu 8-9: Implementasi endpoint
# GET  /flood/latest       — data risiko terkini per desa
# GET  /flood/history/{village_id} — histori log banjir
