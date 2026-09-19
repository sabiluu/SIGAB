"""
Utility / helper functions untuk backend.
"""


def get_risk_level(probabilitas: float) -> str:
    """Konversi skor probabilitas (0–100) ke level risiko."""
    if probabilitas >= 75:
        return "Awas"
    elif probabilitas >= 50:
        return "Siaga"
    elif probabilitas >= 25:
        return "Waspada"
    return "Aman"


def get_risk_color(level: str) -> str:
    """Warna indikator berdasarkan level risiko."""
    colors = {
        "Aman": "#22c55e",     # hijau
        "Waspada": "#eab308",  # kuning
        "Siaga": "#f97316",    # oranye
        "Awas": "#ef4444",     # merah
    }
    return colors.get(level, "#6b7280")
