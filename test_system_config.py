"""
Test suite untuk Router Konfigurasi Sistem (SystemConfig).
Menguji:
1. Autentikasi & RBAC (Admin only).
2. GET /config: Daftar parameter konfigurasi sistem.
3. GET /config/flood-weights: Pengambilan bobot kalkulasi risiko banjir.
4. PUT /config/flood-weights: Validasi total bobot (harus 1.0) & update bobot.
5. Pencatatan Audit Log saat konfigurasi diubah.
6. POST /config/flood-weights/reset: Reset ke bobot default.
7. GET & PUT /config/{key}: Update parameter spesifik.
"""

import sys
from fastapi.testclient import TestClient
from app.main import app

sys.stdout.reconfigure(encoding='utf-8')
from app.core.database import SessionLocal
from app.models.user import User
from app.models.system_config import SystemConfig
from app.models.audit_log import AuditLog
from app.core.security import create_access_token, hash_password
from datetime import timedelta

client = TestClient(app)

def setup_test_users():
    db = SessionLocal()
    # 1. Admin user
    admin = db.query(User).filter(User.email == "admin@bpbd.go.id").first()
    if not admin:
        admin = User(
            full_name="Admin BPBD Test",
            email="admin@bpbd.go.id",
            phone="081234567890",
            password_hash=hash_password("admin123"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # 2. Regular user (warga)
    warga = db.query(User).filter(User.email == "warga_test@gmail.com").first()
    if not warga:
        warga = User(
            full_name="Warga Test",
            email="warga_test@gmail.com",
            phone="081298765432",
            password_hash=hash_password("warga123"),
            role="user",
            is_active=True,
        )
        db.add(warga)
        db.commit()
        db.refresh(warga)

    admin_token = create_access_token({"sub": admin.email, "role": "admin"}, timedelta(hours=1))
    warga_token = create_access_token({"sub": warga.email, "role": "user"}, timedelta(hours=1))
    db.close()
    return admin_token, warga_token


def test_rbac_config():
    admin_token, warga_token = setup_test_users()

    # 1. Tanpa token -> 401
    res_no_auth = client.get("/config")
    assert res_no_auth.status_code == 401, f"Expected 401, got {res_no_auth.status_code}"
    print("✅ Unauthenticated request ke /config berhasil ditolak (401)")

    # 2. Token warga (non-admin) -> 403
    res_warga = client.get("/config", headers={"Authorization": f"Bearer {warga_token}"})
    assert res_warga.status_code == 403, f"Expected 403, got {res_warga.status_code}"
    print("✅ Non-admin (warga) request ke /config berhasil ditolak (403)")

    # 3. Token admin -> 200
    res_admin = client.get("/config", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200, f"Expected 200, got {res_admin.status_code}"
    data = res_admin.json()
    assert isinstance(data, list)
    print(f"✅ Admin berhasil mengambil daftar konfigurasi ({len(data)} items)")


def test_flood_weights_endpoints():
    admin_token, _ = setup_test_users()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. GET /config/flood-weights
    res = client.get("/config/flood-weights", headers=headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    weights = res.json()
    assert "weight_discharge" in weights
    assert "weight_rainfall" in weights
    assert "weight_elevation" in weights
    assert "weight_history" in weights
    print(f"✅ GET /config/flood-weights OK: w1={weights['weight_discharge']}, w2={weights['weight_rainfall']}, w3={weights['weight_elevation']}, w4={weights['weight_history']}, total={weights['total_weight']}")

    # 2. PUT /config/flood-weights dengan total tidak valid (misal sum = 1.30) -> 400
    invalid_payload = {
        "weight_discharge": 0.50,
        "weight_rainfall": 0.40,
        "weight_elevation": 0.20,
        "weight_history": 0.20,
    }
    res_invalid = client.put("/config/flood-weights?recalculate=false", json=invalid_payload, headers=headers)
    assert res_invalid.status_code == 400, f"Expected 400, got {res_invalid.status_code}"
    print(f"✅ Validasi total bobot berhasil: total {invalid_payload['weight_discharge'] + invalid_payload['weight_rainfall'] + invalid_payload['weight_elevation'] + invalid_payload['weight_history']} ditolak (400 Bad Request)")

    # 3. PUT /config/flood-weights dengan total valid (sum = 1.00) -> 200
    valid_payload = {
        "weight_discharge": 0.40,
        "weight_rainfall": 0.30,
        "weight_elevation": 0.15,
        "weight_history": 0.15,
        "critical_discharge_threshold": 1600.0,
        "emergency_probability_threshold": 80.0,
    }
    res_valid = client.put("/config/flood-weights?recalculate=false", json=valid_payload, headers=headers)
    assert res_valid.status_code == 200, f"Expected 200, got {res_valid.status_code}"
    updated = res_valid.json()
    assert updated["weight_discharge"] == 0.40
    assert updated["weight_rainfall"] == 0.30
    assert updated["weight_elevation"] == 0.15
    assert updated["weight_history"] == 0.15
    assert updated["critical_discharge_threshold"] == 1600.0
    assert updated["emergency_probability_threshold"] == 80.0
    assert updated["is_valid_total"] is True
    print(f"✅ Update bobot baru berhasil: w1=0.40, w2=0.30, w3=0.15, w4=0.15 (total=1.00)")

    # 4. Verifikasi pencatatan audit log
    db = SessionLocal()
    audit = db.query(AuditLog).filter(AuditLog.action_type == "update_system_config").order_by(AuditLog.created_at.desc()).first()
    assert audit is not None
    assert audit.target_type == "system_config"
    print(f"✅ Jejak audit tercatat: admin={audit.admin_name}, action={audit.action_type}, notes={audit.notes}")
    db.close()

    # 5. POST /config/flood-weights/reset -> kembali ke default
    res_reset = client.post("/config/flood-weights/reset?recalculate=false", headers=headers)
    assert res_reset.status_code == 200, f"Expected 200, got {res_reset.status_code}"
    reset_data = res_reset.json()
    assert reset_data["weight_discharge"] == 0.35
    assert reset_data["weight_rainfall"] == 0.30
    assert reset_data["weight_elevation"] == 0.20
    assert reset_data["weight_history"] == 0.15
    assert reset_data["critical_discharge_threshold"] == 1500.0
    print("✅ Reset bobot ke default PRD (0.35, 0.30, 0.20, 0.15) berhasil")


def test_single_config_endpoints():
    admin_token, _ = setup_test_users()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. GET /config/{key}
    res = client.get("/config/critical_discharge_threshold", headers=headers)
    assert res.status_code == 200
    item = res.json()
    assert item["config_key"] == "critical_discharge_threshold"
    print(f"✅ GET /config/{item['config_key']} OK: value={item['config_value']}")

    # 2. PUT /config/{key}
    res_update = client.put(
        "/config/critical_discharge_threshold",
        json={"config_value": "1550.00", "description": "Uji penyesuaian batas kritis"},
        headers=headers,
    )
    assert res_update.status_code == 200
    updated_item = res_update.json()
    assert updated_item["config_value"] == "1550.00"
    print(f"✅ PUT /config/{updated_item['config_key']} OK: new value={updated_item['config_value']}")

    # Kembalikan ke 1500.00
    client.put(
        "/config/critical_discharge_threshold",
        json={"config_value": "1500.00", "description": "Ambang batas kritis debit limpasan sungai (m3/s)"},
        headers=headers,
    )


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Router System Config & Bobot Banjir ---")
    test_rbac_config()
    test_flood_weights_endpoints()
    test_single_config_endpoints()
    print("\n🎉 SEMUA TEST SYSTEM CONFIG BERHASIL (100% PASS)!")
