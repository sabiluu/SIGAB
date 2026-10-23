"""
Test suite untuk Fitur Ekspor CSV Tiket SOS & Audit Log BPBD.
Memvalidasi fungsionalitas ekspor, filter data, otorisasi RBAC (Admin-only), dan format berkas.
"""

import sys
import os
import csv
import io
from fastapi.testclient import TestClient

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.sos_ticket import SOSTicket
from app.models.audit_log import AuditLog

client = TestClient(app)

admin_token = create_access_token({"sub": "admin@bpbd.go.id", "role": "admin"})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

user_token = create_access_token({"sub": "warga@gmail.com", "role": "user"})
user_headers = {"Authorization": f"Bearer {user_token}"}


def test_sos_export_rbac():
    """Validasi keamanan akses endpoint /sos/export (hanya Admin)."""
    # 1. Tanpa token -> 401
    res_unauth = client.get("/sos/export")
    assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
    print("✅ GET /sos/export unauthenticated ditolak (401)")

    # 2. Token role 'user' -> 403
    res_user = client.get("/sos/export", headers=user_headers)
    assert res_user.status_code == 403, f"Expected 403, got {res_user.status_code}"
    print("✅ GET /sos/export non-admin ditolak (403)")


def test_sos_export_csv_content():
    """Validasi format berkas CSV, header kolom, dan konten data /sos/export."""
    res = client.get("/sos/export", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "text/csv" in res.headers.get("content-type", "")
    assert "attachment; filename=laporan_tiket_sos_" in res.headers.get("content-disposition", "")

    reader = csv.reader(io.StringIO(res.text))
    rows = list(reader)
    assert len(rows) >= 1, "CSV harus memiliki baris header"

    headers = rows[0]
    expected_headers = [
        "ID",
        "Nomor Tiket",
        "Waktu Lapor (WIB)",
        "Nama Pelapor",
        "No. HP Pelapor",
        "Desa Lokasi",
        "Alamat / Patokan",
        "Latitude",
        "Longitude",
        "Jumlah Jiwa KK",
        "Lansia",
        "Balita",
        "Ibu Hamil",
        "Disabilitas",
        "Skor Prioritas",
        "Status Terakhir",
        "Unit Ditugaskan",
        "Posko Tujuan",
        "Alasan Penolakan",
        "Waktu Verifikasi",
        "Waktu Diberangkatkan",
        "Waktu Tiba",
        "Waktu Selesai",
    ]
    for h in expected_headers:
        assert h in headers, f"Header '{h}' tidak ditemukan dalam CSV"

    print(f"✅ GET /sos/export berhasil: {len(rows)-1} baris tiket SOS terekspor dengan 23 kolom lengkap")


def test_sos_export_filters():
    """Validasi filter query parameter pada /sos/export."""
    # Filter status=submitted
    res_sub = client.get("/sos/export?status=submitted", headers=admin_headers)
    assert res_sub.status_code == 200
    rows_sub = list(csv.reader(io.StringIO(res_sub.text)))
    if len(rows_sub) > 1:
        status_col_idx = rows_sub[0].index("Status Terakhir")
        for r in rows_sub[1:]:
            assert r[status_col_idx] == "submitted"
    print("✅ GET /sos/export dengan filter status=submitted berfungsi")

    # Filter has_vulnerable=true
    res_vuln = client.get("/sos/export?has_vulnerable=true", headers=admin_headers)
    assert res_vuln.status_code == 200
    print("✅ GET /sos/export dengan filter has_vulnerable=true berfungsi")


def test_audit_logs_export_rbac():
    """Validasi keamanan akses endpoint /audit-logs/export (hanya Admin)."""
    # 1. Tanpa token -> 401
    res_unauth = client.get("/audit-logs/export")
    assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
    print("✅ GET /audit-logs/export unauthenticated ditolak (401)")

    # 2. Token role 'user' -> 403
    res_user = client.get("/audit-logs/export", headers=user_headers)
    assert res_user.status_code == 403, f"Expected 403, got {res_user.status_code}"
    print("✅ GET /audit-logs/export non-admin ditolak (403)")


def test_audit_logs_export_csv_content():
    """Validasi format berkas CSV, header kolom, dan konten data /audit-logs/export."""
    res = client.get("/audit-logs/export", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "text/csv" in res.headers.get("content-type", "")
    assert "attachment; filename=laporan_audit_log_" in res.headers.get("content-disposition", "")

    reader = csv.reader(io.StringIO(res.text))
    rows = list(reader)
    assert len(rows) >= 1, "CSV harus memiliki baris header"

    headers = rows[0]
    expected_headers = [
        "ID Log",
        "Waktu Kejadian (WIB)",
        "Nama Admin Pelaksana",
        "Tipe Aksi",
        "Label Aksi",
        "Entitas Target",
        "Target ID",
        "Nomor Tiket SOS",
        "Status Sebelum",
        "Status Sesudah",
        "Unit Ditugaskan",
        "Posko Terkait",
        "Catatan",
        "Alamat IP",
    ]
    for h in expected_headers:
        assert h in headers, f"Header '{h}' tidak ditemukan dalam CSV"

    print(f"✅ GET /audit-logs/export berhasil: {len(rows)-1} baris audit log terekspor dengan 14 kolom lengkap")


def test_audit_logs_export_filters():
    """Validasi filter query parameter pada /audit-logs/export."""
    # Filter action_type=disposisi_armada
    res_disp = client.get("/audit-logs/export?action_type=disposisi_armada", headers=admin_headers)
    assert res_disp.status_code == 200
    rows_disp = list(csv.reader(io.StringIO(res_disp.text)))
    if len(rows_disp) > 1:
        action_col_idx = rows_disp[0].index("Tipe Aksi")
        for r in rows_disp[1:]:
            assert r[action_col_idx] == "disposisi_armada"
    print("✅ GET /audit-logs/export dengan filter action_type=disposisi_armada berfungsi")

    # Filter search keyword
    res_search = client.get("/audit-logs/export?search=darurat", headers=admin_headers)
    assert res_search.status_code == 200
    print("✅ GET /audit-logs/export dengan filter search=darurat berfungsi")


if __name__ == "__main__":
    print("==========================================================")
    print("  PENGUJIAN FITUR EKSPOR CSV TIKET SOS & AUDIT LOG BPBD   ")
    print("==========================================================")
    test_sos_export_rbac()
    test_sos_export_csv_content()
    test_sos_export_filters()
    test_audit_logs_export_rbac()
    test_audit_logs_export_csv_content()
    test_audit_logs_export_filters()
    print("\n🎉 SEMUA PENGUJIAN EKSPOR CSV BERHASIL 100%!")
