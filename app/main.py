"""
SiagaBencana — FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.scheduler import start_scheduler, stop_scheduler
from .core.config import settings
from .routers import (
    auth_router,
    villages_router,
    shelters_router,
    evac_router,
    sos_router,
    flood_router,
    websocket_router,
    notifications_router,
    emergency_router,
    dashboard_router,
    audit_logs_router,
    config_router,
    configs_router,
    users_router,
    health_router,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event
    start_scheduler()
    yield
    # Shutdown event
    stop_scheduler()

app = FastAPI(
    title="SiagaBencana API",
    description="Sistem Informasi Siaga Bencana Banjir — Kecamatan Baureno",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware dengan pengetatan domain produksi & whitelist metode HTTP
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=settings.CORS_EXPOSE_HEADERS,
    max_age=settings.CORS_MAX_AGE,
)

# Register primary routers (root paths)
app.include_router(auth_router)
app.include_router(villages_router)
app.include_router(shelters_router)
app.include_router(evac_router)
app.include_router(sos_router)
app.include_router(flood_router)
app.include_router(websocket_router)
app.include_router(notifications_router)
app.include_router(emergency_router)
app.include_router(dashboard_router)
app.include_router(audit_logs_router)
app.include_router(config_router)
app.include_router(configs_router)
app.include_router(users_router)
app.include_router(health_router)

# Register aliases dengan prefiks /api sesuai spesifikasi PRD Tabel III
app.include_router(villages_router, prefix="/api")
app.include_router(shelters_router, prefix="/api")
app.include_router(sos_router, prefix="/api")
app.include_router(flood_router, prefix="/api")
app.include_router(emergency_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(audit_logs_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(users_router, prefix="/api")


import os
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger("sigab.main")

# Ensure upload directories exist using project root path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "sos"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "emergency"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Terjadi kesalahan internal pada server. Silakan coba beberapa saat lagi.",
            "path": request.url.path,
        },
    )

@app.get("/", tags=["Root"])
def root():
    return {"message": "SiagaBencana API is running 🚀"}
