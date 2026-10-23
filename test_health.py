"""
Test suite untuk endpoint Health Check & Monitoring (/health, /health/live, /health/ready).
"""

import sys
from fastapi.testclient import TestClient
from app.main import app

sys.stdout.reconfigure(encoding='utf-8')
client = TestClient(app)

def test_liveness_probe():
    with TestClient(app) as client:
        res = client.get("/health/live")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data["status"] == "live"
        assert "timestamp" in data
        print(f"✅ GET /health/live OK: status={data['status']}, timestamp={data['timestamp']}")


def test_readiness_probe():
    with TestClient(app) as client:
        res = client.get("/health/ready")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"
        assert "latency_ms" in data
        assert isinstance(data["latency_ms"], (int, float))
        print(f"✅ GET /health/ready OK: status={data['status']}, db={data['database']}, latency={data['latency_ms']} ms")


def test_full_health_check():
    with TestClient(app) as client:
        for endpoint in ["/health", "/api/health"]:
            res = client.get(endpoint)
            assert res.status_code == 200, f"Expected 200 for {endpoint}, got {res.status_code}"
            data = res.json()

            # 1. Top-level attributes
            assert data["status"] == "healthy"
            assert "uptime_seconds" in data
            assert "uptime_human" in data
            assert "app_info" in data
            assert data["app_info"]["name"] == "SiagaBencana API"
            assert data["app_info"]["version"] == "0.1.0"

            # 2. Components
            comps = data["components"]
            assert "database" in comps
            assert comps["database"]["status"] == "connected"
            assert "latency_ms" in comps["database"]

            assert "scheduler" in comps
            assert comps["scheduler"]["status"] == "running"
            assert comps["scheduler"]["jobs_count"] >= 1

            assert "websocket" in comps
            assert comps["websocket"]["status"] == "active"
            assert "total_connections" in comps["websocket"]
            assert "channels" in comps["websocket"]

            assert "external_services" in comps
            assert "open_meteo_weather" in comps["external_services"]

            print(f"✅ GET {endpoint} OK: status={data['status']}, uptime={data['uptime_human']}, db_latency={comps['database']['latency_ms']}ms, jobs={comps['scheduler']['jobs_count']}")


if __name__ == "__main__":
    print("--- Menjalankan Test Suite Health Check & Diagnostics (/health) ---")
    test_liveness_probe()
    test_readiness_probe()
    test_full_health_check()
    print("\n🎉 SEMUA TEST HEALTH CHECK BERHASIL (100% PASS)!")
