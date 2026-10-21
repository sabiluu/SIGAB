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
    sos_router,
    flood_router,
    websocket_router,
    notifications_router,
    emergency_router,
    dashboard_router,
    audit_logs_router,
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

# Register routers
app.include_router(auth_router)
app.include_router(villages_router)
app.include_router(shelters_router)
app.include_router(sos_router)
app.include_router(flood_router)
app.include_router(websocket_router)
app.include_router(notifications_router)
app.include_router(emergency_router)
app.include_router(dashboard_router)
app.include_router(audit_logs_router)


import os
from fastapi.staticfiles import StaticFiles

# Ensure upload directories exist
os.makedirs("uploads/sos", exist_ok=True)
os.makedirs("uploads/emergency", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/", tags=["Root"])
def root():
    return {"message": "SiagaBencana API is running 🚀"}
