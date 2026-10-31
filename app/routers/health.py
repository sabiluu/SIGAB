"""
Router: Health Check & System Diagnostics (/health).
Menyediakan endpoint pemantauan kesehatan sistem (Liveness, Readiness, dan Diagnostics)
untuk monitoring server, Kubernetes / Docker health probes, UptimeRobot, dan operasional BPBD.

Endpoints:
  GET /health       — Healthcheck lengkap (Database, Scheduler, WebSocket, Uptime, & Environment)
  GET /health/live  — Liveness probe ringan (mengembalikan status 200 OK jika proses berjalan)
  GET /health/ready — Readiness probe (menguji kesiapan database sebelum menerima trafik)
"""

import sys
import time
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.database import get_db, engine
from ..core.config import settings
from ..core.timezone import get_wib_now
from ..core.scheduler import scheduler
from ..services.ws_manager import ws_manager

router = APIRouter(tags=["Health & Monitoring"])

# Catat waktu awal aplikasi dijalankan
APP_START_TIME = get_wib_now()
APP_START_PERF = time.perf_counter()


def _format_uptime(seconds: float) -> str:
    """Format durasi detik ke teks manusiawi (hari, jam, menit, detik)."""
    s = int(seconds)
    days, s = divmod(s, 86400)
    hours, s = divmod(s, 3600)
    minutes, seconds_rem = divmod(s, 60)

    parts = []
    if days > 0:
        parts.append(f"{days} hari")
    if hours > 0:
        parts.append(f"{hours} jam")
    if minutes > 0:
        parts.append(f"{minutes} menit")
    parts.append(f"{seconds_rem} detik")
    return ", ".join(parts)


@router.get("/health/live")
def liveness_probe():
    """
    Kubernetes / Docker Liveness Probe.
    Memverifikasi apakah proses backend FastAPI masih berjalan (tidak deadlock/hung).
    """
    return {
        "status": "live",
        "timestamp": get_wib_now().isoformat(),
    }


@router.get("/health/ready")
def readiness_probe(response: Response, db: Session = Depends(get_db)):
    """
    Kubernetes / Docker Readiness Probe.
    Memverifikasi apakah database siap menerima query. Mengembalikan HTTP 503 jika DB gagal.
    """
    start_check = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start_check) * 1000, 2)
        return {
            "status": "ready",
            "database": "connected",
            "latency_ms": latency_ms,
            "timestamp": get_wib_now().isoformat(),
        }
    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "database": "disconnected",
            "error": str(e),
            "timestamp": get_wib_now().isoformat(),
        }


@router.get("/health")
@router.get("/api/health")
def full_health_check(response: Response, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Health Check Komprehensif.
    Memeriksa kesehatan seluruh subsistem:
    - Koneksi database & latensi query (ms)
    - Status APScheduler & jadwal job background Flood Engine
    - Jumlah koneksi aktif WebSocket per channel
    - Waktu aktif (uptime) server & ringkasan environment
    """
    now = get_wib_now()
    uptime_sec = round(time.perf_counter() - APP_START_PERF, 2)
    overall_status = "healthy"

    # 1. Pengecekan Database
    db_info: Dict[str, Any] = {}
    try:
        db_start = time.perf_counter()
        db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
        db_info = {
            "status": "connected",
            "latency_ms": latency_ms,
            "dialect": engine.dialect.name,
        }
    except Exception as exc:
        overall_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        db_info = {
            "status": "disconnected",
            "error": str(exc),
            "dialect": engine.dialect.name,
        }

    # 2. Pengecekan APScheduler
    scheduler_info: Dict[str, Any] = {}
    try:
        is_running = scheduler.running
        jobs_data = []
        for job in scheduler.get_jobs():
            next_run = job.next_run_time.strftime("%Y-%m-%d %H:%M:%S") if job.next_run_time else None
            jobs_data.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": next_run,
            })
        scheduler_info = {
            "status": "running" if is_running else "stopped",
            "jobs_count": len(jobs_data),
            "jobs": jobs_data,
        }
        if not is_running:
            if overall_status == "healthy":
                overall_status = "degraded"
    except Exception as exc:
        scheduler_info = {
            "status": "error",
            "error": str(exc),
        }

    # 3. Pengecekan WebSocket Manager
    ws_info: Dict[str, Any] = {}
    try:
        total_connections = ws_manager.get_connection_count()
        channels_counts = {
            channel: ws_manager.get_connection_count(channel)
            for channel in ["alerts", "dashboard", "sos", "general"]
        }
        ws_info = {
            "status": "active",
            "total_connections": total_connections,
            "channels": channels_counts,
        }
    except Exception as exc:
        ws_info = {
            "status": "error",
            "error": str(exc),
        }

    # 4. Ringkasan Environment & Integrasi Eksternal
    ext_apis = {
        "open_meteo_weather": settings.OPEN_METEO_BASE_URL,
        "open_meteo_flood": settings.OPEN_METEO_FLOOD_BASE_URL,
        "osrm_routing": settings.OSRM_BASE_URL,
        "timeout_seconds": settings.EXTERNAL_API_TIMEOUT_SECONDS,
    }

    return {
        "status": overall_status,
        "timestamp": now.isoformat(),
        "server_time_wib": now.strftime("%d %b %Y • %H:%M:%S WIB"),
        "started_at": APP_START_TIME.isoformat(),
        "uptime_seconds": uptime_sec,
        "uptime_human": _format_uptime(uptime_sec),
        "app_info": {
            "name": "SiagaBencana API",
            "version": "0.1.0",
            "environment": settings.ENVIRONMENT,
            "is_production": settings.is_production,
            "python_version": sys.version.split()[0],
        },
        "components": {
            "database": db_info,
            "scheduler": scheduler_info,
            "websocket": ws_info,
            "external_services": ext_apis,
        },
    }
