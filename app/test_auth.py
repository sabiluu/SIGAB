"""
Script uji integrasi Auth (Register, Login, Me).
"""

import httpx

API_URL = "http://localhost:8000"

def test_auth():
    print("=== Uji Coba Auth ===")
    
    # 1. Register
    print("\n1. Mendaftar user baru...")
    register_data = {
        "full_name": "Warga Test",
        "email": "wargatest@example.com",
        "phone": "08123456789",
        "password": "password123",
        "role": "user"
    }
    
    try:
        res = httpx.post(f"{API_URL}/auth/register", json=register_data)
        if res.status_code == 201:
            print("   -> Sukses! Response:", res.json())
        else:
            print(f"   -> Gagal (Code {res.status_code}):", res.json())
    except Exception as e:
        print("Pastikan server uvicorn berjalan. Error:", e)
        return

    # 2. Login
    print("\n2. Login untuk mendapatkan Token...")
    login_data = {
        "username": "wargatest@example.com",
        "password": "password123"
    }
    res = httpx.post(f"{API_URL}/auth/login", data=login_data)
    if res.status_code != 200:
        print(f"   -> Login Gagal (Code {res.status_code}):", res.json())
        return
        
    token = res.json().get("access_token")
    print("   -> Sukses! Token JWT didapatkan.")

    # 3. Get /me
    print("\n3. Mengambil profil user (GET /auth/me)...")
    headers = {"Authorization": f"Bearer {token}"}
    res = httpx.get(f"{API_URL}/auth/me", headers=headers)
    if res.status_code == 200:
        print("   -> Sukses! Profil:")
        for k, v in res.json().items():
            print(f"      {k}: {v}")
    else:
        print(f"   -> Gagal (Code {res.status_code}):", res.json())

if __name__ == "__main__":
    test_auth()
