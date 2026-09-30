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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/", tags=["Root"])
def root():
    return {"message": "SiagaBencana API is running 🚀"}
