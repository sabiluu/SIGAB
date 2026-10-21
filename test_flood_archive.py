"""
Test suite untuk Endpoint Data Arsip dan Log Kejadian Banjir Lampau.
"""

import sys
import os
from datetime import datetime
from fastapi.testclient import TestClient

# Ensure root directory is on python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

# Generate auth tokens
admin_token = create_access_token({"sub": "admin@bpbd.go.id", "role": "admin"})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

user_token = create_access_token({"sub": "warga@gmail.com", "role": "user"})
user_headers = {"Authorization": f"Bearer {user_token}"}


def test_get_incidents_list():
    """Test GET /flood/incidents dan GET /flood/archive/incidents."""
    for path in ["/flood/incidents", "/flood/archive/incidents"]:
        res = client.get(path)
        assert res.status_code == 200, f"Failed on {path}: {res.text}"
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert "stats" in data
        assert len(data["items"]) >= 5
        print(f"✅ {path} OK: returned {len(data['items'])} items, total: {data['total']}")

        first = data["items"][0]
        assert "color" in first
        assert "tma" in first
        assert "rainfall" in first
        assert "evacuation" in first
        assert "date" in first
        print(f"   Sample item: {first['title']} | cat: {first['category']} | color: {first['color']} | tma: {first['tma']}")


def test_incidents_filtering():
    """Test filtering by category, year, and search."""
    # Filter category awas
    res_awas = client.get("/flood/incidents?category=awas")
    assert res_awas.status_code == 200
    awas_items = res_awas.json()["items"]
    assert len(awas_items) >= 2
    for item in awas_items:
        assert item["category"] == "awas"
        assert item["color"] == "red"
    print(f"✅ Filter category=awas OK: {len(awas_items)} items")

    # Filter year 2026
    res_2026 = client.get("/flood/incidents?year=2026")
    assert res_2026.status_code == 200
    items_2026 = res_2026.json()["items"]
    for item in items_2026:
        assert "2026" in item["event_date"]
    print(f"✅ Filter year=2026 OK: {len(items_2026)} items")

    # Search keyword
    res_search = client.get("/flood/incidents?search=Bengawan")
    assert res_search.status_code == 200
    search_items = res_search.json()["items"]
    assert len(search_items) >= 1
    assert "Bengawan" in search_items[0]["title"] or "Bengawan" in (search_items[0]["description"] or "")
    print(f"✅ Search keyword 'Bengawan' OK: {len(search_items)} match found")


def test_get_archive_stats():
    """Test GET /flood/incidents/stats dan GET /flood/archive/stats."""
    for path in ["/flood/incidents/stats", "/flood/archive/stats"]:
        res = client.get(path)
        assert res.status_code == 200
        stats = res.json()
        assert stats["total_incidents"] >= 5
        assert stats["awas_count"] >= 2
        assert stats["total_evacuated"] > 0
        assert stats["max_tma_mdpl"] is not None
        print(f"✅ {path} OK: Total={stats['total_incidents']}, Awas={stats['awas_count']}, Evac={stats['total_evacuated']}, Max TMA={stats['max_tma_mdpl']} mdpl")


def test_get_incident_detail():
    """Test GET /flood/incidents/{id}."""
    res = client.get("/flood/incidents/1")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert "title" in data
    print(f"✅ Detail Incident #1 OK: {data['title']}")

    # 404 test
    res_404 = client.get("/flood/incidents/99999")
    assert res_404.status_code == 404
    print("✅ Detail Incident #99999 correctly returned 404")


