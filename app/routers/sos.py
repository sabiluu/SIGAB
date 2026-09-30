"""Router: SOS / Tiket Darurat — dengan push notifikasi WebSocket."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..core.database import get_db
from ..models.sos_ticket import SOSTicket
from ..models.user import User
from ..models.village import Village
from ..schemas.sos_ticket import SOSTicketResponse, SOSTicketCreate, SOSTicketUpdate

router = APIRouter(prefix="/sos", tags=["SOS"])

from ..core.deps import get_current_admin_user, get_current_active_user
from ..services.notifier import broadcast_sos_event

@router.post("", response_model=SOSTicketResponse)
async def create_sos_ticket(
    ticket: SOSTicketCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Warga membuat tiket SOS baru."""
    # Generate simple ticket number based on timestamp
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
    ticket_number = f"SOS-{timestamp_str}"
    
    # Kalkulasi priority_score
    priority_score = ticket.family_count * 2
    if ticket.has_elderly: priority_score += 5
    if ticket.has_toddler: priority_score += 5
    if ticket.has_pregnant: priority_score += 5
    if ticket.has_disability: priority_score += 10

    new_ticket = SOSTicket(
        ticket_number=ticket_number,
        reporter_id=ticket.reporter_id,
        village_id=ticket.village_id,
        gps_latitude=ticket.gps_latitude,
        gps_longitude=ticket.gps_longitude,
        gps_address=ticket.gps_address,
        family_count=ticket.family_count,
        has_elderly=ticket.has_elderly,
        has_toddler=ticket.has_toddler,
        has_disability=ticket.has_disability,
        has_pregnant=ticket.has_pregnant,
        photo_url=ticket.photo_url,
        status="submitted",
        priority_score=priority_score
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Push notifikasi SOS baru ke admin via WebSocket
    reporter = db.query(User).filter(User.id == ticket.reporter_id).first()
    village = db.query(Village).filter(Village.id == ticket.village_id).first()
    await broadcast_sos_event(
        db=db,
        event_type="sos_new",
        ticket_id=new_ticket.id,
        ticket_number=ticket_number,
        reporter_name=reporter.full_name if reporter else "Warga",
        village_name=village.name if village else "—",
        status="submitted",
        village_id=ticket.village_id,
        extra_data={
            "family_count": ticket.family_count,
            "gps_latitude": str(ticket.gps_latitude),
            "gps_longitude": str(ticket.gps_longitude),
        },
    )
    db.commit()

    return new_ticket

@router.get("", response_model=List[SOSTicketResponse])
def get_all_sos_tickets(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Melihat daftar tiket SOS."""
    tickets = db.query(SOSTicket).order_by(SOSTicket.submitted_at.desc()).all()
    return tickets

@router.get("/my", response_model=List[SOSTicketResponse])
def get_my_sos_tickets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """(Warga) Melihat daftar tiket SOS miliknya sendiri."""
    tickets = db.query(SOSTicket).filter(SOSTicket.reporter_id == current_user.id).order_by(SOSTicket.submitted_at.desc()).all()
    return tickets

@router.get("/{ticket_id}", response_model=SOSTicketResponse)
def get_sos_ticket_by_id(
    ticket_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Melihat detail satu tiket SOS."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.delete("/{ticket_id}", status_code=204)
def delete_sos_ticket(
    ticket_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """(Admin) Menghapus tiket SOS (hanya jika diperlukan)."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    db.delete(ticket)
    db.commit()
    return None

@router.put("/{ticket_id}", response_model=SOSTicketResponse)
async def update_sos_ticket(
    ticket_id: int, 
    ticket_update: SOSTicketUpdate, 
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin_user)
):
    """Admin update status tiket SOS — dengan push notifikasi."""
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    old_status = ticket.status
    ticket.status = ticket_update.status

    # Update timestamp berdasarkan status baru
    now = datetime.now()
    status_timestamps = {
        "verified": "verified_at",
        "dispatched": "dispatched_at",
        "arrived": "arrived_at",
        "completed": "completed_at",
    }
    ts_field = status_timestamps.get(ticket_update.status)
    if ts_field and hasattr(ticket, ts_field):
        setattr(ticket, ts_field, now)

    if ticket_update.priority_score is not None:
        ticket.priority_score = ticket_update.priority_score
    if ticket_update.assigned_admin_id is not None:
        ticket.assigned_admin_id = ticket_update.assigned_admin_id
    if ticket_update.assigned_unit is not None:
        ticket.assigned_unit = ticket_update.assigned_unit
    if ticket_update.rejection_reason is not None:
        ticket.rejection_reason = ticket_update.rejection_reason
    if ticket_update.shelter_destination_id is not None:
        ticket.shelter_destination_id = ticket_update.shelter_destination_id

    db.commit()
    db.refresh(ticket)

    # Push notifikasi update SOS via WebSocket
    reporter = db.query(User).filter(User.id == ticket.reporter_id).first()
    village = db.query(Village).filter(Village.id == ticket.village_id).first()

    event_map = {
        "verified": "sos_verified",
        "dispatched": "sos_dispatched",
        "arrived": "sos_arrived",
        "completed": "sos_completed",
        "rejected": "sos_rejected",
    }
    event_type = event_map.get(ticket_update.status, "sos_updated")

    await broadcast_sos_event(
        db=db,
        event_type=event_type,
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        reporter_name=reporter.full_name if reporter else "Warga",
        village_name=village.name if village else "—",
        status=ticket_update.status,
        village_id=ticket.village_id,
    )
    db.commit()

    return ticket
