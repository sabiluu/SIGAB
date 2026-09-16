"""
SiagaBencana — FastAPI Application Entry Point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .routers import (
    auth_router,
    villages_router,
    shelters_router,
    sos_router,
    flood_router,
    websocket_router,
)

app = FastAPI(
    title="SiagaBencana API",
    description="Sistem Informasi Siaga Bencana Banjir — Kecamatan Baureno",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
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


@app.get("/", tags=["Root"])
def root():
    return {"message": "SiagaBencana API is running 🚀"}
