"""
Test Suite: Verifikasi Penyelarasan Backend dengan Spesifikasi Dokumen PRD / Paper
1. Formula Prioritas SOS P_SOS = 10*N_jiwa + 25*lansia + 25*balita + 30*disabilitas + 20*hamil (Persamaan 5)
2. Spesifikasi Endpoint Tabel III (POST /api/auth/login, GET /api/villages, GET /api/shelters, GET /api/evac/route, POST /api/sos, PATCH /api/sos/{id}, POST /api/emergency, PUT /api/configs)
3. 4 Kanal WebSocket (alerts, sos, dashboard, general)
"""

import sys
import json
from fastapi.testclient import TestClient

sys.stdout.reconfigure(encoding='utf-8')

from app.main import app
from app.core.database import SessionLocal
from app.core.rate_limiter import login_rate_limiter

client = TestClient(app)

def test_prd_alignment():
    print("=================================================================")
    print("   UJI PENYELARASAN BACKEND DENGAN PRD (SIAGABENCANA 2026)       ")
    print("=================================================================")
    login_rate_limiter.reset()

    # 1. Login Admin & Warga via /api/auth/login (Tabel III)
    r_admin = client.post("/api/auth/login", json={"email": "admin_audit@sigab.com", "password": "admin123"})
    assert r_admin.status_code == 200, f"Failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✅ POST /api/auth/login: Sukses autentikasi admin & terbit JWT token")

    r_warga = client.post("/api/auth/login", json={"email": "warga1@test.com", "password": "warga123"})
    assert r_warga.status_code == 200, f"Failed: {r_warga.text}"
    warga_token = r_warga.json()["access_token"]
    warga_headers = {"Authorization": f"Bearer {warga_token}"}
    print("✅ POST /api/auth/login: Sukses autentikasi warga & terbit JWT token")

    # 2. GET /api/villages (Tabel III)
    r_v = client.get("/api/villages")
    assert r_v.status_code == 200
    villages = r_v.json()
    assert len(villages) == 25
    print(f"✅ GET /api/villages: Berhasil mengambil data spasial & risiko {len(villages)} desa")

    # 3. GET /api/shelters (Tabel III)
    r_s = client.get("/api/shelters")
    assert r_s.status_code == 200
    shelters = r_s.json()
    assert len(shelters) >= 1
    print(f"✅ GET /api/shelters: Berhasil mengambil daftar {len(shelters)} posko & kuota")

    # 4. GET /api/evac/route (Tabel III)
    r_evac = client.get("/api/evac/route?user_lat=-7.1282&user_lon=112.1038")
    assert r_evac.status_code == 200
    route = r_evac.json()
    assert "distance_km" in route and "coordinates" in route
    print(f"✅ GET /api/evac/route: Sukses kalkulasi rute navigasi menuju posko (jarak: {route['distance_km']} km)")

    # 5. POST /api/sos & Formula P_SOS Persamaan (5)
    # P_SOS = 10*N_jiwa + 25*lansia + 25*balita + 30*disabilitas + 20*hamil
    sos_payload = {
        "village_id": 1,
        "gps_latitude": -7.1282,
        "gps_longitude": 112.1038,
        "gps_address": "Dusun Baureno RT 02",
        "family_count": 3,
        "has_elderly": True,
        "has_toddler": False,
        "has_disability": True,
        "has_pregnant": False,
    }
    r_sos = client.post("/api/sos", json=sos_payload, headers=warga_headers)
    assert r_sos.status_code == 200, f"Failed: {r_sos.text}"
    ticket = r_sos.json()
    # Expected: 10 * 3 + 25 (lansia) + 30 (disabilitas) = 85
    expected_score = 10 * 3 + 25 + 30
    assert ticket["priority_score"] == expected_score, f"Expected {expected_score}, got {ticket['priority_score']}"
    print(f"✅ POST /api/sos: Berhasil mengirim laporan SOS dengan Priority Score = {ticket['priority_score']} (10*3 + 25 + 30 = 85) sesuai Persamaan (5) PRD")

    # 6. PATCH /api/sos/{id} (Tabel III)
    ticket_id = ticket["id"]
    r_patch = client.patch(f"/api/sos/{ticket_id}", json={"status": "verified"}, headers=admin_headers)
    assert r_patch.status_code == 200
    assert r_patch.json()["status"] == "verified"
    print(f"✅ PATCH /api/sos/{ticket_id}: Berhasil update status tiket menjadi 'verified'")

    # 7. POST /api/emergency (Tabel III)
    r_em = client.post("/api/emergency", json={"village_id": 1, "is_emergency_active": True, "notes": "Aktivasi manual simulasi"}, headers=admin_headers)
    assert r_em.status_code == 200
    assert r_em.json()["is_emergency_active"] is True
    print("✅ POST /api/emergency: Berhasil mengaktifkan mode darurat desa")

    # 8. PUT /api/configs (Tabel III)
    cfg_payload = {
        "weight_discharge": 0.35,
        "weight_rainfall": 0.30,
        "weight_elevation": 0.20,
        "weight_history": 0.15,
        "critical_discharge_threshold": 1500.0,
        "emergency_probability_threshold": 76.0,
    }
    r_cfg = client.put("/api/configs", json=cfg_payload, headers=admin_headers)
    assert r_cfg.status_code == 200
    assert r_cfg.json()["weight_discharge"] == 0.35
    print("✅ PUT /api/configs: Berhasil update bobot formula & ambang batas debit kritis")

    # 9. 4 Kanal WebSocket (G.2)
    channels = ["alerts", "sos", "dashboard", "general"]
    for ch in channels:
        with client.websocket_connect(f"/ws/{ch}") as ws:
            msg = json.loads(ws.receive_text())
            assert msg.get("type") in ["connected", "welcome"] or "stats" in msg or "villages" in msg
            ws.send_text("ping")
            pong = json.loads(ws.receive_text())
            assert pong["type"] == "pong"
    print("✅ 4 Kanal WebSocket (/ws/alerts, /ws/sos, /ws/dashboard, /ws/general) aktif dan merespons pong")

    print("\n🎉 SEMUA SPESIFIKASI BACKEND PRD BERHASIL DIVERIFIKASI 100% PASS!\n")

if __name__ == "__main__":
    test_prd_alignment()
