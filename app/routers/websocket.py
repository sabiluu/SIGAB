"""
Router: WebSocket endpoints untuk notifikasi realtime
dengan filter per desa/wilayah.

Endpoints:
  WS /ws/alerts?village_id=X  — push peringatan banjir ke warga desa X
  WS /ws/sos                  — push tiket SOS ke admin dashboard
  WS /ws/dashboard            — data realtime dashboard admin
  GET /ws/status              — cek jumlah koneksi aktif (termasuk per village)
"""

import json
import logging
from typing import Optional
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
    await ws_manager.connect(websocket, channel="dashboard", role="admin")
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
async def ws_alerts(
    websocket: WebSocket,
    village_id: Optional[int] = Query(None, description="ID desa warga untuk filter notifikasi"),
    user_id: Optional[int] = Query(None, description="ID user (opsional, untuk tracking)"),
    role: Optional[str] = Query(None, description="Role user: 'user' atau 'admin'"),
):
    """
    WebSocket untuk warga — menerima push notifikasi:
    - Peringatan banjir (perubahan level risiko desa)
    - Status darurat (aktivasi/deaktivasi mode evakuasi)
    - Broadcast info umum dari petugas

    Query params:
    - village_id: wajib agar alert dikirim hanya ke desa yang relevan.
      Jika tidak dikirim, client hanya menerima broadcast global.
    - user_id: opsional, untuk tracking koneksi.
    - role: opsional, 'admin' akan menerima alert semua desa.
    """
    client = await ws_manager.connect(
        websocket,
        channel="alerts",
        village_id=village_id,
        user_id=user_id,
        role=role,
    )
    try:
        # Kirim pesan selamat datang + info filter aktif
        welcome = {
            "type": "connected",
            "channel": "alerts",
            "message": "Terhubung ke sistem peringatan dini SiagaBencana.",
            "filter": {
                "village_id": village_id,
                "info": (
                    f"Alert akan dikirim khusus untuk desa ID {village_id}."
                    if village_id
                    else "Tidak ada filter desa aktif — hanya menerima broadcast global."
                ),
            },
        }
        await ws_manager.send_personal(websocket, welcome)

        # Keep-alive loop — terima ping/pesan dari client
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Client bisa mengirim ping untuk keep-alive
                if msg.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})

                # Client bisa update village_id secara dinamis tanpa reconnect
                elif msg.get("type") == "update_village":
                    new_village_id = msg.get("village_id")
                    if new_village_id is not None:
                        client.village_id = int(new_village_id)
                        await ws_manager.send_personal(websocket, {
                            "type": "village_updated",
                            "village_id": client.village_id,
                            "message": f"Filter desa diperbarui ke ID {client.village_id}.",
                        })
                        logger.info(
                            f"[WS alerts] Client updated village_id to {client.village_id}"
                        )

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
    await ws_manager.connect(websocket, channel="sos", role="admin")
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
    """Cek jumlah koneksi WebSocket aktif per channel, termasuk detail per village."""
    stats = ws_manager.get_connection_stats()
    return {
        "alerts": stats.get("alerts", {"total": 0}),
        "sos": stats.get("sos", {"total": 0}),
        "general": stats.get("general", {"total": 0}),
        "dashboard": stats.get("dashboard", {"total": 0}),
        "total": ws_manager.get_connection_count(),
    }
