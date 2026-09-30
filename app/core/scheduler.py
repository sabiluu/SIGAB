"""
Scheduler (Cron Job) untuk menjalankan task latar belakang secara otomatis.
Menggunakan APScheduler untuk menjalankan Flood Engine setiap 30 menit.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
import asyncio

from .database import SessionLocal
from ..services.flood_engine import assess_and_update_flood_risks

logger = logging.getLogger("scheduler")

# Inisialisasi scheduler
scheduler = AsyncIOScheduler()

async def run_flood_engine_job():
    """Job untuk menjalankan update risiko banjir."""
    logger.info("[Scheduler] Memulai eksekusi Flood Engine otomatis...")
    db: Session = SessionLocal()
    try:
        # Jalankan kalkulasi risiko (akan mengambil cuaca, debit, dan hitung probabilitas)
        result = await assess_and_update_flood_risks(db)
        logger.info(f"[Scheduler] Flood Engine selesai: Diperbarui {result['villages_updated']} desa. "
                    f"Notifikasi terkirim: {result['alerts_sent']}.")
        
        # Broadcast dashboard snapshot
        from ..services.dashboard_builder import build_dashboard_snapshot
        from ..services.ws_manager import ws_manager
        
        snapshot = build_dashboard_snapshot(db)
        await ws_manager.broadcast("dashboard", snapshot)
        logger.info("[Scheduler] Dashboard snapshot broadcasted to all connected clients.")
    except Exception as e:
        logger.error(f"[Scheduler] Terjadi kesalahan saat menjalankan Flood Engine: {e}")
    finally:
        db.close()


def start_scheduler():
    """Mulai scheduler saat aplikasi startup."""
    # Jadwalkan Flood Engine berjalan setiap 30 menit
    scheduler.add_job(
        run_flood_engine_job,
        trigger=IntervalTrigger(minutes=30),
        id="flood_engine_job",
        name="Update Probabilitas Banjir Periodik",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("[Scheduler] APScheduler berhasil dimulai. Flood Engine dijadwalkan berjalan setiap 30 menit.")

def stop_scheduler():
    """Hentikan scheduler saat aplikasi shutdown."""
    scheduler.shutdown()
    logger.info("[Scheduler] APScheduler dihentikan.")
