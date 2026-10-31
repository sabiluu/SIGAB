"""
WebSocket Connection Manager — mengelola koneksi WebSocket aktif
dengan dukungan filter per desa/wilayah.

Channel yang didukung:
  - 'alerts'    → push peringatan banjir ke warga (filtered per village)
  - 'sos'       → push tiket SOS ke admin dashboard
  - 'general'   → broadcast umum ke semua client
  - 'dashboard' → data realtime dashboard admin

Setiap koneksi di channel 'alerts' menyimpan metadata village_id
agar broadcast bisa ditargetkan hanya ke warga desa yang relevan.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Set, Optional
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


@dataclass
class ClientConnection:
    """Wrapper WebSocket dengan metadata untuk filtering."""
    websocket: WebSocket
    channel: str
    village_id: Optional[int] = None
    user_id: Optional[int] = None
    role: Optional[str] = None  # 'user' | 'admin'
    connected_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __hash__(self):
        return id(self.websocket)

    def __eq__(self, other):
        if isinstance(other, ClientConnection):
            return self.websocket is other.websocket
        return False


class ConnectionManager:
    """Mengelola koneksi WebSocket per channel dengan dukungan filter village."""

    def __init__(self):
        self._channels: Dict[str, Set[ClientConnection]] = {
            "alerts": set(),
            "sos": set(),
            "general": set(),
            "dashboard": set(),
        }
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        channel: str = "general",
        village_id: Optional[int] = None,
        user_id: Optional[int] = None,
        role: Optional[str] = None,
    ) -> ClientConnection:
        """Terima koneksi WebSocket dan tambahkan ke channel dengan metadata."""
        await websocket.accept()

        client = ClientConnection(
            websocket=websocket,
            channel=channel,
            village_id=village_id,
            user_id=user_id,
            role=role,
        )

        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(client)

        village_info = f", village_id={village_id}" if village_id else ""
        role_info = f", role={role}" if role else ""
        logger.info(
            f"[WS] Client connected to '{channel}'{village_info}{role_info}"
            f" — total: {len(self._channels[channel])}"
        )
        return client

    async def disconnect(self, websocket: WebSocket, channel: str = "general"):
        """Hapus koneksi dari channel (lookup berdasarkan WebSocket object)."""
        async with self._lock:
            connections = self._channels.get(channel, set())
            to_remove = None
            for client in connections:
                if client.websocket is websocket:
                    to_remove = client
                    break
            if to_remove:
                connections.discard(to_remove)
        logger.info(f"[WS] Client disconnected from '{channel}'")

    # ── Broadcast ke SEMUA client di channel (tanpa filter) ──────────

    async def broadcast(self, channel: str, message: dict):
        """Kirim pesan ke SEMUA koneksi aktif di channel tertentu (tanpa filter)."""
        payload = json.dumps(message, default=str)
        dead: List[ClientConnection] = []

        connections = self._channels.get(channel, set()).copy()
        for client in connections:
            try:
                await client.websocket.send_text(payload)
            except Exception:
                dead.append(client)

        if dead:
            async with self._lock:
                for client in dead:
                    self._channels.get(channel, set()).discard(client)

    async def broadcast_all(self, message: dict):
        """Kirim pesan ke SEMUA channel."""
        for channel in self._channels:
            await self.broadcast(channel, message)

    # ── Broadcast TERTARGET per desa/wilayah ─────────────────────────

    async def broadcast_to_village(
        self,
        channel: str,
        village_id: int,
        message: dict,
    ):
        """
        Kirim pesan hanya ke client yang terdaftar di village tertentu.
        Client tanpa village_id (misal admin) juga TIDAK menerima pesan ini.
        Gunakan broadcast_to_village_and_admins() jika admin perlu ikut menerima.
        """
        payload = json.dumps(message, default=str)
        dead: List[ClientConnection] = []

        connections = self._channels.get(channel, set()).copy()
        for client in connections:
            if client.village_id == village_id:
                try:
                    await client.websocket.send_text(payload)
                except Exception:
                    dead.append(client)

        if dead:
            async with self._lock:
                for client in dead:
                    self._channels.get(channel, set()).discard(client)

    async def broadcast_to_villages(
        self,
        channel: str,
        village_ids: List[int],
        message: dict,
    ):
        """Kirim pesan ke client di beberapa village sekaligus."""
        village_set = set(village_ids)
        payload = json.dumps(message, default=str)
        dead: List[ClientConnection] = []

        connections = self._channels.get(channel, set()).copy()
        for client in connections:
            if client.village_id in village_set:
                try:
                    await client.websocket.send_text(payload)
                except Exception:
                    dead.append(client)

        if dead:
            async with self._lock:
                for client in dead:
                    self._channels.get(channel, set()).discard(client)

    async def broadcast_to_village_and_admins(
        self,
        channel: str,
        village_id: int,
        message: dict,
    ):
        """
        Kirim pesan ke warga di village tertentu DAN ke semua admin
        di channel yang sama.
        """
        payload = json.dumps(message, default=str)
        dead: List[ClientConnection] = []

        connections = self._channels.get(channel, set()).copy()
        for client in connections:
            should_send = (
                client.village_id == village_id
                or client.role == "admin"
            )
            if should_send:
                try:
                    await client.websocket.send_text(payload)
                except Exception:
                    dead.append(client)

        if dead:
            async with self._lock:
                for client in dead:
                    self._channels.get(channel, set()).discard(client)

    # ── Broadcast khusus ke admin ────────────────────────────────────

    async def broadcast_to_admins(self, channel: str, message: dict):
        """Kirim pesan hanya ke client dengan role='admin' di channel tertentu."""
        payload = json.dumps(message, default=str)
        dead: List[ClientConnection] = []

        connections = self._channels.get(channel, set()).copy()
        for client in connections:
            if client.role == "admin":
                try:
                    await client.websocket.send_text(payload)
                except Exception:
                    dead.append(client)

        if dead:
            async with self._lock:
                for client in dead:
                    self._channels.get(channel, set()).discard(client)

    # ── Personal message & utilitas ──────────────────────────────────

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

    def get_village_connection_count(self, channel: str, village_id: int) -> int:
        """Hitung jumlah koneksi aktif di village tertentu."""
        connections = self._channels.get(channel, set())
        return sum(1 for c in connections if c.village_id == village_id)

    def get_connection_stats(self) -> dict:
        """Statistik lengkap koneksi per channel dan per village."""
        stats = {}
        for channel, connections in self._channels.items():
            village_counts: Dict[Optional[int], int] = {}
            for client in connections:
                vid = client.village_id
                village_counts[vid] = village_counts.get(vid, 0) + 1
            stats[channel] = {
                "total": len(connections),
                "by_village": {
                    str(k) if k is not None else "unregistered": v
                    for k, v in village_counts.items()
                },
            }
        return stats


# Singleton instance — dipakai oleh seluruh aplikasi
ws_manager = ConnectionManager()
