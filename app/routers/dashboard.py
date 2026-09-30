from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..core.database import get_db
from ..core.deps import get_current_admin_user
from ..models.user import User
from ..models.village import Village
from ..models.sos_ticket import SOSTicket
from ..models.emergency_status import EmergencyStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Mengambil ringkasan statistik untuk Admin Dashboard."""
    
    # 1. Total Warga Terdaftar (Hanya role 'user')
    total_citizens = db.query(func.count(User.id)).filter(User.role == "user").scalar() or 0
    
    # 2. Total SOS Aktif (Status: 'pending' atau 'assigned')
    active_sos = db.query(func.count(SOSTicket.id)).filter(
        SOSTicket.status.in_(["pending", "assigned"])
    ).scalar() or 0
    
    # 3. Total Desa Status Awas/Tinggi
    high_risk_villages = db.query(func.count(Village.id)).filter(
        Village.current_risk_level.in_(["tinggi", "awas"])
    ).scalar() or 0
    
    # 4. Total Emergency Status Aktif
    active_emergencies = db.query(func.count(EmergencyStatus.id)).filter(
        EmergencyStatus.is_emergency_active == True
    ).scalar() or 0
    
    return {
        "success": True,
        "data": {
            "total_citizens": total_citizens,
            "active_sos": active_sos,
            "high_risk_villages": high_risk_villages,
            "active_emergencies": active_emergencies
        }
    }
