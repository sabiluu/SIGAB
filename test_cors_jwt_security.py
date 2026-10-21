"""
Test suite untuk Pengetatan Aturan CORS Domain Produksi & Pengamanan Secret Key JWT.
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.config import Settings, INSECURE_SECRET_KEYS, settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_secure_secret_key,
    check_secret_key_strength,
)

client = TestClient(app)

admin_token = create_access_token({"sub": "admin@bpbd.go.id", "role": "admin"})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

user_token = create_access_token({"sub": "warga@gmail.com", "role": "user"})
user_headers = {"Authorization": f"Bearer {user_token}"}


def test_cors_allowed_origins():
    """Menguji bahwa origin terdaftar mendapatkan header Access-Control-Allow-Origin."""
    allowed_test_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://siagabencana.bojonegorokab.go.id",
        "https://sigab.bpbd.bojonegorokab.go.id",
    ]

    for origin in allowed_test_origins:
        # Kirim OPTIONS preflight request
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        }
        res = client.options("/auth/login", headers=headers)
        assert res.status_code == 200, f"Preflight failed for {origin}"
        assert res.headers.get("access-control-allow-origin") == origin
        assert res.headers.get("access-control-allow-credentials") == "true"
        assert res.headers.get("access-control-max-age") == "600"

        # Kirim actual request untuk memverifikasi exposed headers
        res_actual = client.get("/auth/me", headers={"Origin": origin})
        assert res_actual.headers.get("access-control-allow-origin") == origin
        assert "Content-Disposition" in res_actual.headers.get("access-control-expose-headers", "")
        print(f"✅ Origin terdaftar '{origin}' diizinkan dengan kredensial & exposed headers aman")


def test_cors_rejected_unauthorized_origin():
    """Menguji bahwa domain penyerang/tidak terdaftar DITOLAK oleh CORS middleware."""
    unauthorized_origins = [
        "https://evil-attacker.com",
        "http://malicious-site.org",
        "http://localhost:9999",
    ]

    for evil_origin in unauthorized_origins:
        headers = {
            "Origin": evil_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        }
        res = client.options("/auth/login", headers=headers)
        # Jika origin tidak diizinkan, CORS middleware tidak mengirimkan Access-Control-Allow-Origin
        allow_origin = res.headers.get("access-control-allow-origin")
        assert allow_origin is None or allow_origin != evil_origin, (
            f"BAHAYA: Domain penyerang '{evil_origin}' tidak boleh diizinkan!"
        )
        print(f"✅ Domain tidak terdaftar '{evil_origin}' berhasil DITOLAK")


def test_jwt_secret_key_strength():
    """Menguji pemeriksaan kekuatan SECRET_KEY saat ini."""
    strength = check_secret_key_strength()
    assert strength["is_secure"] is True
    assert strength["rating"] == "strong"
    assert strength["length_chars"] >= 32
    assert strength["estimated_entropy_bits"] >= 256
    print(f"✅ SECRET_KEY saat ini: rating={strength['rating']}, length={strength['length_chars']} chars, entropy={strength['estimated_entropy_bits']} bits")


def test_generate_secure_secret_key():
    """Menguji fungsi generator cryptographic random key 256-bit."""
    new_key = generate_secure_secret_key(32)
    assert len(new_key) == 64  # 32 bytes hex = 64 characters
    assert new_key not in INSECURE_SECRET_KEYS

    # Pastikan setiap key yang digenerate unik
    another_key = generate_secure_secret_key(32)
    assert new_key != another_key
    print(f"✅ Generator Secret Key 256-bit OK: sample '{new_key[:16]}...' (64 chars)")


def test_production_environment_security_enforcement():
    """Menguji bahwa server menolak start di production jika menggunakan secret key lemah."""
    test_settings = Settings()
    test_settings.ENVIRONMENT = "production"

    # 1. Coba dengan secret key default/lemah di production -> Harus raise RuntimeError
    for weak_key in ["dev-secret-key", "secret_key_123", "short"]:
        test_settings.SECRET_KEY = weak_key
        try:
            test_settings.validate_security()
            assert False, f"Harus gagal jika secret key '{weak_key}' digunakan di production!"
        except RuntimeError as e:
            assert "CRITICAL SECURITY ERROR" in str(e)
            print(f"✅ Terverifikasi: Kunci lemah '{weak_key}' ditolak di production")

    # 2. Coba dengan key 256-bit kuat di production -> Harus lulus
    test_settings.SECRET_KEY = "a" * 64
    test_settings.CORS_ALLOWED_ORIGINS_RAW = "https://siagabencana.bojonegorokab.go.id"
    test_settings.validate_security()
    print("✅ Terverifikasi: Kunci 256-bit aman diterima di production")


def test_jwt_tampering_and_expiration():
    """Menguji bahwa token yang diubah (tampered) atau kedaluwarsa ditolak."""
    # 1. Token valid
    token = create_access_token({"sub": "user@example.com", "role": "user"})
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user@example.com"
    assert "jti" in decoded
    assert "iat" in decoded
    assert "exp" in decoded
    print("✅ Token valid berhasil didecode dengan klaim exp, iat, jti")

    # 2. Token diubah (tampered signature)
    tampered_token = token[:-5] + "XXXXX"
    assert decode_access_token(tampered_token) is None
    print("✅ Tampered token berhasil ditolak (signature mismatch)")

    # 3. Token kedaluwarsa
    expired_token = create_access_token(
        {"sub": "user@example.com", "role": "user"},
        expires_delta=timedelta(seconds=-10),  # expired 10 detik lalu
    )
    assert decode_access_token(expired_token) is None
    print("✅ Expired token berhasil ditolak (expired exp)")


def test_security_check_endpoint():
    """Menguji endpoint /auth/security-check (Admin Only)."""
    # 1. Unauthenticated -> 401
    res_unauth = client.get("/auth/security-check")
    assert res_unauth.status_code == 401
    print("✅ Unauthenticated access to /auth/security-check rejected (401)")

    # 2. Non-admin -> 403
    res_user = client.get("/auth/security-check", headers=user_headers)
    assert res_user.status_code == 403
    print("✅ Non-admin access to /auth/security-check rejected (403)")

    # 3. Admin -> 200
    res_admin = client.get("/auth/security-check", headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["status"] == "ok"
    assert "jwt_security" in data
    assert data["jwt_security"]["is_secure"] is True
    assert "cors_policy" in data
    assert "https://siagabencana.bojonegorokab.go.id" in data["cors_policy"]["allowed_origins"]
    print(f"✅ Admin /auth/security-check OK: CORS origins={len(data['cors_policy']['allowed_origins'])}, JWT rating={data['jwt_security']['rating']}")


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Pengetatan CORS & Pengamanan Secret Key JWT ---")
    test_cors_allowed_origins()
    test_cors_rejected_unauthorized_origin()
    test_jwt_secret_key_strength()
    test_generate_secure_secret_key()
    test_production_environment_security_enforcement()
    test_jwt_tampering_and_expiration()
    test_security_check_endpoint()
    print("\n🎉 SEMUA TEST KEAMANAN CORS & JWT BERHASIL (100% PASS)!")
