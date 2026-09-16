"""Router: SOS / Tiket Darurat."""

from fastapi import APIRouter

router = APIRouter(prefix="/sos", tags=["SOS"])


# TODO Minggu 5: Implementasi endpoint
# POST /sos               — buat tiket SOS baru (warga)
# GET  /sos               — daftar tiket (admin)
# PATCH /sos/{id}/status  — update status tiket (admin)
