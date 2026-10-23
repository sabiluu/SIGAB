"""
Test suite untuk Tabel & Pencatatan Audit Log
(merekam aksi disposisi armada & ubah status oleh admin).
"""

import sys
import os
from datetime import datetime
from fastapi.testclient import TestClient

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.sos_ticket import SOSTicket
from app.models.emergency_status import EmergencyStatus
from app.models.village import Village
from app.models.shelter import Shelter
from app.models.audit_log import AuditLog

client = TestClient(app)

admin_token = create_access_token({"sub": "admin@bpbd.go.id", "role": "admin"})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

user_token = create_access_token({"sub": "warga@gmail.com", "role": "user"})
user_headers = {"Authorization": f"Bearer {user_token}"}


def setup_test_data():
    """Menyiapkan tiket SOS dan mode darurat untuk pengujian."""
    db = SessionLocal()
    try:
        village = db.query(Village).first()
        assert village is not None, "Desa harus ada di database"

        # Pastikan ada emergency aktif agar tiket bisa dibuat
        active_em = (
            db.query(EmergencyStatus)
            .filter(
                EmergencyStatus.village_id == village.id,
                EmergencyStatus.is_emergency_active == True,
            )
            .first()
        )
        if not active_em:
            active_em = EmergencyStatus(
                village_id=village.id,
                is_emergency_active=True,
                trigger_type="manual_admin",
                notes="Mode Darurat Test Suite",
            )
            db.add(active_em)
            db.commit()
            db.refresh(active_em)

        # Buat tiket SOS dummy jika belum ada
        ticket = db.query(SOSTicket).filter(SOSTicket.ticket_number == "EVAC-TEST-AUDIT-001").first()
        if not ticket:
            ticket = SOSTicket(
                ticket_number="EVAC-TEST-AUDIT-001",
                reporter_id=2,  # warga@gmail.com
                village_id=village.id,
                gps_latitude=-7.128,
                gps_longitude=112.103,
                gps_address="Jl. Poros Baureno No. 12",
                family_count=4,
                has_elderly=True,
                has_toddler=False,
                has_disability=False,
                has_pregnant=False,
                status="submitted",
                priority_score=13,
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)

        return ticket.id, village.id
    finally:
        db.close()


def test_sos_disposition_and_status_audit_logging():
    """Pengujian pencatatan audit log saat disposisi armada dan ubah status SOS."""
    ticket_id, village_id = setup_test_data()

    # 1. Admin mengubah status ke 'verified'
    res_verify = client.put(
        f"/sos/{ticket_id}",
        headers=admin_headers,
        json={"status": "verified"},
    )
    assert res_verify.status_code == 200
    print("✅ PUT /sos/{id} status=verified berhasil")

    # 2. Admin melakukan disposisi armada: status 'dispatched' + assigned_unit + shelter
    res_dispatch = client.put(
        f"/sos/{ticket_id}",
        headers=admin_headers,
        json={
            "status": "dispatched",
            "assigned_unit": "Perahu Karet TRC Unit 1",
            "shelter_destination_id": 1,
        },
    )
    assert res_dispatch.status_code == 200
    print("✅ PUT /sos/{id} disposisi armada 'Perahu Karet TRC Unit 1' berhasil")

    # 3. Admin mengubah status ke 'arrived'
    res_arrived = client.put(
        f"/sos/{ticket_id}",
        headers=admin_headers,
        json={"status": "arrived"},
    )
    assert res_arrived.status_code == 200
    print("✅ PUT /sos/{id} status=arrived berhasil")

    # 4. Verifikasi audit logs tercatat untuk tiket ini
    res_ticket_logs = client.get(f"/sos/{ticket_id}/audit-logs", headers=admin_headers)
    assert res_ticket_logs.status_code == 200
    logs = res_ticket_logs.json()
    assert len(logs) >= 3, f"Harus ada minimal 3 audit log, ditemukan {len(logs)}"

    # Periksa log disposisi armada
    disp_logs = [l for l in logs if l["action_type"] == "disposisi_armada"]
    assert len(disp_logs) >= 1, "Audit log 'disposisi_armada' harus tercatat"
    first_disp = disp_logs[0]
    assert first_disp["assigned_unit"] == "Perahu Karet TRC Unit 1"
    assert first_disp["action_label"] == "Disposisi Armada"
    assert "Perahu Karet TRC Unit 1" in first_disp["notes"]
    print(f"✅ Log Disposisi Armada tercatat: unit={first_disp['assigned_unit']}, notes={first_disp['notes']}")

    # Periksa log ubah status
    status_logs = [l for l in logs if l["action_type"] == "ubah_status_sos"]
    assert len(status_logs) >= 2, "Audit log 'ubah_status_sos' harus tercatat"
    print(f"✅ Log Perubahan Status tercatat: {len(status_logs)} kali perubahan status")


