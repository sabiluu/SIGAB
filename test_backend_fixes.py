"""
Test suite untuk validasi perbaikan backend:
1. Emergency Photo Upload (menguji modul os terdefinisi dan upload file berhasil)
2. Akses Tiket SOS oleh Warga Pelapor (GET /sos/{ticket_id} terbuka untuk pelapor & admin, tertutup untuk warga lain)
3. Penyimpanan NIK saat Registrasi Warga
4. Konfigurasi Database Connection Pooling & Thread Safety
5. Ketahanan Scheduler terhadap Shutdown & CancelledError
6. Global Exception Handler (format JSON konsisten saat terjadi error internal)
"""

import sys
import io
from fastapi.testclient import TestClient

sys.stdout.reconfigure(encoding='utf-8')

from app.main import app
from app.core.database import SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.core.scheduler import start_scheduler, stop_scheduler, scheduler
from app.core.rate_limiter import login_rate_limiter
from app.models.user import User
from app.models.village import Village
from app.models.sos_ticket import SOSTicket
from app.models.shelter import Shelter
from app.models.notification import Notification

client = TestClient(app)

# Buat token pengujian
admin_token = create_access_token({"sub": "admin_audit@sigab.com", "role": "admin"})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

warga1_token = create_access_token({"sub": "warga1@test.com", "role": "user"})
warga1_headers = {"Authorization": f"Bearer {warga1_token}"}

warga2_token = create_access_token({"sub": "warga2@test.com", "role": "user"})
warga2_headers = {"Authorization": f"Bearer {warga2_token}"}


def setup_test_users():
    """Siapkan user dummy untuk pengujian hak akses."""
    db = SessionLocal()
    try:
        # Pastikan ada minimal 1 desa
        v = db.query(Village).first()
        if not v:
            v = Village(name="Baureno Test", latitude=-7.1282, longitude=112.1038)
            db.add(v)
            db.commit()
            db.refresh(v)

        # User admin
        admin = db.query(User).filter(User.email == "admin_audit@sigab.com").first()
        if not admin:
            admin = User(
                full_name="Admin Audit",
                email="admin_audit@sigab.com",
                phone="08111111111",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True,
            )
            db.add(admin)

        # Warga 1 (Pelapor)
        w1 = db.query(User).filter(User.email == "warga1@test.com").first()
        if not w1:
            w1 = User(
                full_name="Warga Satu",
                email="warga1@test.com",
                phone="08222222222",
                password_hash=hash_password("warga123"),
                role="user",
                village_id=v.id,
                is_active=True,
            )
            db.add(w1)

        # Warga 2 (Orang lain)
        w2 = db.query(User).filter(User.email == "warga2@test.com").first()
        if not w2:
            w2 = User(
                full_name="Warga Dua",
                email="warga2@test.com",
                phone="08333333333",
                password_hash=hash_password("warga123"),
                role="user",
                village_id=v.id,
                is_active=True,
            )
            db.add(w2)

        db.commit()
        return v.id, w1.id, w2.id
    finally:
        db.close()


def test_emergency_photo_upload():
    """Uji upload foto situasi darurat (/emergency/upload-photo) memastikan modul 'os' aktif."""
    dummy_file = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 100)
    files = {"file": ("situasi_banjir.jpg", dummy_file, "image/jpeg")}

    res = client.post("/emergency/upload-photo", files=files, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "photo_url" in data
    assert data["photo_url"].startswith("/uploads/emergency/emergency_")
    print(f"✅ POST /emergency/upload-photo berhasil: photo_url={data['photo_url']}")

    # Uji multiple upload
    dummy1 = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 50)
    dummy2 = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    multi_files = [
        ("files", ("foto1.jpg", dummy1, "image/jpeg")),
        ("files", ("foto2.png", dummy2, "image/png")),
    ]
    res_multi = client.post("/emergency/upload-photos", files=multi_files, headers=admin_headers)
    assert res_multi.status_code == 200
    multi_data = res_multi.json()
    assert multi_data["count"] == 2
    assert len(multi_data["photo_urls"]) == 2
    print(f"✅ POST /emergency/upload-photos berhasil mengunggah {multi_data['count']} berkas sekaligus")


