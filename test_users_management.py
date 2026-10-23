"""
Test suite untuk Router Manajemen User & Kependudukan Terdampak (/users).
Menguji:
1. RBAC & Autentikasi (Khusus Admin BPBD).
2. GET /users/stats: Agregasi kependudukan & kelompok rentan (lansia, balita, bumil, disabilitas).
3. GET /users: Pagination, filter desa, filter kelompok rentan, dan pencarian teks.
4. GET /users/{id}: Detail profil kependudukan warga & riwayat SOS.
5. PATCH /users/{id}/status: Aktivasi/deaktivasi akun & pencegahan admin menonaktifkan diri sendiri.
6. PUT /users/{id}: Pemutakhiran data kependudukan oleh admin.
7. Verifikasi jejak audit log pada tabel audit_logs.
8. GET /users/export: Ekspor CSV data kependudukan.
"""

import sys
from fastapi.testclient import TestClient
from app.main import app

sys.stdout.reconfigure(encoding='utf-8')
from app.core.database import SessionLocal
from app.models.user import User
from app.models.village import Village
from app.models.audit_log import AuditLog
from app.core.security import create_access_token, hash_password
from datetime import timedelta

client = TestClient(app)

def setup_users_data():
    db = SessionLocal()
    
    # 1. Pastikan Desa Baureno ada
    baureno = db.query(Village).filter(Village.name == "Desa Baureno").first()
    if not baureno:
        baureno = Village(name="Desa Baureno", latitude=-7.128, longitude=112.103, current_risk_level="tinggi")
        db.add(baureno)
        db.commit()
        db.refresh(baureno)

    # 2. Admin User
    admin = db.query(User).filter(User.email == "admin@bpbd.go.id").first()
    if not admin:
        admin = User(
            full_name="Admin BPBD Pusdalops",
            email="admin@bpbd.go.id",
            phone="081234567890",
            password_hash=hash_password("admin123"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # 3. Warga Rentan 1 (punya lansia & balita)
    warga1 = db.query(User).filter(User.email == "warga_rentan@example.com").first()
    if not warga1:
        warga1 = User(
            full_name="Budi Santoso",
            email="warga_rentan@example.com",
            phone="081299991111",
            password_hash=hash_password("password123"),
            role="user",
            village_id=baureno.id,
            is_active=True,
            nik="3522101010850001",
            address="RT 02 RW 01 Dusun Krajan",
            family_count=5,
            elderly_count=2,
            toddler_count=1,
            pregnant_count=0,
            disabled_count=0,
            notes="Rumah dekat tanggul sungai",
        )
        db.add(warga1)
        db.commit()
        db.refresh(warga1)

    # 4. Warga Reguler (tidak rentan)
    warga2 = db.query(User).filter(User.email == "warga_reguler@example.com").first()
    if not warga2:
        warga2 = User(
            full_name="Siti Rahayu",
            email="warga_reguler@example.com",
            phone="081299992222",
            password_hash=hash_password("password123"),
            role="user",
            village_id=baureno.id,
            is_active=True,
            nik="3522102020900002",
            address="RT 04 RW 02",
            family_count=2,
            elderly_count=0,
            toddler_count=0,
            pregnant_count=0,
            disabled_count=0,
        )
        db.add(warga2)
        db.commit()
        db.refresh(warga2)

    admin_token = create_access_token({"sub": admin.email, "role": "admin"}, timedelta(hours=1))
    warga_token = create_access_token({"sub": warga1.email, "role": "user"}, timedelta(hours=1))
    
    admin_id = admin.id
    warga1_id = warga1.id
    village_id = baureno.id

    db.close()
    return admin_token, warga_token, admin_id, warga1_id, village_id


def test_rbac_user_management():
    admin_token, warga_token, _, _, _ = setup_users_data()

    # 1. Unauthenticated -> 401
    res_no_auth = client.get("/users")
    assert res_no_auth.status_code == 401

    # 2. Non-admin (warga) -> 403
    res_warga = client.get("/users", headers={"Authorization": f"Bearer {warga_token}"})
    assert res_warga.status_code == 403

    # 3. Admin -> 200
    res_admin = client.get("/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    print("✅ RBAC User Management OK: 401 unauth, 403 non-admin, 200 admin")


def test_demographics_stats():
    admin_token, _, _, _, _ = setup_users_data()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/users/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_registered_users" in data
    assert "total_citizens" in data
    assert "total_family_members" in data
    assert "total_vulnerable" in data
    assert "villages_breakdown" in data
    assert isinstance(data["villages_breakdown"], list)
    print(f"✅ GET /users/stats OK: Citizens={data['total_citizens']}, Jiwa KK={data['total_family_members']}, Lansia={data['total_elderly']}, Balita={data['total_toddlers']}, Desa={len(data['villages_breakdown'])}")


def test_users_list_and_filters():
    admin_token, _, _, warga1_id, village_id = setup_users_data()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Filter desa
    res_v = client.get(f"/users?village_id={village_id}", headers=headers)
    assert res_v.status_code == 200
    data_v = res_v.json()
    assert data_v["total"] >= 2
    print(f"✅ Filter village_id={village_id} OK: {data_v['total']} warga ditemukan")

    # 2. Filter kelompok rentan (has_vulnerable=true)
    res_vuln = client.get("/users?has_vulnerable=true", headers=headers)
    assert res_vuln.status_code == 200
    data_vuln = res_vuln.json()
    assert data_vuln["total"] >= 1
    for item in data_vuln["items"]:
        assert item["has_vulnerable"] is True
    print(f"✅ Filter has_vulnerable=true OK: {data_vuln['total']} keluarga rentan teridentifikasi")

    # 3. Pencarian teks (Search NIK / Nama)
    res_search = client.get("/users?search=Santoso", headers=headers)
    assert res_search.status_code == 200
    data_s = res_search.json()
    assert any("Santoso" in item["full_name"] for item in data_s["items"])
    print("✅ Search pencarian nama 'Santoso' OK")


def test_user_detail_and_crud():
    admin_token, _, admin_id, warga1_id, _ = setup_users_data()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. GET /users/{id}
    res_get = client.get(f"/users/{warga1_id}", headers=headers)
    assert res_get.status_code == 200
    user_detail = res_get.json()
    assert user_detail["id"] == warga1_id
    assert "family_count" in user_detail
    assert "sos_count" in user_detail
    print(f"✅ GET /users/{warga1_id} OK: {user_detail['full_name']} (NIK: {user_detail['nik']})")

    # 2. PATCH /users/{id}/status (Nonaktifkan akun)
    res_patch = client.patch(
        f"/users/{warga1_id}/status",
        json={"is_active": False, "reason": "Simulasi audit kepatuhan akun"},
        headers=headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["is_active"] is False

    # Kembalikan status aktif
    client.patch(
        f"/users/{warga1_id}/status",
        json={"is_active": True, "reason": "Verifikasi selesai"},
        headers=headers,
    )
    print(f"✅ PATCH /users/{warga1_id}/status OK: Toggle status akun berhasil")

    # 3. Admin dilarang menonaktifkan dirinya sendiri
    res_self = client.patch(
        f"/users/{admin_id}/status",
        json={"is_active": False},
        headers=headers,
    )
    assert res_self.status_code == 400
    print("✅ Proteksi admin menonaktifkan akun sendiri berhasil (400 Bad Request)")

    # 4. PUT /users/{id} (Update data kependudukan)
    update_payload = {
        "family_count": 6,
        "elderly_count": 2,
        "toddler_count": 2,
        "notes": "Data diverifikasi oleh petugas posko",
    }
    res_put = client.put(f"/users/{warga1_id}", json=update_payload, headers=headers)
    assert res_put.status_code == 200
    updated_user = res_put.json()
    assert updated_user["family_count"] == 6
    assert updated_user["toddler_count"] == 2
    print(f"✅ PUT /users/{warga1_id} OK: family_count={updated_user['family_count']}, balita={updated_user['toddler_count']}")

    # 5. Verifikasi Audit Log tercatat
    db = SessionLocal()
    audit_user = db.query(AuditLog).filter(
        AuditLog.action_type.in_(["toggle_user_status", "update_user"])
    ).order_by(AuditLog.created_at.desc()).first()
    assert audit_user is not None
    assert audit_user.target_type == "user"
    print(f"✅ Audit Log tercatat: action={audit_user.action_type}, notes={audit_user.notes}")
    db.close()


def test_export_csv():
    admin_token, _, _, _, _ = setup_users_data()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res_csv = client.get("/users/export", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Nama Lengkap" in res_csv.text
    assert "NIK" in res_csv.text
    assert "Lansia" in res_csv.text
    print("✅ GET /users/export OK: Header dan konten CSV kependudukan tervalidasi")


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Router Manajemen User & Kependudukan (/users) ---")
    test_rbac_user_management()
    test_demographics_stats()
    test_users_list_and_filters()
    test_user_detail_and_crud()
    test_export_csv()
    print("\n🎉 SEMUA TEST USER MANAGEMENT BERHASIL (100% PASS)!")