def test_emergency_status_audit_logging():
    """Pengujian pencatatan audit log saat aktivasi / deaktivasi mode darurat."""
    db = SessionLocal()
    village = db.query(Village).filter(Village.name == "Desa Banjaran").first()
    if not village:
        village = db.query(Village).first()
    db.close()

    village_id = village.id

    # 1. Pastikan nonaktif dulu jika aktif
    client.post(f"/emergency/{village_id}/deactivate", headers=admin_headers, json={"notes": "Reset darurat"})

    # 2. Admin aktivasi mode darurat
    res_act = client.post(
        f"/emergency/{village_id}/activate",
        headers=admin_headers,
        json={"notes": "Bengawan Solo meluap cepat"},
    )
    assert res_act.status_code == 200
    print(f"✅ POST /emergency/{village_id}/activate berhasil")

    # 3. Admin deaktivasi mode darurat
    res_deact = client.post(
        f"/emergency/{village_id}/deactivate",
        headers=admin_headers,
        json={"notes": "Air surut normal kembali"},
    )
    assert res_deact.status_code == 200
    print(f"✅ POST /emergency/{village_id}/deactivate berhasil")

    # 4. Verifikasi tercatat di /audit-logs
    res_logs = client.get(
        f"/audit-logs?target_type=emergency_status&action_type=emergency_activate",
        headers=admin_headers,
    )
    assert res_logs.status_code == 200
    items = res_logs.json()["items"]
    assert len(items) >= 1
    assert items[0]["action_type"] == "emergency_activate"
    assert items[0]["new_status"] == "darurat_aktif"
    print(f"✅ Log Aktivasi Darurat tercatat: {items[0]['notes']}")


def test_query_audit_logs_and_filters():
    """Pengujian query daftar audit log dan filter."""
    # List all
    res_all = client.get("/audit-logs", headers=admin_headers)
    assert res_all.status_code == 200
    data = res_all.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0
    print(f"✅ GET /audit-logs OK: Total {data['total']} log tercatat")

    # Filter action_type=disposisi_armada
    res_disp = client.get("/audit-logs?action_type=disposisi_armada", headers=admin_headers)
    assert res_disp.status_code == 200
    disp_items = res_disp.json()["items"]
    assert len(disp_items) >= 1
    for item in disp_items:
        assert item["action_type"] == "disposisi_armada"
        assert item["assigned_unit"] is not None
    print(f"✅ Filter action_type=disposisi_armada OK: {len(disp_items)} items")

    # Search keyword
    res_search = client.get("/audit-logs?search=Perahu", headers=admin_headers)
    assert res_search.status_code == 200
    search_items = res_search.json()["items"]
    assert len(search_items) >= 1
    print(f"✅ Search keyword 'Perahu' OK: {len(search_items)} match found")


def test_audit_log_stats():
    """Pengujian endpoint statistik audit log."""
    res = client.get("/audit-logs/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()
    assert "total_logs" in stats
    assert "total_disposisi" in stats
    assert "total_status_changes" in stats
    assert "actions_by_type" in stats
    assert "top_admins" in stats
    assert stats["total_disposisi"] >= 1
    assert stats["total_status_changes"] >= 1
    print(f"✅ GET /audit-logs/stats OK: Disposisi={stats['total_disposisi']}, StatusChanges={stats['total_status_changes']}")


def test_audit_log_permissions():
    """Pengujian validasi hak akses endpoint audit log."""
    # 1. Unauthenticated -> 401
    res_unauth = client.get("/audit-logs")
    assert res_unauth.status_code == 401
    print("✅ Unauthenticated access to /audit-logs rejected (401)")

    # 2. Non-admin (User) -> 403
    res_user = client.get("/audit-logs", headers=user_headers)
    assert res_user.status_code == 403
    print("✅ Non-admin access to /audit-logs rejected (403)")


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Audit Log (Disposisi Armada & Ubah Status) ---")
    test_sos_disposition_and_status_audit_logging()
    test_emergency_status_audit_logging()
    test_query_audit_logs_and_filters()
    test_audit_log_stats()
    test_audit_log_permissions()
    print("\n🎉 SEMUA TEST AUDIT LOG BERHASIL (100% PASS)!")
