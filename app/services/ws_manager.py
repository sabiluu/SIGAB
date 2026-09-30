"""
WebSocket Connection Manager — mengelola koneksi WebSocket aktif.

Channel yang didukung:
  - 'alerts'  → push peringatan banjir ke warga
  - 'sos'     → push tiket SOS ke admin dashboard
  - 'general' → broadcast umum ke semua client
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Set, Optional
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


class ConnectionManager:
    """Mengelola koneksi WebSocket per channel."""

    def __init__(self):
        # channel_name -> set of active WebSocket connections
        self._channels: Dict[str, Set[WebSocket]] = {
            "alerts": set(),
            "sos": set(),
            "general": set(),
        }
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, channel: str = "general"):
        """Terima koneksi WebSocket dan tambahkan ke channel."""
        await websocket.accept()
        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(websocket)
        logger.info(f"[WS] Client connected to '{channel}' — total: {len(self._channels[channel])}")

    async def disconnect(self, websocket: WebSocket, channel: str = "general"):
        """Hapus koneksi dari channel."""
        async with self._lock:
            self._channels.get(channel, set()).discard(websocket)
        logger.info(f"[WS] Client disconnected from '{channel}'")

    async def broadcast(self, channel: str, message: dict):
        """Kirim pesan ke semua koneksi aktif di channel tertentu."""
        payload = json.dumps(message, default=str)
        dead_connections: List[WebSocket] = []

        connections = self._channels.get(channel, set()).copy()
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_connections.append(ws)

        # Bersihkan koneksi yang sudah mati
        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self._channels.get(channel, set()).discard(ws)

    async def broadcast_all(self, message: dict):
        """Kirim pesan ke SEMUA channel."""
        for channel in self._channels:
            await self.broadcast(channel, message)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Kirim pesan ke satu koneksi spesifik."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception:
            pass

    def get_connection_count(self, channel: Optional[str] = None) -> int:
        """Hitung jumlah koneksi aktif."""
        if channel:
            return len(self._channels.get(channel, set()))
        return sum(len(conns) for conns in self._channels.values())


# Singleton instance — dipakai oleh seluruh aplikasi
ws_manager = ConnectionManager()