def test_admin_crud_workflow():
    """Test Create, Update, Delete flood incident (Admin auth)."""
    # 1. Unauthenticated creation should fail with 401
    unauth_res = client.post("/flood/incidents", json={
        "title": "Banjir Uji Coba",
        "event_date": "2026-03-01T10:00:00",
        "category": "siaga",
    })
    assert unauth_res.status_code == 401
    print("✅ Unauthenticated POST correctly rejected (401)")

    # 2. Non-admin user creation should fail with 403
    user_res = client.post("/flood/incidents", headers=user_headers, json={
        "title": "Banjir Uji Coba",
        "event_date": "2026-03-01T10:00:00",
        "category": "siaga",
    })
    assert user_res.status_code == 403
    print("✅ Non-admin POST correctly rejected (403)")

    # 3. Admin creation succeeds
    new_payload = {
        "title": "Simulasi Banjir Bengawan Solo Maret 2026",
        "description": "Pengujian kapasitas respon darurat banjir di Baureno",
        "category": "siaga",
        "water_level_m": 3.8,
        "discharge_m3s": 1250.0,
        "rainfall_mm": 95.0,
        "evacuated_count": 25,
        "affected_people_count": 100,
        "shelter_count": 1,
        "affected_villages": "Baureno, Kalisari",
        "event_date": "2026-03-01T10:00:00",
        "status": "selesai",
        "is_archived": True,
    }
    create_res = client.post("/flood/incidents", headers=admin_headers, json=new_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    created_id = created_data["id"]
    assert created_data["title"] == new_payload["title"]
    assert created_data["color"] == "yellow"
    assert "3.8 mdpl" in created_data["tma"]
    print(f"✅ Admin POST created incident #{created_id}")

    # 4. Admin Update
    update_payload = {
        "title": "Simulasi Banjir Bengawan Solo Maret 2026 (Updated)",
        "category": "awas",
        "water_level_m": 4.5,
        "evacuated_count": 80,
    }
    update_res = client.put(f"/flood/incidents/{created_id}", headers=admin_headers, json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["title"] == update_payload["title"]
    assert updated_data["category"] == "awas"
    assert updated_data["color"] == "red"
    assert updated_data["evacuated_count"] == 80
    print(f"✅ Admin PUT updated incident #{created_id}")

    # 5. Admin Delete
    del_res = client.delete(f"/flood/incidents/{created_id}", headers=admin_headers)
    assert del_res.status_code == 200
    print(f"✅ Admin DELETE incident #{created_id} OK")

    # Verify deleted
    verify_res = client.get(f"/flood/incidents/{created_id}")
    assert verify_res.status_code == 404
    print(f"✅ Verified incident #{created_id} is deleted (404)")


def test_export_archive():
    """Test GET /flood/archive/export (CSV & JSON)."""
    # CSV export
    res_csv = client.get("/flood/archive/export?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment" in res_csv.headers.get("content-disposition", "")
    csv_text = res_csv.text
    assert "Judul Kejadian" in csv_text
    assert "TMA (mdpl)" in csv_text
    assert "Banjir Bandang" in csv_text
    print("✅ CSV export OK: Headers and content validated")

    # JSON export
    res_json = client.get("/flood/archive/export?format=json")
    assert res_json.status_code == 200
    json_data = res_json.json()
    assert isinstance(json_data, list)
    assert len(json_data) >= 5
    print(f"✅ JSON export OK: {len(json_data)} records")


def test_historical_calculation_logs_archive():
    """Test GET /flood/archive/logs dan GET /flood/archive/logs/summary."""
    # Logs list
    res_logs = client.get("/flood/archive/logs?page=1&page_size=10")
    assert res_logs.status_code == 200
    logs_data = res_logs.json()
    assert "items" in logs_data
    assert "total" in logs_data
    assert len(logs_data["items"]) <= 10
    if len(logs_data["items"]) > 0:
        first_log = logs_data["items"][0]
        assert "probability_score" in first_log
        assert "risk_level" in first_log
    print(f"✅ Calculation logs archive OK: returned {len(logs_data['items'])}, total in DB: {logs_data['total']}")

    # Logs summary
    res_summary = client.get("/flood/archive/logs/summary")
    assert res_summary.status_code == 200
    summary_data = res_summary.json()
    assert "total_logs" in summary_data
    assert "avg_probability" in summary_data
    assert "risk_distribution" in summary_data
    print(f"✅ Calculation logs summary OK: total={summary_data['total_logs']}, avg_prob={summary_data['avg_probability']}")


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Endpoint Data Arsip & Log Kejadian Banjir Lampau ---")
    test_get_incidents_list()
    test_incidents_filtering()
    test_get_archive_stats()
    test_get_incident_detail()
    test_admin_crud_workflow()
    test_export_archive()
    test_historical_calculation_logs_archive()
    print("\n🎉 SEMUA TEST BERHASIL (100% PASS)!")
