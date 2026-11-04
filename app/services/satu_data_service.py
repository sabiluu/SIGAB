"""
Service Integrasi Portal Satu Data Bojonegoro
(https://data.bojonegorokab.go.id/badan-penanggulangan-bencana.html@detail=kejadian-bencana)

Mengambil data kejadian bencana resmi BPBD Kabupaten Bojonegoro:
- Filter Kecamatan: Baureno (Kode 352210)
- Filter Jenis Bencana:
    1. Banjir Bengawan Solo (Luapan Sungai) [ID: 8]
    2. Banjir Luapan Sungai / Genangan [ID: 1]
- Filter Tahun: Semua Tahun [ID: 0]
- Filter Desa: Semua Desa di Kecamatan Baureno [ID: 0]

Menyinkronkan data secara otomatis ke database SIGAB (tabel flood_incidents)
dan memastikan persistensi berkas arsip lokal (rekap_banjir_baureno.csv).
"""

import os
import re
import csv
import ssl
import json
import logging
import urllib.request
import urllib.parse
import http.cookiejar
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.flood_incident import FloodIncident
from ..models.village import Village

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CSV_PATH = os.path.join(BASE_DIR, "rekap_banjir_baureno.csv")

# URL Endpoint Satu Data Bojonegoro
PORTAL_BASE = "https://data.bojonegorokab.go.id"
PAGE_URL = f"{PORTAL_BASE}/badan-penanggulangan-bencana.html@detail=kejadian-bencana"
SET_SESSION_URL = f"{PORTAL_BASE}/public/reff_bpbd/ajax_setSession"
GET_TABLE_DATA_URL = f"{PORTAL_BASE}/public/reff_bpbd/get_table_data/kejadian"
DETAIL_URL = f"{PORTAL_BASE}/public/reff_bpbd/detailKejadian"

# Filter Resmi Baureno
KECAMATAN_BAURENO_CODE = "352210"

# Target Jenis Bencana (Banjir Bengawan Solo & Luapan Sungai)
TARGET_BENCANA = [
    ("8", "Banjir Bengawan Solo (Luapan Sungai)"),
    ("1", "Banjir Luapan Sungai / Genangan"),
]

# Pemetaan hidrologis manual untuk data historis BPBD awal jika belum ada sensor
DEFAULT_HYDRO_METRICS = {
    "awas": {"water_level_m": 1.20, "discharge_m3s": 1680.0, "rainfall_mm": 135.0},
    "siaga": {"water_level_m": 0.80, "discharge_m3s": 1450.0, "rainfall_mm": 95.0},
    "waspada": {"water_level_m": 0.50, "discharge_m3s": 1100.0, "rainfall_mm": 60.0},
    "aman": {"water_level_m": 0.20, "discharge_m3s": 650.0, "rainfall_mm": 20.0},
}


