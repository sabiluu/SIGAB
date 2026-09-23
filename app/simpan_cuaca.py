import requests
import json
import time
import os

API_KEY = "e3fe4499eabe3c6414c7761709c15191"

# Daftar 25 Desa di Kecamatan Baureno beserta perkiraan koordinatnya
# (Anda perlu memperbarui nilai lat & lon ini dengan koordinat persis tiap desa nanti)
daftar_desa = [
    {"nama": "Banjaran", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Banjaranyar", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Baureno", "lat": -7.1286, "lon": 112.1050},
    {"nama": "Blongsong", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Bumiayu", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Drajat", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Gajah", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Gunungsari", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Kalisari", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Karangdayu", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Kauman", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Kedungrejo", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Lebaksari", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Ngemplak", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Pasinan", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Pomahan", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Pucangarum", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Selorejo", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Sembunglor", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Sraturejo", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Sumuragung", "lat": -7.1425, "lon": 112.1525},
    {"nama": "Tanggungan", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Tlogoagung", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Trojalu", "lat": -7.1282, "lon": 112.1038},
    {"nama": "Tulungagung", "lat": -7.1282, "lon": 112.1038},
]

hasil_cuaca_kecamatan = []

print("Mulai mengambil data cuaca untuk 25 Desa di Kecamatan Baureno...")

for desa in daftar_desa:
    print(f"Mengambil cuaca untuk Desa {desa['nama']}...")
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={desa['lat']}&lon={desa['lon']}&appid={API_KEY}&units=metric&lang=id"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        data_json = response.json()
        hasil_cuaca_kecamatan.append({
            "desa": desa["nama"],
            "suhu": data_json["main"]["temp"],
            "kondisi": data_json["weather"][0]["description"],
            "kelembapan": data_json["main"]["humidity"],
            "angin": data_json["wind"]["speed"],
            "raw_data": data_json # Menyimpan seluruh JSON aslinya juga (Opsional)
        })
    else:
        print(f"  [Gagal] mengambil cuaca Desa {desa['nama']} (Error {response.status_code})")
        
    # Beri jeda 0.5 detik agar API Key Anda tidak terkena limit (Rate Limit)
    time.sleep(0.5)

# Menyimpan semua data cuaca dari 25 desa ke dalam satu file JSON
file_path = "data_cuaca_baureno_semua_desa.json"
with open(file_path, "w") as file:
    json.dump(hasil_cuaca_kecamatan, file, indent=4)

print(f"\n[Selesai] Data cuaca 25 Desa telah disimpan ke: {os.path.abspath(file_path)}")
