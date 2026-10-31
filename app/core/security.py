"""
Modul keamanan: JWT token & password hashing dengan standar keamanan tinggi.
"""

import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import bcrypt
from .config import settings, INSECURE_SECRET_KEYS


def generate_secure_secret_key(length_bytes: int = 32) -> str:
    """
    Menghasilkan cryptographic random key (256-bit atau lebih)
    yang aman digunakan sebagai SECRET_KEY JWT di lingkungan produksi.
    """
    return secrets.token_hex(length_bytes)


def check_secret_key_strength() -> Dict[str, Any]:
    """
    Memeriksa kekuatan SECRET_KEY saat ini tanpa membocorkan nilai kunci.
    """
    key = settings.SECRET_KEY
    is_insecure = key in INSECURE_SECRET_KEYS
    length = len(key)
    bits = length * 4 if all(c in "0123456789abcdefABCDEF" for c in key) else length * 8

    if is_insecure or length < 32:
        rating = "weak"
    elif length < 64:
        rating = "medium"
    else:
        rating = "strong"

    return {
        "is_secure": rating in ("medium", "strong") and not is_insecure,
        "rating": rating,
        "length_chars": length,
        "estimated_entropy_bits": bits,
        "algorithm": settings.ALGORITHM,
        "environment": settings.ENVIRONMENT,
    }


def hash_password(password: str) -> str:
    """Hash password menggunakan bcrypt."""
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifikasi password terhadap hash bcrypt."""
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Membuat JWT access token berstandar RFC 7519 dengan:
    - exp: Waktu kedaluwarsa token
    - iat: Waktu penerbitan token
    - jti: Unique token ID untuk mencegah replay attacks
    """
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({
        "exp": expire,
        "iat": now_utc,
        "jti": uuid.uuid4().hex,
    })

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode & verifikasi JWT token dengan penegakan algoritma ketat (anti-confusion).
    Return None jika token tidak valid atau kedaluwarsa.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_signature": True, "verify_exp": True, "verify_iat": True},
        )
        return payload
    except JWTError:
        return None
