"""Router: Shelter / Posko Pengungsian & Rute Evakuasi."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import math

from ..core.database import get_db
from ..models.shelter import Shelter
from ..models.sos_ticket import SOSTicket
from ..schemas.shelter import ShelterResponse, ShelterUpdate, NearbyAvailableShelterResponse
from ..schemas.external import RouteResponse
from ..services.external_api import get_evacuation_route

router = APIRouter(prefix="/shelters", tags=["Shelters"])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Menghitung jarak antara dua titik koordinat GPS menggunakan formula Haversine.
    Mengembalikan jarak dalam kilometer.
    """
    R = 6371.0  # Radius bumi dalam km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.get("", response_model=List[ShelterResponse])
def get_all_shelters(db: Session = Depends(get_db)):
    """Mengambil daftar semua shelter."""
    shelters = db.query(Shelter).all()
    return shelters


@router.get("/nearby-available", response_model=List[NearbyAvailableShelterResponse])
def get_nearby_available_shelters(
    user_lat: float = Query(..., description="Latitude lokasi pengguna", ge=-90, le=90),
    user_lon: float = Query(..., description="Longitude lokasi pengguna", ge=-180, le=180),
    max_distance_km: float = Query(50.0, description="Radius pencarian maksimal (km)", ge=0.1, le=200),
    limit: int = Query(10, description="Jumlah hasil maksimal", ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Filter posko pengungsian terdekat yang kuotanya masih tersedia.
    
    Logika filter:
    1. **Aktif** — hanya posko dengan `is_active = True`
    2. **Kuota tersedia** — `capacity_occupied < capacity_total`
    3. **Dalam radius** — jarak dari lokasi pengguna ≤ `max_distance_km`
    4. **Diurutkan** — dari yang terdekat ke terjauh
    
    Query parameters:
    - `user_lat`, `user_lon`: Koordinat GPS pengguna (wajib)
    - `max_distance_km`: Radius pencarian maks, default 50 km
    - `limit`: Jumlah hasil maks, default 10
    """
    # 1. Query semua shelter aktif yang masih ada kuota
    shelters = (
        db.query(Shelter)
        .filter(
            Shelter.is_active == True,
            Shelter.capacity_occupied < Shelter.capacity_total,
        )
        .all()
    )

    # 2. Hitung jarak & filter berdasarkan radius
    results = []
    for shelter in shelters:
        s_lat = float(shelter.latitude)
        s_lon = float(shelter.longitude)
        distance_km = _haversine_km(user_lat, user_lon, s_lat, s_lon)

        if distance_km > max_distance_km:
            continue

        capacity_available = shelter.capacity_total - shelter.capacity_occupied
        occupancy_pct = (
            (shelter.capacity_occupied / shelter.capacity_total * 100)
            if shelter.capacity_total > 0
            else 0.0
        )

        results.append(
            NearbyAvailableShelterResponse(
                id=shelter.id,
                name=shelter.name,
                address=shelter.address,
                village_id=shelter.village_id,
                latitude=shelter.latitude,
                longitude=shelter.longitude,
                capacity_total=shelter.capacity_total,
                capacity_occupied=shelter.capacity_occupied,
                capacity_available=capacity_available,
                occupancy_percent=round(occupancy_pct, 1),
                is_active=shelter.is_active,
                contact_person=shelter.contact_person,
                contact_phone=shelter.contact_phone,
                distance_km=round(distance_km, 2),
                distance_meters=round(distance_km * 1000, 0),
            )
        )

    # 3. Urutkan berdasarkan jarak terdekat
    results.sort(key=lambda s: s.distance_km)

    # 4. Batasi jumlah hasil
    return results[:limit]


@router.get("/{shelter_id}", response_model=ShelterResponse)
def get_shelter_by_id(shelter_id: int, db: Session = Depends(get_db)):
    """Mengambil detail shelter berdasarkan ID."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return shelter


from ..core.deps import get_current_admin_user
from ..schemas.shelter import ShelterCreate, ShelterFullUpdate
from ..services.ws_manager import ws_manager
from ..services.dashboard_builder import build_dashboard_snapshot

async def broadcast_shelter_update(db: Session):
    """Kirim snapshot realtime terbaru ke semua client websocket yang memantau posko."""
    try:
        snapshot = build_dashboard_snapshot(db)
        await ws_manager.broadcast("dashboard", snapshot)
    except Exception as e:
        print(f"[Shelters] Failed to broadcast dashboard update: {e}")


@router.put("/{shelter_id}/capacity", response_model=ShelterResponse)
async def update_shelter_capacity(
    shelter_id: int,
    shelter_update: ShelterUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Update kapasitas pengungsi di shelter."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")

    shelter.capacity_occupied = shelter_update.capacity_occupied
    db.commit()
    db.refresh(shelter)
    await broadcast_shelter_update(db)
    return shelter


@router.post("", response_model=ShelterResponse, status_code=201)
async def create_shelter(
    shelter_in: ShelterCreate, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menambahkan data shelter baru."""
    new_shelter = Shelter(**shelter_in.model_dump())
    db.add(new_shelter)
    db.commit()
    db.refresh(new_shelter)
    await broadcast_shelter_update(db)
    return new_shelter


@router.put("/{shelter_id}", response_model=ShelterResponse)
async def update_shelter_info(
    shelter_id: int, 
    shelter_in: ShelterFullUpdate, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Mengubah data lengkap shelter."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")
    
    update_data = shelter_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(shelter, key, value)
        
    db.commit()
    db.refresh(shelter)
    await broadcast_shelter_update(db)
    return shelter


@router.delete("/{shelter_id}", status_code=204)
async def delete_shelter(
    shelter_id: int, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menghapus data shelter."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")

    # Proteksi 1: Cek apakah masih terdapat pengungsi aktif di posko ini
    if (shelter.capacity_occupied or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak dapat menghapus posko '{shelter.name}'. Masih terdapat {shelter.capacity_occupied} jiwa pengungsi yang terdata di posko ini. Kosongkan kapasitas atau pindahkan pengungsi terlebih dahulu.",
        )

    # Proteksi 2: Cek apakah terdapat tiket SOS aktif yang sedang ditugaskan menuju posko ini
    active_tickets_count = (
        db.query(SOSTicket)
        .filter(
            SOSTicket.shelter_destination_id == shelter_id,
            SOSTicket.status.in_(["submitted", "verified", "dispatched", "on_route", "arrived"]),
        )
        .count()
    )
    if active_tickets_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak dapat menghapus posko '{shelter.name}'. Terdapat {active_tickets_count} tiket SOS aktif yang sedang ditugaskan menuju posko ini. Selesaikan evakuasi atau alihkan posko tujuan terlebih dahulu.",
        )

    db.delete(shelter)
    db.commit()
    await broadcast_shelter_update(db)
    return None


@router.get("/{shelter_id}/route", response_model=RouteResponse)
async def get_route_to_shelter(
    shelter_id: int,
    user_lat: float = Query(..., description="Latitude lokasi asal warga", ge=-90, le=90),
    user_lon: float = Query(..., description="Longitude lokasi asal warga", ge=-180, le=180),
    db: Session = Depends(get_db),
):
    """
    Menghitung rute navigasi evakuasi darurat dari lokasi pengguna ke shelter
    menggunakan Open Source Routing Machine (OSRM).
    """
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter tujuan tidak ditemukan")

    dest_lat = float(shelter.latitude)
    dest_lon = float(shelter.longitude)

    route_data = await get_evacuation_route(
        origin_lat=user_lat,
        origin_lon=user_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
    )
    return route_data


evac_router = APIRouter(tags=["Evacuation Routing"])


@evac_router.get("/evac/route", response_model=RouteResponse)
@evac_router.get("/api/evac/route", response_model=RouteResponse)
async def calculate_evacuation_route(
    shelter_id: Optional[int] = Query(None, description="ID Shelter tujuan (opsional jika dest_lat/lon disertakan)"),
    user_lat: Optional[float] = Query(None, description="Latitude lokasi asal warga", ge=-90, le=90),
    user_lon: Optional[float] = Query(None, description="Longitude lokasi asal warga", ge=-180, le=180),
    origin_lat: Optional[float] = Query(None, description="Alias origin latitude", ge=-90, le=90),
    origin_lon: Optional[float] = Query(None, description="Alias origin longitude", ge=-180, le=180),
    dest_lat: Optional[float] = Query(None, description="Latitude posko tujuan", ge=-90, le=90),
    dest_lon: Optional[float] = Query(None, description="Longitude posko tujuan", ge=-180, le=180),
    db: Session = Depends(get_db),
):
    """
    Kalkulasi rute OSRM menuju posko evakuasi sesuai PRD Table III (GET /api/evac/route).
    """
    start_lat = user_lat if user_lat is not None else origin_lat
    start_lon = user_lon if user_lon is not None else origin_lon
    if start_lat is None or start_lon is None:
        raise HTTPException(status_code=400, detail="Parameter user_lat dan user_lon wajib diisi.")

    target_lat = dest_lat
    target_lon = dest_lon

    if shelter_id is not None:
        shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
        if not shelter:
            raise HTTPException(status_code=404, detail="Shelter tujuan tidak ditemukan.")
        target_lat = float(shelter.latitude)
        target_lon = float(shelter.longitude)
    elif target_lat is None or target_lon is None:
        shelters = db.query(Shelter).filter(Shelter.is_active == True).all()
        if not shelters:
            raise HTTPException(status_code=404, detail="Tidak ada posko evakuasi aktif yang terdaftar.")
        from ..services.external_api import _calculate_haversine_distance
        nearest = min(shelters, key=lambda s: _calculate_haversine_distance(start_lat, start_lon, float(s.latitude), float(s.longitude)))
        target_lat = float(nearest.latitude)
        target_lon = float(nearest.longitude)

    return await get_evacuation_route(
        origin_lat=start_lat,
        origin_lon=start_lon,
        dest_lat=target_lat,
        dest_lon=target_lon,
    )

