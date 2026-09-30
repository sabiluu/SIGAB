"""
Service: Notification Broadcaster — mengirim notifikasi ke database
dan broadcast via WebSocket secara bersamaan.

Digunakan oleh router SOS dan Flood untuk push notifikasi real-time.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from ..models.notification import Notification
from ..models.user import User
from .ws_manager import ws_manager

logger = logging.getLogger("notifier")


async def broadcast_flood_alert(
    db: Session,
    village_name: str,
    village_id: int,
    risk_level: str,
    probability: float,
):
    """
    Broadcast peringatan banjir ke semua warga via WebSocket channel 'alerts'.
    Juga simpan notifikasi ke database untuk semua user di desa tersebut.
    """
    level_labels = {
        "rendah": "🟢 RENDAH",
        "sedang": "🟡 SEDANG",
        "tinggi": "🟠 TINGGI",
        "awas": "🔴 AWAS",
    }
    level_label = level_labels.get(risk_level, risk_level.upper())

    title = f"Peringatan Banjir — {village_name}"
    message = (
        f"Level risiko banjir di Desa {village_name} berubah menjadi {level_label} "
        f"dengan probabilitas {probability}%. "
    )

    if risk_level in ("tinggi", "awas"):
        message += "Segera persiapkan diri untuk evakuasi!"
    elif risk_level == "sedang":
        message += "Harap waspada dan pantau informasi terkini."

    # Broadcast via WebSocket ke channel 'alerts' (warga) dan 'sos' (admin)
    ws_payload = {
        "type": "flood_alert",
        "data": {
            "village_id": village_id,
            "village_name": village_name,
            "risk_level": risk_level,
            "probability": probability,
            "title": title,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        },
    }
    await ws_manager.broadcast("alerts", ws_payload)
    await ws_manager.broadcast("sos", ws_payload)

    # Simpan notifikasi ke database untuk user di desa tersebut
    try:
        users_in_village = db.query(User).filter(
            User.village_id == village_id,
            User.is_active == True,
            User.notification_enabled == True,
        ).all()

        for user in users_in_village:
            notif = Notification(
                user_id=user.id,
                type="early_warning",
                title=title,
                message=message,
                reference_type="village",
                reference_id=village_id,
                is_read=False,
                is_pushed=True,
            )
            db.add(notif)
        db.flush()
    except Exception as e:
        logger.error(f"[Notifier] Gagal simpan notifikasi flood_alert: {e}")


async def broadcast_sos_event(
    db: Session,
    event_type: str,
    ticket_id: int,
    ticket_number: str,
    reporter_name: str,
    village_name: str,
    status: str,
    village_id: int,
    extra_data: Optional[dict] = None,
):
    """
    Broadcast event SOS ke admin dashboard via WebSocket channel 'sos'.
    Juga simpan notifikasi ke database untuk semua admin.
    
    event_type: 'sos_new', 'sos_updated', 'sos_verified', 'sos_dispatched', dll.
    """
    event_labels = {
        "sos_new": "🆘 SOS Baru",
        "sos_updated": "📝 SOS Diperbarui",
        "sos_verified": "✅ SOS Diverifikasi",
        "sos_dispatched": "🚑 Tim Dikirim",
        "sos_arrived": "📍 Tim Tiba",
        "sos_completed": "✔️ SOS Selesai",
        "sos_rejected": "❌ SOS Ditolak",
    }
    label = event_labels.get(event_type, "📢 Update SOS")

    title = f"{label} — {ticket_number}"
    message = f"Tiket SOS dari {reporter_name} di Desa {village_name}. Status: {status}."

    # Broadcast via WebSocket ke channel 'sos' (admin)
    ws_payload = {
        "type": event_type,
        "data": {
            "ticket_id": ticket_id,
            "ticket_number": ticket_number,
            "reporter_name": reporter_name,
            "village_name": village_name,
            "village_id": village_id,
            "status": status,
            "title": title,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            **(extra_data or {}),
        },
    }
    await ws_manager.broadcast("sos", ws_payload)

    # Jika SOS baru, juga notify ke warga di desa ybs via alerts
    if event_type == "sos_new":
        await ws_manager.broadcast("alerts", {
            "type": "sos_nearby",
            "data": {
                "village_id": village_id,
                "village_name": village_name,
                "message": f"Ada permintaan SOS dari warga di Desa {village_name}.",
                "timestamp": datetime.now().isoformat(),
            },
        })

    # Simpan notifikasi ke database untuk semua admin
    try:
        admins = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
        ).all()

        for admin in admins:
            notif = Notification(
                user_id=admin.id,
                type="sos_update",
                title=title,
                message=message,
                reference_type="sos_ticket",
                reference_id=ticket_id,
                is_read=False,
                is_pushed=True,
            )
            db.add(notif)
        db.flush()
    except Exception as e:
        logger.error(f"[Notifier] Gagal simpan notifikasi sos_event: {e}")


async def broadcast_emergency_status(
    village_name: str,
    village_id: int,
    is_active: bool,
):
    """Broadcast perubahan status darurat ke semua channel."""
    status_text = "DIAKTIFKAN" if is_active else "DINONAKTIFKAN"
    ws_payload = {
        "type": "emergency_status",
        "data": {
            "village_id": village_id,
            "village_name": village_name,
            "is_emergency_active": is_active,
            "message": f"Mode Evakuasi Darurat di Desa {village_name} telah {status_text}.",
            "timestamp": datetime.now().isoformat(),
        },
    }
    await ws_manager.broadcast("alerts", ws_payload)
    await ws_manager.broadcast("sos", ws_payload)


def create_emergency_notifications(
    db: Session,
    village_id: int,
    village_name: str,
    probability: float,
    is_active: bool,
    trigger_name: str = "Sistem",
):
    """Simpan notifikasi darurat ke DB untuk semua user di desa yang terdampak dan para admin."""
    if is_active:
        notif_type = "emergency_alert"
        title = f"🚨 MODE DARURAT — Desa {village_name}"
        message = (
            f"Mode Evakuasi Darurat telah DIAKTIFKAN di Desa {village_name} "
            f"oleh {trigger_name}. Probabilitas banjir saat ini: {probability}%. "
            f"Segera menuju posko pengungsian terdekat!"
        )
    else:
        notif_type = "system_info"
        title = f"✅ Mode Darurat Berakhir — Desa {village_name}"
        message = (
            f"Mode Evakuasi Darurat di Desa {village_name} telah DINONAKTIFKAN "
            f"oleh {trigger_name}. Situasi telah terkendali."
        )

    try:
        # Notifikasi untuk semua user di desa
        users_in_village = db.query(User).filter(
            User.village_id == village_id,
            User.is_active == True,
            User.notification_enabled == True,
        ).all()

        for user in users_in_village:
            notif = Notification(
                user_id=user.id,
                type=notif_type,
                title=title,
                message=message,
                reference_type="emergency_status",
                reference_id=village_id,
                is_read=False,
                is_pushed=True,
            )
            db.add(notif)

        # Notifikasi untuk semua admin juga
        admins = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
        ).all()
        
        for admin in admins:
            # Skip jika admin sudah termasuk di user village
            existing = any(u.id == admin.id for u in users_in_village)
            if not existing:
                notif = Notification(
                    user_id=admin.id,
                    type=notif_type,
                    title=title,
                    message=message,
                    reference_type="emergency_status",
                    reference_id=village_id,
                    is_read=False,
                    is_pushed=True,
                )
                db.add(notif)
        db.flush()
    except Exception as e:
        logger.error(f"[Notifier] Gagal simpan notifikasi emergency: {e}")