class SatuDataBojonegoroService:
    """Service klien untuk mengunduh dan menyinkronkan data dari portal Satu Data Bojonegoro."""

    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE

    def _create_session_opener(self) -> urllib.request.OpenerDirector:
        """Membuat HTTP Opener dengan dukungan cookie session (ci_sessions)."""
        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=self.ctx),
            urllib.request.HTTPCookieProcessor(cj),
        )
        return opener

    def _get_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36 SIGAB-Baureno-Agent/1.0"
            ),
            "Referer": PAGE_URL,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        }

    def check_connection(self) -> Dict[str, Any]:
        """Uji konektivitas ke portal Satu Data Bojonegoro."""
        start_time = datetime.now()
        try:
            req = urllib.request.Request(PAGE_URL, headers=self._get_headers())
            with urllib.request.urlopen(req, context=self.ctx, timeout=self.timeout) as resp:
                elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                status_code = resp.status
                return {
                    "reachable": status_code == 200,
                    "status_code": status_code,
                    "latency_ms": elapsed_ms,
                    "portal_url": PAGE_URL,
                    "kecamatan": "Baureno",
                    "bencana_filters": [b[1] for b in TARGET_BENCANA],
                }
        except Exception as exc:
            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            return {
                "reachable": False,
                "status_code": None,
                "latency_ms": elapsed_ms,
                "error": str(exc),
                "portal_url": PAGE_URL,
            }

    def fetch_all_baureno_flood_incidents(self) -> List[Dict[str, Any]]:
        """
        Mengambil semua data kejadian banjir Baureno dari Satu Data Bojonegoro.
        Melakukan filter untuk:
        - Kecamatan: Baureno
        - Bencana: Banjir Bengawan Solo & Banjir Luapan Sungai
        - Tahun: Semua Tahun
        """
        opener = self._create_session_opener()
        headers = self._get_headers()

        # 1. Inisialisasi sesi dengan mengunjungi halaman utama portal
        init_req = urllib.request.Request(PAGE_URL, headers=headers)
        opener.open(init_req, timeout=self.timeout)

        # 2. Set Session Kecamatan Baureno (352210)
        kec_req = urllib.request.Request(
            f"{SET_SESSION_URL}/sel_kecamatan/{KECAMATAN_BAURENO_CODE}",
            headers=headers,
        )
        opener.open(kec_req, timeout=self.timeout)

        # 3. Set Session Tahun Semua (0)
        thn_req = urllib.request.Request(
            f"{SET_SESSION_URL}/sel_tahun/0",
            headers=headers,
        )
        opener.open(thn_req, timeout=self.timeout)

        # 4. Set Session Desa Semua (0)
        desa_req = urllib.request.Request(
            f"{SET_SESSION_URL}/sel_desa/0",
            headers=headers,
        )
        opener.open(desa_req, timeout=self.timeout)

        all_incidents: List[Dict[str, Any]] = []

        # 5. Iterasi untuk setiap kategori bencana banjir yang ditargetkan
        for b_id, b_name in TARGET_BENCANA:
            try:
                # Set Session Bencana
                benc_req = urllib.request.Request(
                    f"{SET_SESSION_URL}/sel_bencana/{b_id}",
                    headers=headers,
                )
                opener.open(benc_req, timeout=self.timeout)

                # Ambil data tabel via DataTables API
                tbl_req = urllib.request.Request(
                    f"{GET_TABLE_DATA_URL}?draw=1&start=0&length=200",
                    headers=headers,
                )
                with opener.open(tbl_req, timeout=self.timeout) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    rows = resp_data.get("data", [])

                for r in rows:
                    detail_btn = r.get("detail", "")
                    detail_match = re.search(r"detailKejadian\((\d+)\)", detail_btn)
                    detail_id = detail_match.group(1) if detail_match else None

                    # Ambil data spesifik per kejadian
                    item = {
                        "tahun": str(r.get("tahun") or "").strip(),
                        "tgl_kejadian": str(r.get("tgl_kejadian") or "").strip(),
                        "bhy_nama": str(r.get("bhy_nama") or b_name).strip(),
                        "kecamatan": str(r.get("kecamatan") or "Baureno").strip(),
                        "nama_desa": str(r.get("nama_desa") or "").strip(),
                        "taksiran_kerugian": str(r.get("taksiran_kerugian") or "0").strip(),
                        "detail_id": detail_id,
                        # Detail fields default
                        "korban": "0 Jiwa",
                        "rumah": 0,
                        "lahan_ha": 0.0,
                        "kerugian_rp": 0,
                        "keterangan": "",
                        "raw_tanggal": None,
                    }

                    # Fetch detail popup data jika ada detail_id
                    if detail_id:
                        try:
                            det_payload = urllib.parse.urlencode({"id": detail_id}).encode("utf-8")
                            det_req = urllib.request.Request(
                                DETAIL_URL,
                                data=det_payload,
                                headers=headers,
                            )
                            with opener.open(det_req, timeout=self.timeout) as d_resp:
                                det_json = json.loads(d_resp.read().decode("utf-8"))
                                if isinstance(det_json, list) and len(det_json) > 0:
                                    det_row = det_json[0]
                                    item["korban"] = f"{det_row.get('kjd_korban', '0')} Jiwa"
                                    
                                    # Parse rumah
                                    rumah_raw = det_row.get("kjd_rumah") or 0
                                    try:
                                        item["rumah"] = int(rumah_raw)
                                    except (ValueError, TypeError):
                                        item["rumah"] = 0
                                    
                                    # Parse lahan
                                    lahan_raw = det_row.get("kjd_lahan") or 0
                                    try:
                                        item["lahan_ha"] = float(str(lahan_raw).replace(",", "."))
                                    except (ValueError, TypeError):
                                        item["lahan_ha"] = 0.0
                                    
                                    # Parse kerugian
                                    kerugian_raw = det_row.get("kjd_kerugian") or 0
                                    try:
                                        item["kerugian_rp"] = int(float(str(kerugian_raw).replace(",", "")))
                                    except (ValueError, TypeError):
                                        item["kerugian_rp"] = 0

                                    item["keterangan"] = str(det_row.get("kjd_keterangan") or "").strip()
                                    item["raw_tanggal"] = det_row.get("kjd_tanggal")
                        except Exception as det_err:
                            logger.warning(f"Gagal mengambil detail kejadian ID {detail_id}: {det_err}")

                    all_incidents.append(item)

            except Exception as b_err:
                logger.error(f"Gagal mengambil data bencana ID {b_id} ({b_name}): {b_err}")

        return all_incidents

    def _normalize_village_name(self, name: str) -> str:
        """Membersihkan nama desa untuk pencocokan yang akurat."""
        n = name.lower()
        n = re.sub(r"^(desa|kelurahan)\s+", "", n).strip()
        # Normalisasi variasi ejaan
        if n == "kadungrejo":
            return "kedungrejo"
        if n == "tulung agung":
            return "tulungagung"
        if n == "karang dayu":
            return "karangdayu"
        if n == "lebak sari":
            return "lebaksari"
        if n == "sembung lor":
            return "sembunglor"
        return n

    def _match_village(self, village_name: str, villages_map: Dict[str, Village]) -> Optional[Village]:
        """Mencocokkan nama desa dari Satu Data dengan entitas desa di database SIGAB."""
        norm = self._normalize_village_name(village_name)
        return villages_map.get(norm)

    def _parse_event_datetime(self, tgl_str: str, raw_tgl: Optional[str] = None) -> datetime:
        """
        Mengonversi format tanggal DD-MM-YYYY atau YYYY-MM-DD ke objek datetime Python.
        """
        # Prioritaskan raw_tgl (YYYY-MM-DD) jika ada
        if raw_tgl and re.match(r"^\d{4}-\d{2}-\d{2}", str(raw_tgl)):
            try:
                date_part = str(raw_tgl)[:10]
                return datetime.strptime(date_part, "%Y-%m-%d").replace(hour=8, minute=0, second=0)
            except Exception:
                pass

        # Coba format DD-MM-YYYY
        if tgl_str:
            clean_tgl = tgl_str.strip()
            for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
                try:
                    return datetime.strptime(clean_tgl, fmt).replace(hour=8, minute=0, second=0)
                except Exception:
                    pass

        return datetime.now().replace(hour=8, minute=0, second=0)

    def _determine_category_and_metrics(self, item: Dict[str, Any]) -> Tuple[str, float, float, float, int, int]:
        """
        Menentukan kategori kewaspadaan (awas, siaga, waspada, aman) serta
        metrik hidrologis (TMA, debit, curah hujan, warga terdampak, pengungsi).
        """
        rumah = item.get("rumah", 0)
        lahan = item.get("lahan_ha", 0.0)
        ket = item.get("keterangan", "").lower()

        # Ekstraksi informasi dari teks keterangan jika ada
        evacuated = 0
        affected_people = 0

        # Cek jumlah KK di keterangan
        kk_matches = re.findall(r"(\d+)\s*(?:kk|jiwa|warga)", ket)
        if kk_matches:
            try:
                found_count = int(kk_matches[0])
                affected_people = found_count * 4
            except ValueError:
                pass

        if not affected_people and rumah > 0:
            affected_people = rumah * 4

        # Cek indikasi evakuasi / terisolir
        if "evakuasi" in ket or "terisolir" in ket or "mengungsi" in ket:
            evacuated = max(evacuated, min(affected_people, max(15, rumah * 2)))

        # Tentukan status risiko
        if rumah >= 100 or lahan >= 80 or "darurat" in ket or "terisolir" in ket or rumah >= 50:
            category = "awas"
            evacuated = max(evacuated, int(rumah * 0.5) if rumah > 0 else 25)
        elif rumah >= 10 or lahan >= 10:
            category = "siaga"
            evacuated = max(evacuated, int(rumah * 0.2) if rumah > 0 else 10)
        else:
            category = "waspada"

        defaults = DEFAULT_HYDRO_METRICS.get(category, DEFAULT_HYDRO_METRICS["waspada"])
        water_level = defaults["water_level_m"]
        discharge = defaults["discharge_m3s"]
        rainfall = defaults["rainfall_mm"]

        # Cek jika ada ketinggian air di keterangan (misal "50 cm", "± 1 m", "20–30 cm")
        cm_match = re.search(r"(\d+)\s*(?:–|-)?\s*(\d+)?\s*cm", ket)
        m_match = re.search(r"(\d+(?:\.\d+)?)\s*m\b", ket)
        if cm_match:
            try:
                cm_val = float(cm_match.group(2) or cm_match.group(1))
                water_level = round(cm_val / 100.0, 2)
            except Exception:
                pass
        elif m_match:
            try:
                water_level = float(m_match.group(1))
            except Exception:
                pass

        return category, water_level, discharge, rainfall, evacuated, affected_people

    def sync_to_database(self, db: Session) -> Dict[str, Any]:
        """
        Menyinkronkan data kejadian banjir dari Satu Data Bojonegoro ke database SIGAB.
        Operasi bersifat idempoten:
        - Jika kejadian sudah ada (cocok desa & tanggal), deskripsi diperbarui jika ada data baru.
        - Jika belum ada, entitas baru dibuat.
        - Menyinkronkan dan memperbarui berkas rekap_banjir_baureno.csv.
        """
        remote_data = self.fetch_all_baureno_flood_incidents()
        if not remote_data:
            return {
                "success": False,
                "message": "Tidak ada data yang ditemukan dari Satu Data Bojonegoro.",
                "total_fetched": 0,
                "new_added": 0,
                "updated": 0,
            }

        # Buat pemetaan nama desa di database
        all_villages = db.query(Village).all()
        villages_map: Dict[str, Village] = {}
        for v in all_villages:
            norm_name = self._normalize_village_name(v.name)
            villages_map[norm_name] = v

        new_count = 0
        updated_count = 0
        processed_records: List[Dict[str, Any]] = []

        for item in remote_data:
            desa_raw = item.get("nama_desa", "")
            village = self._match_village(desa_raw, villages_map)
            village_id = village.id if village else None
            village_name = village.name if village else desa_raw

            event_dt = self._parse_event_datetime(
                item.get("tgl_kejadian", ""),
                item.get("raw_tanggal")
            )

            bencana_nama = item.get("bhy_nama", "Banjir Luapan Sungai")
            title = f"{bencana_nama}: Luapan {village_name.replace('Desa ', '')}"

            cat, tma, debit, hujan, evakuasi, terdampak = self._determine_category_and_metrics(item)

            desc = item.get("keterangan", "").strip()
            if not desc:
                desc = (
                    f"Kejadian {bencana_nama} di {village_name}, Kec. Baureno. "
                    f"Rumah terdampak: {item.get('rumah', 0)} unit, "
                    f"lahan terdampak: {item.get('lahan_ha', 0)} Ha."
                )

            # Cek apakah kejadian sudah ada di DB berdasarkan desa dan tanggal
            existing = None
            if village_id:
                existing = db.query(FloodIncident).filter(
                    FloodIncident.village_id == village_id,
                    func.date(FloodIncident.event_date) == event_dt.date()
                ).first()
            else:
                existing = db.query(FloodIncident).filter(
                    FloodIncident.affected_villages.ilike(f"%{desa_raw}%"),
                    func.date(FloodIncident.event_date) == event_dt.date()
                ).first()

            if existing:
                # Perbarui informasi deskripsi jika kosong atau bertambah lengkap
                has_changed = False
                if not existing.description or len(desc) > len(existing.description or ""):
                    existing.description = desc
                    has_changed = True
                if (existing.affected_people_count or 0) < terdampak:
                    existing.affected_people_count = terdampak
                    has_changed = True
                if has_changed:
                    updated_count += 1
                
                processed_records.append({
                    "id": existing.id,
                    "title": existing.title,
                    "village": village_name,
                    "date": event_dt.strftime("%d-%m-%Y"),
                    "status": "sudah_ada",
                    "category": existing.category,
                })
            else:
                # Buat entitas baru
                shelters = 2 if cat == "awas" else (1 if cat == "siaga" else 0)
                new_incident = FloodIncident(
                    title=title,
                    description=desc,
                    category=cat,
                    village_id=village_id,
                    affected_villages=village_name,
                    water_level_m=tma,
                    discharge_m3s=debit,
                    rainfall_mm=hujan,
                    evacuated_count=evakuasi,
                    affected_people_count=terdampak,
                    shelter_count=shelters,
                    event_date=event_dt,
                    status="selesai",
                    is_archived=True,
                )
                db.add(new_incident)
                db.flush()
                new_count += 1

                processed_records.append({
                    "id": new_incident.id,
                    "title": new_incident.title,
                    "village": village_name,
                    "date": event_dt.strftime("%d-%m-%Y"),
                    "status": "baru_ditambahkan",
                    "category": cat,
                })

        db.commit()

        # Sinkronkan kembali CSV lokal agar selalu selaras dengan DB & Satu Data
        try:
            self._update_csv_from_db(db)
        except Exception as csv_err:
            logger.warning(f"Gagal memperbarui CSV rekap lokal: {csv_err}")

        total_in_db = db.query(FloodIncident).count()

        return {
            "success": True,
            "message": (
                f"Sinkronisasi Satu Data Bojonegoro berhasil! "
                f"Ditemukan {len(remote_data)} data BPBD Baureno ({new_count} data baru, {updated_count} diperbarui). "
                f"Total kejadian banjir aktif: {total_in_db}."
            ),
            "total_fetched": len(remote_data),
            "new_added": new_count,
            "updated": updated_count,
            "total_in_db": total_in_db,
            "records": processed_records,
        }

    def _update_csv_from_db(self, db: Session) -> None:
        """Membuat/memperbarui rekap_banjir_baureno.csv dari tabel flood_incidents."""
        incidents = db.query(FloodIncident).order_by(FloodIncident.event_date.desc()).all()
        
        headers = [
            "No", "Tahun", "Tanggal", "Jenis Bencana", "Kecamatan",
            "Desa", "Korban", "Rumah Terdampak", "Lahan Terdampak",
            "Kerugian", "Keterangan Dampak"
        ]

        rows = []
        for idx, inc in enumerate(incidents, start=1):
            v_name = inc.village.name if inc.village else (inc.affected_villages or "Baureno")
            clean_v = v_name.replace("Desa ", "").strip()
            
            bencana_nama = "Banjir Bengawan Solo (Luapan Sungai)"
            if inc.title and "luapan sungai / genangan" in inc.title.lower():
                bencana_nama = "Banjir Luapan Sungai / Genangan"

            tgl_formatted = inc.event_date.strftime("%d-%m-%Y") if inc.event_date else "-"
            thn = str(inc.event_date.year) if inc.event_date else "-"
            
            rows.append([
                idx,
                thn,
                tgl_formatted,
                bencana_nama,
                "Baureno",
                clean_v,
                f"{inc.evacuated_count or 0} Jiwa",
                f"{int((inc.affected_people_count or 0) / 4) if (inc.affected_people_count or 0) > 0 else 0} Rumah",
                "0.00 Ha",
                "Rp. 0",
                inc.description or "",
            ])

        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)


# Singleton instance
satu_data_service = SatuDataBojonegoroService()

