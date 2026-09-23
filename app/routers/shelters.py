"""Router: Shelter / Posko Pengungsian & Rute Evakuasi."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..models.shelter import Shelter
from ..schemas.shelter import ShelterResponse, ShelterUpdate
from ..schemas.external import RouteResponse
from ..services.external_api import get_evacuation_route

router = APIRouter(prefix="/shelters", tags=["Shelters"])


@router.get("", response_model=List[ShelterResponse])
def get_all_shelters(db: Session = Depends(get_db)):
    """Mengambil daftar semua shelter."""
    shelters = db.query(Shelter).all()
    return shelters


@router.get("/{shelter_id}", response_model=ShelterResponse)
def get_shelter_by_id(shelter_id: int, db: Session = Depends(get_db)):
    """Mengambil detail shelter berdasarkan ID."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return shelter


from ..core.deps import get_current_admin_user

@router.put("/{shelter_id}/capacity", response_model=ShelterResponse)
def update_shelter_capacity(
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
    return shelter

from ..schemas.shelter import ShelterCreate, ShelterFullUpdate

@router.post("", response_model=ShelterResponse, status_code=201)
def create_shelter(
    shelter_in: ShelterCreate, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menambahkan data shelter baru."""
    new_shelter = Shelter(**shelter_in.model_dump())
    db.add(new_shelter)
    db.commit()
    db.refresh(new_shelter)
    return new_shelter

@router.put("/{shelter_id}", response_model=ShelterResponse)
def update_shelter_info(
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
    return shelter

@router.delete("/{shelter_id}", status_code=204)
def delete_shelter(
    shelter_id: int, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menghapus data shelter."""
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")
        
    db.delete(shelter)
    db.commit()
    return None


@router.get("/{shelter_id}/route", response_model=RouteResponse)
async def get_route_to_shelter(
    shelter_id: int,
    user_lat: float = Query(..., description="Latitude lokasi asal warga"),
    user_lon: float = Query(..., description="Longitude lokasi asal warga"),
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
