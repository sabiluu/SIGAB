"""
Konfigurasi aplikasi & pengetatan keamanan (CORS & JWT Secret Key).
Memuat environment variables menggunakan python-dotenv dengan validasi keamanan ketat.
"""

import os
import sys
import logging
from typing import List
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("sigab.security")

# Daftar secret key default/lemah yang dilarang digunakan di production
INSECURE_SECRET_KEYS = {
    "dev-secret-key",
    "secret_key_123",
    "secret",
    "your-secret-key-here",
    "secret123",
    "admin",
    "12345678",
    "changeme",
    "default",
    "password",
    "supersecret",
}

# Domain default untuk mode development
DEFAULT_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Domain resmi BPBD Kabupaten Bojonegoro untuk lingkungan produksi
DEFAULT_PROD_ORIGINS = [
    "https://siagabencana.bojonegorokab.go.id",
    "https://sigab.bpbd.bojonegorokab.go.id",
    "https://siagabencana.baureno.id",
]


class Settings:
    # Lingkungan aplikasi ('development', 'staging', 'production')
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).strip().lower()

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@localhost:3306/siagabencana"
    )

    # JWT Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key").strip()
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256").strip()
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    # CORS Configuration
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
    CORS_ALLOWED_ORIGINS_RAW: str = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()

    # CORS Policy Settings (Restricted Methods & Headers)
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = [
        "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"
    ]
    CORS_ALLOW_HEADERS: List[str] = [
        "Content-Type",
        "Authorization",
        "Accept",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ]
    CORS_EXPOSE_HEADERS: List[str] = [
        "Content-Disposition",
        "Content-Length",
        "X-Request-ID",
    ]
    CORS_MAX_AGE: int = 600  # 10 menit preflight cache

    # External APIs
    OPEN_METEO_BASE_URL: str = os.getenv(
        "OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1"
    )
    OPEN_METEO_FLOOD_BASE_URL: str = os.getenv(
        "OPEN_METEO_FLOOD_BASE_URL", "https://flood-api.open-meteo.com/v1"
    )
    OSRM_BASE_URL: str = os.getenv(
        "OSRM_BASE_URL", "http://router.project-osrm.org"
    )
    EXTERNAL_API_TIMEOUT_SECONDS: float = float(
        os.getenv("EXTERNAL_API_TIMEOUT_SECONDS", "8.0")
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT in ("production", "prod")

    def get_cors_origins(self) -> List[str]:
        """
        Mengembalikan daftar domain origin CORS yang diizinkan berdasarkan environment.
        Di lingkungan produksi: melarang tanda '*' (wildcard) saat credentials aktif,
        dan hanya mengizinkan domain resmi yang terdaftar.
        """
        origins: List[str] = []

        # 1. Parsing dari environment variable CORS_ALLOWED_ORIGINS (comma-separated)
        if self.CORS_ALLOWED_ORIGINS_RAW:
            parsed = [o.strip().rstrip("/") for o in self.CORS_ALLOWED_ORIGINS_RAW.split(",") if o.strip()]
            for item in parsed:
                if item == "*" and self.is_production:
                    logger.warning("[CORS] Wildcard '*' dilarang di produksi dengan credentials aktif. Wildcard diabaikan.")
                    continue
                if item and item not in origins:
                    origins.append(item)

        # 2. Jika di produksi dan belum ada origin yang ditentukan, gunakan domain resmi BPBD + FRONTEND_URL
        if self.is_production:
            if not origins:
                origins = list(DEFAULT_PROD_ORIGINS)
            if self.FRONTEND_URL and self.FRONTEND_URL.rstrip("/") not in origins and self.FRONTEND_URL != "*":
                origins.append(self.FRONTEND_URL.rstrip("/"))
        else:
            # Di development: gabungkan dengan dev origins lokal, domain resmi BPBD, dan FRONTEND_URL
            for o in DEFAULT_DEV_ORIGINS + DEFAULT_PROD_ORIGINS:
                if o not in origins:
                    origins.append(o)
            if self.FRONTEND_URL and self.FRONTEND_URL.rstrip("/") not in origins:
                origins.append(self.FRONTEND_URL.rstrip("/"))

        return origins

    def validate_security(self) -> None:
        """
        Validasi pengetatan keamanan SECRET_KEY dan aturan CORS.
        Mencegah aplikasi berjalan di production dengan secret key bawaan atau rentan.
        """
        is_weak = (
            self.SECRET_KEY in INSECURE_SECRET_KEYS
            or len(self.SECRET_KEY) < 32
        )

        if self.is_production:
            if is_weak:
                raise RuntimeError(
                    "CRITICAL SECURITY ERROR: Aplikasi berjalan di lingkungan PRODUCTION dengan SECRET_KEY yang lemah atau default! "
                    "SECRET_KEY minimal harus 32 karakter (256-bit). Silakan generate menggunakan secrets.token_hex(32) di file .env."
                )
            origins = self.get_cors_origins()
            if not origins or "*" in origins:
                raise RuntimeError(
                    "CRITICAL SECURITY ERROR: Aturan CORS di lingkungan PRODUCTION tidak boleh kosong atau menggunakan wildcard '*'!"
                )
        else:
            if is_weak:
                print(
                    "[PERINGATAN KEAMANAN] SECRET_KEY JWT saat ini masih menggunakan kunci pengembangan/lemah. "
                    "Pastikan untuk mengatur SECRET_KEY aman (minimal 32 karakter) sebelum deployment ke produksi.",
                    file=sys.stderr,
                )


settings = Settings()
settings.validate_security()
