"""
Manajemen Zona Waktu Aplikasi SiagaBencana (SIGAB).
Menetapkan acuan waktu resmi ke Waktu Indonesia Barat (WIB / UTC+7)
untuk wilayah operasional Kecamatan Baureno, Kabupaten Bojonegoro.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

# Definisi zona waktu resmi: WIB (UTC+7 / Asia/Jakarta)
WIB_OFFSET = timedelta(hours=7)
WIB_TZ = timezone(WIB_OFFSET, name="WIB")


def get_wib_now() -> datetime:
    """
    Mengembalikan waktu saat ini dalam zona waktu WIB (UTC+7)
    sebagai naive datetime (tanpa tzinfo) untuk kompatibilitas penuh dengan
    kolom DATETIME/TIMESTAMP pada SQLite dan MySQL.
    """
    return datetime.now(WIB_TZ).replace(tzinfo=None)


def get_wib_now_aware() -> datetime:
    """
    Mengembalikan waktu saat ini dalam zona waktu WIB (UTC+7) dengan tzinfo aktif.
    """
    return datetime.now(WIB_TZ)


def format_wib_datetime(dt: Optional[datetime], with_seconds: bool = False) -> str:
    """
    Memformat objek datetime ke string manusiawi bahasa Indonesia:
    Contoh: '22 Okt 2026 • 09:35 WIB'
    """
    if not dt:
        return "-"
    months = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    month_name = months[dt.month] if 1 <= dt.month <= 12 else str(dt.month)
    time_fmt = "%H:%M:%S" if with_seconds else "%H:%M"
    return f"{dt.day:02d} {month_name} {dt.year} • {dt.strftime(time_fmt)} WIB"
