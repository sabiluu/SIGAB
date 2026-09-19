"""Router: Data Desa (Villages)."""

from fastapi import APIRouter

router = APIRouter(prefix="/villages", tags=["Villages"])


# TODO Minggu 5: Implementasi endpoint
# GET  /villages          — daftar semua desa + risk level
# GET  /villages/{id}     — detail satu desa
