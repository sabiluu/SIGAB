"""
Router: Notifikasi — CRUD & push notifikasi peringatan dini.

Endpoints:
  GET    /notifications          — Daftar notifikasi user yang login
  POST   /notifications/read/{id} — Tandai notifikasi sebagai sudah dibaca
  POST   /notifications/read-all — Tandai semua notifikasi sebagai sudah dibaca
  DELETE /notifications/{id}     — Hapus notifikasi
  GET    /notifications/unread-count — Jumlah notifikasi belum dibaca
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..models.notification import Notification
from ..models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# --- Schemas ---
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    is_read: bool
    is_pushed: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    count: int


# --- Endpoints ---
@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mengambil daftar notifikasi milik user yang sedang login."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Menghitung jumlah notifikasi yang belum dibaca."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.post("/read/{notification_id}")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Tandai satu notifikasi sebagai sudah dibaca."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    notif.is_read = True
    db.commit()
    return {"message": "Notifikasi ditandai sebagai dibaca."}


@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Tandai semua notifikasi milik user sebagai sudah dibaca."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Semua notifikasi ditandai sebagai dibaca."}


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Hapus notifikasi milik user."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    db.delete(notif)
    db.commit()
    return None
