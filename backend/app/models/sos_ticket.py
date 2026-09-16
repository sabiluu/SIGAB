"""
Model SOSTicket — tabel 'sos_tickets'.
Tiket laporan darurat dari warga.
"""

from sqlalchemy import Column, Integer, String, Float, Text, Enum, DateTime, func
from ..core.database import Base


class SOSTicket(Base):
    __tablename__ = "sos_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    pesan = Column(Text, nullable=True)
    jumlah_orang = Column(Integer, default=1)
    status = Column(
        Enum("menunggu", "diproses", "selesai", name="sos_status"),
        default="menunggu",
        nullable=False,
    )
    shelter_tujuan_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