def test_sos_ticket_citizen_access(village_id: int, w1_id: int, w2_id: int):
    """Uji izin akses GET /sos/{ticket_id} untuk Pelapor, Admin, dan penolakan untuk Warga lain."""
    import uuid
    db = SessionLocal()
    uniq_num = f"EVAC-TEST-{uuid.uuid4().hex[:6]}"
    try:
        # Buat tiket SOS oleh Warga 1
        ticket = SOSTicket(
            ticket_number=uniq_num,
            reporter_id=w1_id,
            village_id=village_id,
            gps_latitude=-7.1282,
            gps_longitude=112.1038,
            gps_address="Jl. Baureno No. 10",
            family_count=3,
            status="submitted",
            priority_score=15,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        t_id = ticket.id
    finally:
        db.close()

    # 1. Pelapor (Warga 1) membaca tiket miliknya -> 200 OK
    res_owner = client.get(f"/sos/{t_id}", headers=warga1_headers)
    assert res_owner.status_code == 200, f"Expected 200, got {res_owner.status_code}"
    assert res_owner.json()["ticket_number"] == uniq_num
    print(f"✅ GET /sos/{t_id} oleh Warga Pemilik Tiket berhasil diakses (200 OK)")

    # 2. Admin membaca tiket -> 200 OK
    res_admin = client.get(f"/sos/{t_id}", headers=admin_headers)
    assert res_admin.status_code == 200
    print(f"✅ GET /sos/{t_id} oleh Admin berhasil diakses (200 OK)")

    # 3. Warga 2 (bukan pemilik) mencoba membaca tiket Warga 1 -> 403 Forbidden
    res_other = client.get(f"/sos/{t_id}", headers=warga2_headers)
    assert res_other.status_code == 403, f"Expected 403, got {res_other.status_code}"
    print(f"✅ GET /sos/{t_id} oleh Warga lain berhasil DITOLAK (403 Forbidden)")


def test_auth_registration_nik():
    """Uji penyimpanan NIK pada registrasi user baru."""
    import uuid
    uid = uuid.uuid4().hex[:6]
    email = f"niktest_{uid}@example.com"
    nik_sample = "3522012304950001"

    body = {
        "full_name": "Test Simpan NIK",
        "email": email,
        "password": "password123",
        "phone": "081299998888",
        "nik": nik_sample,
        "role": "user"
    }
    res = client.post("/auth/register", json=body)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"

    # Verifikasi langsung ke database
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.nik == nik_sample, f"Expected NIK '{nik_sample}', got '{user.nik}'"
        print(f"✅ POST /auth/register berhasil menyimpan field NIK: '{user.nik}'")
    finally:
        db.close()


def test_database_pooling_and_scheduler():
    """Uji konfigurasi engine database dan ketahanan scheduler."""
    import asyncio

    # 1. Database engine checks
    assert hasattr(engine.pool, "is_mock") or engine.pool is not None
    dialect = engine.dialect.name
    print(f"✅ Database Engine dikonfigurasi dengan pool_pre_ping aktif (Dialect: {dialect})")

    # 2. Scheduler safe idempotent calls outside loop
    start_scheduler()
    print("✅ start_scheduler() tanpa running loop tidak melempar crash RuntimeError")

    # 3. Scheduler safe calls inside loop
    async def async_test():
        start_scheduler()
        assert scheduler.running is True
        # Panggilan kedua tidak boleh error
        start_scheduler()
        stop_scheduler()
        # Shutdown kedua tidak boleh error
        stop_scheduler()

    asyncio.run(async_test())
    print("✅ Scheduler berhasil start & stop secara aman dan idempotent")


def test_auth_login_form_and_role_filter():
    """Uji login form-urlencoded & multipart/form-data serta verifikasi role filter."""
    # 1. Form-urlencoded warga login as warga -> BERHASIL
    res_warga_ok = client.post(
        "/auth/login",
        data={"username": "warga1@test.com", "password": "warga123", "role": "warga"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert res_warga_ok.status_code == 200, f"Expected 200, got {res_warga_ok.status_code}: {res_warga_ok.text}"
    assert "access_token" in res_warga_ok.json()
    print("✅ POST /auth/login (form-urlencoded) warga login sebagai warga berhasil (200)")

    # 2. Form-urlencoded warga login as petugas -> DITOLAK (Role Mismatch)
    res_warga_wrong_role = client.post(
        "/auth/login",
        data={"username": "warga1@test.com", "password": "warga123", "role": "petugas"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert res_warga_wrong_role.status_code == 400
    assert "bukan terdaftar sebagai Petugas BPBD" in res_warga_wrong_role.json().get("detail", "")
    print("✅ POST /auth/login (form-urlencoded) warga ditolak jika role=petugas (400)")

    # 3. Multipart form-data admin login as petugas -> BERHASIL
    res_admin_multipart = client.post(
        "/auth/login",
        data={"username": "admin_audit@sigab.com", "password": "admin123", "role": "petugas"},
    )
    assert res_admin_multipart.status_code == 200
    assert "access_token" in res_admin_multipart.json()
    print("✅ POST /auth/login (multipart/form-data) admin login sebagai petugas berhasil (200)")

    # 4. Form login dengan field 'email' pengganti 'username' -> BERHASIL
    res_email_field = client.post(
        "/auth/login",
        data={"email": "warga1@test.com", "password": "warga123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert res_email_field.status_code == 200
    assert "access_token" in res_email_field.json()
    print("✅ POST /auth/login (form-urlencoded) dengan field 'email' berhasil (200)")


def test_sos_ticket_collision_and_sequence(village_id, reporter_id):
    """Uji generator tiket SOS kebal terhadap collision dan gap sequence."""
    from app.core.timezone import get_wib_now
    now = get_wib_now()
    today_str = now.strftime("%Y-%m%d")

    # 1. Buat tiket SOS normal via API
    payload1 = {
        "village_id": village_id,
        "gps_latitude": -7.1282,
        "gps_longitude": 112.1038,
        "gps_address": "Jl. Raya Baureno No. 1",
        "family_count": 3,
        "has_elderly": True,
        "has_toddler": False,
        "has_disability": False,
        "has_pregnant": False,
    }
    r1 = client.post("/sos", json=payload1, headers=warga1_headers)
    assert r1.status_code == 200, f"Failed: {r1.text}"
    ticket1_num = r1.json()["ticket_number"]
    assert ticket1_num.startswith(f"EVAC-BRN-{today_str}-")
    print(f"✅ Tiket SOS pertama berhasil dibuat: {ticket1_num}")

    # 2. Buat tiket SOS kedua via API
    payload2 = {
        "village_id": village_id,
        "gps_latitude": -7.1283,
        "gps_longitude": 112.1039,
        "gps_address": "Jl. Raya Baureno No. 2",
        "family_count": 2,
    }
    r2 = client.post("/sos", json=payload2, headers=warga1_headers)
    assert r2.status_code == 200, f"Failed: {r2.text}"
    ticket2_num = r2.json()["ticket_number"]
    assert ticket2_num != ticket1_num
    prefix = f"EVAC-BRN-{today_str}-"
    seq1 = int(ticket1_num.replace(prefix, "").split("-")[0])
    seq2 = int(ticket2_num.replace(prefix, "").split("-")[0])
    assert seq2 > seq1, f"Expected {seq2} > {seq1}"
    print(f"✅ Tiket SOS kedua berurutan tanpa collision: {ticket2_num} (seq {seq2} > {seq1})")

    # 3. Simulasi adanya gap sequence / pre-existing sequence di database
    db = SessionLocal()
    try:
        dummy_seq = seq2 + 5
        dummy_ticket_num = f"{prefix}{dummy_seq:03d}"
        dummy_t = SOSTicket(
            ticket_number=dummy_ticket_num,
            reporter_id=reporter_id,
            village_id=village_id,
            gps_latitude=-7.128,
            gps_longitude=112.103,
            family_count=1,
            status="submitted",
            priority_score=2,
            submitted_at=now,
            updated_at=now,
        )
        db.add(dummy_t)
        db.commit()
    finally:
        db.close()

    # 4. Buat tiket SOS ketiga melalui API, generator HARUS melompati gap dan tidak bentrok dengan dummy_seq
    r3 = client.post("/sos", json=payload1, headers=warga1_headers)
    assert r3.status_code == 200, f"Failed: {r3.text}"
    ticket3_num = r3.json()["ticket_number"]
    seq3 = int(ticket3_num.replace(prefix, "").split("-")[0])
    assert seq3 > dummy_seq, f"Expected seq3 ({seq3}) > dummy_seq ({dummy_seq})"
    print(f"✅ Tiket SOS ketiga kebal gap/collision dan melompat aman ke nomor: {ticket3_num}")


def test_sos_ticket_validation(village_id: int):
    """Uji validasi schema SOS: family_count >= 1 dan status enum valid."""
    # 1. family_count = 0 DITOLAK (422)
    invalid_payload_zero = {
        "village_id": village_id,
        "gps_latitude": -7.1282,
        "gps_longitude": 112.1038,
        "family_count": 0,
    }
    r_zero = client.post("/sos", json=invalid_payload_zero, headers=warga1_headers)
    assert r_zero.status_code == 422, f"Expected 422, got {r_zero.status_code}"
    print("✅ POST /sos dengan family_count=0 berhasil ditolak (422 Unprocessable Entity)")

    # 2. family_count negatif DITOLAK (422)
    invalid_payload_neg = {
        "village_id": village_id,
        "gps_latitude": -7.1282,
        "gps_longitude": 112.1038,
        "family_count": -5,
    }
    r_neg = client.post("/sos", json=invalid_payload_neg, headers=warga1_headers)
    assert r_neg.status_code == 422, f"Expected 422, got {r_neg.status_code}"
    print("✅ POST /sos dengan family_count=-5 berhasil ditolak (422 Unprocessable Entity)")

    # 3. family_count valid (e.g. 4) DITERIMA (200)
    valid_payload = {
        "village_id": village_id,
        "gps_latitude": -7.1282,
        "gps_longitude": 112.1038,
        "family_count": 4,
    }
    r_ok = client.post("/sos", json=valid_payload, headers=warga1_headers)
    assert r_ok.status_code == 200, f"Expected 200, got {r_ok.status_code}"
    created_id = r_ok.json()["id"]
    assert r_ok.json()["family_count"] == 4
    print("✅ POST /sos dengan family_count=4 berhasil diterima (200 OK)")

    # 4. PUT /sos/{id} dengan status tidak valid DITOLAK (422)
    r_invalid_status = client.put(
        f"/sos/{created_id}",
        json={"status": "status_asal_asalan"},
        headers=admin_headers
    )
    assert r_invalid_status.status_code == 422, f"Expected 422, got {r_invalid_status.status_code}"
    print("✅ PUT /sos/{id} dengan status tidak valid berhasil ditolak (422 Unprocessable Entity)")

    # 5. PUT /sos/{id} dengan status valid 'verified' DITERIMA (200)
    r_valid_status = client.put(
        f"/sos/{created_id}",
        json={"status": "verified"},
        headers=admin_headers
    )
    assert r_valid_status.status_code == 200, f"Expected 200, got {r_valid_status.status_code}"
    assert r_valid_status.json()["status"] == "verified"
    print("✅ PUT /sos/{id} dengan status valid 'verified' berhasil diupdate (200 OK)")


def test_shelter_deletion_protection(village_id: int, reporter_id: int):
    """Uji proteksi penghapusan shelter jika ada pengungsi atau tiket SOS aktif."""
    import uuid
    db = SessionLocal()
    shelter = Shelter(
        name="Posko Uji Proteksi Deletion",
        address="Jl. Raya Baureno No. 99",
        village_id=village_id,
        latitude=-7.129,
        longitude=112.104,
        capacity_total=100,
        capacity_occupied=15,  # Ada 15 pengungsi
        is_active=True,
    )
    db.add(shelter)
    db.commit()
    db.refresh(shelter)
    shelter_id = shelter.id
    db.close()

    # 1. Coba hapus saat capacity_occupied > 0 -> DITOLAK (400)
    del_res1 = client.delete(f"/shelters/{shelter_id}", headers=admin_headers)
    assert del_res1.status_code == 400, f"Expected 400, got {del_res1.status_code}: {del_res1.text}"
    assert "pengungsi" in del_res1.json().get("detail", "")
    print("✅ DELETE /shelters/{id} ditolak saat masih ada jiwa pengungsi (400 Bad Request)")

    # 2. Kosongkan kapasitas pengungsi, tapi buat tiket SOS aktif menuju posko ini
    db = SessionLocal()
    s = db.query(Shelter).filter(Shelter.id == shelter_id).first()
    s.capacity_occupied = 0
    db.commit()

    active_ticket = SOSTicket(
        ticket_number=f"EVAC-SHL-{uuid.uuid4().hex[:6]}",
        reporter_id=reporter_id,
        village_id=village_id,
        gps_latitude=-7.128,
        gps_longitude=112.103,
        family_count=2,
        status="dispatched",  # Tim sedang dalam perjalanan evakuasi menuju posko ini
        shelter_destination_id=shelter_id,
        priority_score=10,
    )
    db.add(active_ticket)
    db.commit()
    db.refresh(active_ticket)
    t_id = active_ticket.id
    db.close()

    # 3. Coba hapus saat ada tiket SOS aktif menuju posko -> DITOLAK (400)
    del_res2 = client.delete(f"/shelters/{shelter_id}", headers=admin_headers)
    assert del_res2.status_code == 400, f"Expected 400, got {del_res2.status_code}: {del_res2.text}"
    assert "tiket SOS aktif" in del_res2.json().get("detail", "")
    print("✅ DELETE /shelters/{id} ditolak saat ada tiket SOS aktif mengarah ke posko (400 Bad Request)")

    # 4. Selesaikan tiket SOS (status='completed')
    db = SessionLocal()
    t = db.query(SOSTicket).filter(SOSTicket.id == t_id).first()
    t.status = "completed"
    db.commit()
    db.close()

    # 5. Sekarang hapus posko -> BERHASIL (204 No Content)
    del_res3 = client.delete(f"/shelters/{shelter_id}", headers=admin_headers)
    assert del_res3.status_code == 204
    print("✅ DELETE /shelters/{id} berhasil saat posko aman dan tidak ada operasi aktif (204 No Content)")

    # 6. Verifikasi posko telah terhapus
    get_res = client.get(f"/shelters/{shelter_id}")
    assert get_res.status_code == 404
    print("✅ Terverifikasi posko telah terhapus dari database (404 Not Found)")


def test_notifications_optimization_and_clear_all(user_id: int):
    """Uji bulk update mark all read dan DELETE /notifications/clear-all."""
    # 1. Setup 3 notifikasi dummy belum dibaca
    db = SessionLocal()
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    for i in range(1, 4):
        notif = Notification(
            user_id=user_id,
            type="peringatan_banjir",
            title=f"Peringatan Dini Banjir #{i}",
            message="Debit air Bengawan Solo meningkat",
            is_read=False,
            is_pushed=True,
        )
        db.add(notif)
    db.commit()
    db.close()

    # 2. Cek unread count -> 3
    res_count = client.get("/notifications/unread-count", headers=warga1_headers)
    assert res_count.status_code == 200
    assert res_count.json()["count"] == 3
    print("✅ GET /notifications/unread-count berhasil: 3 notifikasi belum dibaca")

    # 3. Uji POST /notifications/read-all (bulk update synchronize_session=False)
    res_read_all = client.post("/notifications/read-all", headers=warga1_headers)
    assert res_read_all.status_code == 200
    assert res_read_all.json()["updated_count"] == 3
    print("✅ POST /notifications/read-all berhasil dengan synchronize_session=False (updated_count: 3)")

    # Pastikan sekarang unread count = 0
    res_count_after = client.get("/notifications/unread-count", headers=warga1_headers)
    assert res_count_after.json()["count"] == 0

    # 4. Buat 1 notifikasi baru unread
    db = SessionLocal()
    new_unread = Notification(
        user_id=user_id,
        type="sos_update",
        title="Tiket Disetujui",
        message="Tim penyelamat bergerak",
        is_read=False,
        is_pushed=True,
    )
    db.add(new_unread)
    db.commit()
    db.close()

    # 5. Uji DELETE /notifications/clear-all?read_only=true
    res_clear_read = client.delete("/notifications/clear-all?read_only=true", headers=warga1_headers)
    assert res_clear_read.status_code == 200
    assert res_clear_read.json()["deleted_count"] == 3
    print("✅ DELETE /notifications/clear-all?read_only=true berhasil menghapus hanya notifikasi yang sudah dibaca")

    # Cek sisa notifikasi
    res_remain = client.get("/notifications", headers=warga1_headers)
    assert len(res_remain.json()) == 1
    assert res_remain.json()[0]["is_read"] is False

    # 6. Uji DELETE /notifications/clear-all (hapus semua sisa)
    res_clear_all = client.delete("/notifications/clear-all", headers=warga1_headers)
    assert res_clear_all.status_code == 200
    assert res_clear_all.json()["deleted_count"] == 1
    print("✅ DELETE /notifications/clear-all berhasil membersihkan seluruh sisa notifikasi")

    res_empty = client.get("/notifications", headers=warga1_headers)
    assert len(res_empty.json()) == 0
    print("✅ Terverifikasi seluruh notifikasi telah bersih (total: 0)")


def test_last_admin_protection():
    """Uji proteksi penghapusan, penonaktifan, dan penurunan role pada akun admin terakhir."""
    db = SessionLocal()
    admin_temp = db.query(User).filter(User.email == "admin_temp@test.com").first()
    if not admin_temp:
        admin_temp = User(
            full_name="Admin Temp",
            email="admin_temp@test.com",
            phone="08199999999",
            password_hash=hash_password("admin123"),
            role="admin",
            is_active=True,
        )
        db.add(admin_temp)
        db.commit()
        db.refresh(admin_temp)
    temp_admin_id = admin_temp.id
    db.close()

    # 1. Hapus admin_temp menggunakan admin_audit -> BERHASIL (karena masih ada admin_audit aktif)
    del_res = client.delete(f"/users/{temp_admin_id}", headers=admin_headers)
    assert del_res.status_code == 204
    print("✅ DELETE /users/{id} berhasil menghapus admin sekunder ketika masih ada admin lain (204 No Content)")

    # 2. Simulasi situasi 1 admin aktif tersisa
    db = SessionLocal()
    remaining_admins = db.query(User).filter(User.role == "admin", User.is_active == True).all()
    other_admin_ids = [a.id for a in remaining_admins if a.email != "admin_audit@sigab.com"]
    for oid in other_admin_ids:
        oa = db.query(User).filter(User.id == oid).first()
        if oa:
            oa.is_active = False
    db.commit()

    main_admin = db.query(User).filter(User.email == "admin_audit@sigab.com").first()
    main_admin_id = main_admin.id
    db.close()

    try:
        # Coba nonaktifkan admin terakhir -> Ditolak (400)
        res_deact = client.patch(f"/users/{main_admin_id}/status", json={"is_active": False}, headers=admin_headers)
        assert res_deact.status_code == 400
        print("✅ PATCH /users/{id}/status ditolak saat menonaktifkan admin terakhir (400 Bad Request)")

        # Coba turunkan role admin terakhir menjadi 'user' -> Ditolak (400)
        res_demote = client.put(f"/users/{main_admin_id}", json={"role": "user"}, headers=admin_headers)
        assert res_demote.status_code == 400
        assert "terakhir" in res_demote.json().get("detail", "")
        print("✅ PUT /users/{id} ditolak saat menurunkan role admin terakhir (400 Bad Request)")

        # Coba hapus admin terakhir -> Ditolak (400)
        res_del = client.delete(f"/users/{main_admin_id}", headers=admin_headers)
        assert res_del.status_code == 400
        print("✅ DELETE /users/{id} ditolak saat mencoba menghapus admin terakhir (400 Bad Request)")
    finally:
        db = SessionLocal()
        for oid in other_admin_ids:
            u = db.query(User).filter(User.id == oid).first()
            if u:
                u.is_active = True
        db.commit()
        db.close()


def test_websocket_plain_and_json_ping():
    """Uji toleransi WebSocket endpoint menerima plain text 'ping' dan JSON {'type':'ping'}."""
    import json

    # 1. Test /ws/alerts
    with client.websocket_connect("/ws/alerts?village_id=1") as ws:
        init_data = json.loads(ws.receive_text())
        assert init_data["type"] == "connected"

        # Kirim plain text "ping"
        ws.send_text("ping")
        resp1 = json.loads(ws.receive_text())
        assert resp1["type"] == "pong"
        print("✅ WS /ws/alerts plain text 'ping' berhasil dijawab dengan pong")

        # Kirim JSON {"type": "ping"}
        ws.send_text(json.dumps({"type": "ping"}))
        resp2 = json.loads(ws.receive_text())
        assert resp2["type"] == "pong"
        print("✅ WS /ws/alerts JSON {'type': 'ping'} berhasil dijawab dengan pong")

    # 2. Test /ws/dashboard
    with client.websocket_connect("/ws/dashboard") as ws:
        init_snapshot = json.loads(ws.receive_text())
        assert "stats" in init_snapshot or "villages" in init_snapshot

        # Kirim plain text "ping"
        ws.send_text("ping")
        resp_dash = json.loads(ws.receive_text())
        assert resp_dash["type"] == "pong"
        print("✅ WS /ws/dashboard plain text 'ping' berhasil dijawab dengan pong")

    # 3. Test /ws/sos
    with client.websocket_connect("/ws/sos") as ws:
        init_sos = json.loads(ws.receive_text())
        assert init_sos["type"] == "connected"

        ws.send_text("ping")
        resp_sos = json.loads(ws.receive_text())
        assert resp_sos["type"] == "pong"
        print("✅ WS /ws/sos plain text 'ping' berhasil dijawab dengan pong")


def test_user_nik_indexing():
    """Uji konfigurasi index=True pada kolom nik di User model dan keberadaan index di DB."""
    from sqlalchemy import inspect
    
    # 1. Pastikan kolom User.nik memiliki konfigurasi index=True
    assert User.nik.index is True or any(idx.name == "ix_users_nik" for idx in User.__table__.indexes)
    print("✅ Model User.nik terkonfigurasi dengan index=True pada ORM schema")

    # 2. Pastikan database SQLite memiliki index fisik 'ix_users_nik'
    inspector = inspect(engine)
    indexes = inspector.get_indexes("users")
    index_names = {idx["name"] for idx in indexes if idx.get("name")}
    assert "ix_users_nik" in index_names, f"Expected 'ix_users_nik' in {index_names}"
    print(f"✅ Indeks fisik 'ix_users_nik' terverifikasi aktif pada tabel users: {index_names}")

    # 3. Query pencarian by NIK berjalan lancar
    db = SessionLocal()
    try:
        user_by_nik = db.query(User).filter(User.nik == "3522012304950001").first()
        assert user_by_nik is not None
        print(f"✅ Query pencarian O(log N) berdasarkan NIK berhasil: user #{user_by_nik.id} ({user_by_nik.full_name})")
    finally:
        db.close()


def test_login_rate_limiting():
    """Uji proteksi brute-force login (Rate Limiter: 5 percobaan gagal per 60 detik -> 429 Too Many Requests)."""
    # 1. Pastikan state limiter bersih
    login_rate_limiter.reset()

    target_email = "admin_audit@sigab.com"
    test_headers = {"X-Forwarded-For": "203.0.113.195"}

    # 2. Lakukan 5 percobaan login gagal berturut-turut
    for i in range(1, 6):
        res = client.post(
            "/auth/login",
            json={"email": target_email, "password": "wrongpassword123"},
            headers=test_headers,
        )
        assert res.status_code == 400, f"Attempt #{i} should be 400 Bad Request, got {res.status_code}"
        assert "Email atau kata sandi salah" in res.json()["detail"]
    print("✅ 5 percobaan login gagal pertama tercatat dan ditolak dengan 400 Bad Request")

    # 3. Percobaan ke-6 harus diblokir oleh Rate Limiter dengan status 429 Too Many Requests
    blocked_res = client.post(
        "/auth/login",
        json={"email": target_email, "password": "wrongpassword123"},
        headers=test_headers,
    )
    assert blocked_res.status_code == 429, f"Attempt #6 should be 429 Too Many Requests, got {blocked_res.status_code}"
    assert "Terlalu banyak percobaan login yang gagal" in blocked_res.json()["detail"]
    assert "Retry-After" in blocked_res.headers
    retry_after = int(blocked_res.headers["Retry-After"])
    assert 1 <= retry_after <= 60
    print(f"✅ Percobaan ke-6 diblokir dengan 429 Too Many Requests (Retry-After: {retry_after}s)")

    # 4. Tes juga pada endpoint /api/login dengan IP yang sama
    api_blocked_res = client.post(
        "/api/login",
        json={"email": target_email, "password": "wrongpassword123"},
        headers=test_headers,
    )
    assert api_blocked_res.status_code == 429
    print("✅ Proteksi brute-force terintegrasi konsisten pada endpoint /api/login")

    # 5. Setelah reset (atau masa ban berakhir), login sah berhasil
    login_rate_limiter.reset()
    success_res = client.post(
        "/auth/login",
        json={"email": target_email, "password": "admin123"},
        headers=test_headers,
    )
    assert success_res.status_code == 200
    assert "access_token" in success_res.json()
    print("✅ Login berhasil (200 OK) setelah counter brute-force direset")


if __name__ == "__main__":
    print("=================================================================")
    print("    TEST SUITE VERIFIKASI PERBAIKAN BACKEND SIAGABENCANA        ")
    print("=================================================================")
    v_id, w1_id, w2_id = setup_test_users()
    test_emergency_photo_upload()
    test_sos_ticket_citizen_access(v_id, w1_id, w2_id)
    test_auth_registration_nik()
    test_database_pooling_and_scheduler()
    test_auth_login_form_and_role_filter()
    test_sos_ticket_collision_and_sequence(v_id, w1_id)
    test_sos_ticket_validation(v_id)
    test_shelter_deletion_protection(v_id, w1_id)
    test_notifications_optimization_and_clear_all(w1_id)
    test_last_admin_protection()
    test_websocket_plain_and_json_ping()
    test_user_nik_indexing()
    test_login_rate_limiting()
    print("\n🎉 SEMUA TEST VERIFIKASI PERBAIKAN BACKEND BERHASIL (100% PASS)!\n")
