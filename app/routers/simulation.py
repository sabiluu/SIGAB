"""
Router: Flood Simulation
Endpoints:
  GET    /simulation/status
  POST   /simulation/start
  POST   /simulation/stop
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db, SessionLocal
from ..services.flood_simulation import simulation_manager

router = APIRouter(prefix="/simulation", tags=["Flood Simulation"])


@router.get("/status")
def get_simulation_status():
    """Mengambil status dan countdown simulasi banjir saat ini."""
    return simulation_manager.status


@router.post("/start")
async def start_simulation(db: Session = Depends(get_db)):
    """
    Mulai simulasi banjir bertahap untuk 4 desa:
    Kedungrejo, Kalisari, Lebaksari, Tanggungan.

    Urutan fase:
    1. AMAN (30 detik)
    2. WASPADA (30 detik)
    3. SIAGA (30 detik)
    4. AWAS (10 menit)
    5. SIAGA (30 detik)
    6. WASPADA (30 detik)
    7. AMAN (30 detik kembali normal)
    """
    if simulation_manager.is_running:
        return {
            "success": True,
            "message": "Simulasi banjir sedang berlangsung.",
            "status": simulation_manager.status,
        }

    try:
        simulation_manager.start(db_session_factory=SessionLocal)
        return {
            "success": True,
            "message": "Simulasi banjir berhasil dimulai.",
            "status": simulation_manager.status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memulai simulasi: {str(e)}")


@router.post("/stop")
async def stop_simulation(db: Session = Depends(get_db)):
    """
    Hentikan simulasi banjir dan kembalikan data desa ke kondisi real-time.
    """
    try:
        await simulation_manager.stop(db_session_factory=SessionLocal)
        return {
            "success": True,
            "message": "Simulasi banjir dihentikan. Data desa kembali ke kondisi real-time.",
            "status": simulation_manager.status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghentikan simulasi: {str(e)}")
