"""Router: WebSocket untuk notifikasi realtime."""

from fastapi import APIRouter

router = APIRouter(tags=["WebSocket"])


# TODO Minggu 12: Implementasi WebSocket
# WS /ws/alerts   — push notifikasi sirine ke warga
# WS /ws/sos      — push tiket SOS ke admin dashboard
