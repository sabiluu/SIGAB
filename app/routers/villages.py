"""Router: Data Desa (Villages)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..models.village import Village
from ..schemas.village import VillageResponse

router = APIRouter(prefix="/villages", tags=["Villages"])

@router.get("", response_model=List[VillageResponse])
def get_all_villages(db: Session = Depends(get_db)):
    """Mengambil daftar semua desa."""
    villages = db.query(Village).all()
    return villages

@router.get("/{village_id}", response_model=VillageResponse)
def get_village_by_id(village_id: int, db: Session = Depends(get_db)):
    """Mengambil detail satu desa berdasarkan ID."""
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    return village

from ..core.deps import get_current_admin_user
from ..schemas.village import VillageCreate, VillageUpdate

@router.post("", response_model=VillageResponse, status_code=201)
def create_village(
    village_in: VillageCreate, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menambahkan data desa baru."""
    new_village = Village(**village_in.model_dump())
    db.add(new_village)
    db.commit()
    db.refresh(new_village)
    return new_village

@router.put("/{village_id}", response_model=VillageResponse)
def update_village(
    village_id: int, 
    village_in: VillageUpdate, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Mengubah data desa."""
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    
    update_data = village_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(village, key, value)
        
    db.commit()
    db.refresh(village)
    return village

@router.delete("/{village_id}", status_code=204)
def delete_village(
    village_id: int, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user)
):
    """(Admin) Menghapus data desa."""
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
        
    db.delete(village)
    db.commit()
    return None
