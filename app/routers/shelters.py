"""Router: Shelter / Posko Pengungsian."""

from fastapi import APIRouter

router = APIRouter(prefix="/shelters", tags=["Shelters"])


# TODO Minggu 5: Implementasi endpoint
# GET  /shelters           — daftar semua shelter
# GET  /shelters/{id}      — detail shelter
# POST /shelters           — tambah shelter (admin)
