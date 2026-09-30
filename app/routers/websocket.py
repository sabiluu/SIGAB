"""
Router: WebSocket endpoints untuk notifikasi realtime.

Endpoints:
  WS /ws/alerts  — push peringatan banjir ke warga
  WS /ws/sos     — push tiket SOS ke admin dashboard
  GET /ws/status — cek jumlah koneksi aktif
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from ..services.ws_manager import ws_manager
from ..core.database import SessionLocal
from ..services.dashboard_builder import build_dashboard_snapshot

logger = logging.getLogger("ws_router")

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    """
    WebSocket endpoint untuk data dashboard real-time.
    Saat connect: kirim snapshot terkini.
    """
    await ws_manager.connect(websocket, channel="dashboard")
    try:
        # Kirim snapshot awal
        db = SessionLocal()
        try:
            snapshot = build_dashboard_snapshot(db)
            await websocket.send_text(json.dumps(snapshot, default=str))
        finally:
            db.close()

        # Keep alive — tunggu pesan dari client (ping/pong)
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, channel="dashboard")
    except Exception as e:
        logger.error(f"[WS dashboard] Error: {e}")
        await ws_manager.disconnect(websocket, channel="dashboard")


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    """
    WebSocket untuk warga — menerima push notifikasi:
    - Peringatan banjir (perubahan level risiko desa)
    - Status darurat (aktivasi/deaktivasi mode evakuasi)
    - Broadcast info umum dari petugas
    """
    await ws_manager.connect(websocket, channel="alerts")
    try:
        # Kirim pesan selamat datang
        await ws_manager.send_personal(websocket, {
            "type": "connected",
            "channel": "alerts",
            "message": "Terhubung ke sistem peringatan dini SiagaBencana.",
        })

        # Keep-alive loop — terima ping/pesan dari client
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Client bisa mengirim ping untuk keep-alive
                if msg.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, channel="alerts")
    except Exception as e:
        logger.error(f"[WS alerts] Error: {e}")
        await ws_manager.disconnect(websocket, channel="alerts")


@router.websocket("/ws/sos")
async def ws_sos(websocket: WebSocket):
    """
    WebSocket untuk admin/petugas BPBD — menerima push notifikasi:
    - Tiket SOS baru masuk
    - Update status tiket SOS
    - Perubahan level darurat desa
    """
    await ws_manager.connect(websocket, channel="sos")
    try:
        await ws_manager.send_personal(websocket, {
            "type": "connected",
            "channel": "sos",
            "message": "Terhubung ke dashboard SOS — Pusdalops BPBD.",
        })

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, channel="sos")
    except Exception as e:
        logger.error(f"[WS sos] Error: {e}")
        await ws_manager.disconnect(websocket, channel="sos")


@router.get("/ws/status")
def ws_connection_status():
    """Cek jumlah koneksi WebSocket aktif per channel."""
    return {
        "alerts": ws_manager.get_connection_count("alerts"),
        "sos": ws_manager.get_connection_count("sos"),
        "general": ws_manager.get_connection_count("general"),
        "total": ws_manager.get_connection_count(),
    }
