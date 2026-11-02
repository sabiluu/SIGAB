"""
Service: Flood Simulation — simulasi skenario banjir bertahap untuk demo & pelatihan.

Skenario simulasi:
  Fase 1: AMAN    (rendah)  — 30 detik   → probabilitas ~10%
  Fase 2: WASPADA (sedang)  — 30 detik   → probabilitas ~35%
  Fase 3: SIAGA   (tinggi)  — 30 detik   → probabilitas ~65%
  Fase 4: AWAS    (awas)    — 10 menit   → probabilitas ~92% (Mode Evakuasi Darurat Aktif)
  Fase 5: SIAGA   (tinggi)  — 30 detik   → probabilitas ~60%
  Fase 6: WASPADA (sedang)  — 30 detik   → probabilitas ~30%
  Fase 7: AMAN    (rendah)  — 30 detik   → probabilitas ~8% (Kondisi pulih & normal)

Desa target:
  - Desa Kedungrejo (ID: 12)
  - Desa Kalisari (ID: 9)
  - Desa Lebaksari (ID: 13)
  - Desa Tanggungan (ID: 22)
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from ..models.village import Village
from ..models.flood_probability_log import FloodProbabilityLog
from ..models.weather_data_log import WeatherDataLog
from ..models.river_discharge_log import RiverDischargeLog
from ..models.emergency_status import EmergencyStatus
from .notifier import broadcast_flood_alert, create_emergency_notifications, broadcast_emergency_status
from .ws_manager import ws_manager
from .dashboard_builder import build_dashboard_snapshot

logger = logging.getLogger("sigab.simulation")

# Konfigurasi desa target simulasi (berdasarkan id tabel villages)
TARGET_VILLAGE_IDS = [12, 9, 13, 22]
TARGET_VILLAGE_NAMES = ["Kedungrejo", "Kalisari", "Lebaksari", "Tanggungan"]

# Skenario fase simulasi
SIMULATION_PHASES = [
    {
        "name": "AMAN",
        "risk_level": "rendah",
        "probability": 10.0,
        "discharge_m3s": 850.0,
        "rainfall_mm": 5.0,
        "accumulated_6h": 12.0,
        "accumulated_12h": 18.0,
        "temperature_c": 30.0,
        "wind_speed_kmh": 8.0,
        "duration_seconds": 30,  # 30 detik
    },
    {
        "name": "WASPADA",
        "risk_level": "sedang",
        "probability": 35.0,
        "discharge_m3s": 1200.0,
        "rainfall_mm": 25.0,
        "accumulated_6h": 55.0,
        "accumulated_12h": 80.0,
        "temperature_c": 27.0,
        "wind_speed_kmh": 15.0,
        "duration_seconds": 30,  # 30 detik
    },
    {
        "name": "SIAGA",
        "risk_level": "tinggi",
        "probability": 65.0,
        "discharge_m3s": 1550.0,
        "rainfall_mm": 55.0,
        "accumulated_6h": 95.0,
        "accumulated_12h": 140.0,
        "temperature_c": 25.0,
        "wind_speed_kmh": 22.0,
        "duration_seconds": 30,  # 30 detik
    },
    {
        "name": "AWAS",
        "risk_level": "awas",
        "probability": 92.0,
        "discharge_m3s": 2100.0,
        "rainfall_mm": 120.0,
        "accumulated_6h": 180.0,
        "accumulated_12h": 250.0,
        "temperature_c": 23.0,
        "wind_speed_kmh": 35.0,
        "duration_seconds": 600,  # 10 menit
    },
    {
        "name": "SIAGA (Menurun)",
        "risk_level": "tinggi",
        "probability": 60.0,
        "discharge_m3s": 1450.0,
        "rainfall_mm": 40.0,
        "accumulated_6h": 70.0,
        "accumulated_12h": 100.0,
        "temperature_c": 26.0,
        "wind_speed_kmh": 18.0,
        "duration_seconds": 30,  # 30 detik
    },
    {
        "name": "WASPADA (Menurun)",
        "risk_level": "sedang",
        "probability": 30.0,
        "discharge_m3s": 1100.0,
        "rainfall_mm": 15.0,
        "accumulated_6h": 35.0,
        "accumulated_12h": 50.0,
        "temperature_c": 28.0,
        "wind_speed_kmh": 12.0,
        "duration_seconds": 30,  # 30 detik
    },
    {
        "name": "AMAN (Normal)",
        "risk_level": "rendah",
        "probability": 8.0,
        "discharge_m3s": 750.0,
        "rainfall_mm": 3.0,
        "accumulated_6h": 8.0,
        "accumulated_12h": 12.0,
        "temperature_c": 31.0,
        "wind_speed_kmh": 6.0,
        "duration_seconds": 30,  # 30 detik
    },
]


class FloodSimulationManager:
    """Manajer simulasi banjir bertahap dengan lifecycle management & live timer."""

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._current_phase: int = -1
        self._current_phase_name: str = ""
        self._started_at: Optional[datetime] = None
        self._phase_started_at: Optional[datetime] = None
        self._original_village_data: Dict[int, Dict[str, Any]] = {}

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def status(self) -> Dict[str, Any]:
        if not self._is_running or self._current_phase < 0:
            return {
                "is_running": False,
                "current_phase": None,
                "phase_name": None,
                "total_phases": len(SIMULATION_PHASES),
                "risk_level": "rendah",
                "probability": 0,
                "duration_seconds": 0,
                "elapsed_seconds": 0,
                "remaining_seconds": 0,
                "started_at": None,
                "target_villages": TARGET_VILLAGE_IDS,
                "target_village_names": TARGET_VILLAGE_NAMES,
            }

        phase = SIMULATION_PHASES[self._current_phase]
        elapsed = int((datetime.now() - self._phase_started_at).total_seconds()) if self._phase_started_at else 0
        remaining = max(0, phase["duration_seconds"] - elapsed)

        return {
            "is_running": True,
            "current_phase": self._current_phase + 1,
            "phase_name": phase["name"],
            "total_phases": len(SIMULATION_PHASES),
            "risk_level": phase["risk_level"],
            "probability": phase["probability"],
            "discharge_m3s": phase["discharge_m3s"],
            "rainfall_mm": phase["rainfall_mm"],
            "duration_seconds": phase["duration_seconds"],
            "elapsed_seconds": elapsed,
            "remaining_seconds": remaining,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "phase_started_at": self._phase_started_at.isoformat() if self._phase_started_at else None,
            "target_villages": TARGET_VILLAGE_IDS,
            "target_village_names": TARGET_VILLAGE_NAMES,
        }

    def start(self, db_session_factory):
        """Mulai simulasi banjir sebagai background task."""
        if self._is_running:
            return

        self._is_running = True
        self._started_at = datetime.now()
        self._current_phase = -1

        self._task = asyncio.create_task(self._run_simulation(db_session_factory))
        logger.info("[Simulasi] ▶ Simulasi banjir dimulai!")

    async def stop(self, db_session_factory):
        """Hentikan simulasi dan kembalikan data desa ke kondisi real-time."""
        self._is_running = False

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        # Selalu restore village data ke kondisi real-time
        await self._restore_villages(db_session_factory)

        self._task = None
        self._current_phase = -1
        self._current_phase_name = ""
        self._started_at = None
        logger.info("[Simulasi] ⏹ Simulasi banjir dihentikan dan data dikembalikan ke real-time.")

    async def _run_simulation(self, db_session_factory):
        """Jalankan skenario simulasi fase demi fase."""
        try:
            # Simpan data awal desa sebelum dimanipulasi
            db = db_session_factory()
            try:
                self._save_original_data(db)
            finally:
                db.close()

            for phase_idx, phase in enumerate(SIMULATION_PHASES):
                if not self._is_running:
                    break

                self._current_phase = phase_idx
                self._current_phase_name = phase["name"]
                self._phase_started_at = datetime.now()

                logger.info(
                    f"[Simulasi] ═══ Fase {phase_idx + 1}/{len(SIMULATION_PHASES)}: "
                    f"{phase['name']} (risk={phase['risk_level']}, prob={phase['probability']}%) "
                    f"═══ durasi={phase['duration_seconds']}s"
                )

                # Terapkan perubahan ke database dan broadcast
                db = db_session_factory()
                try:
                    await self._apply_phase(db, phase)
                    db.commit()

                    # Broadcast dashboard update agar peta & tabel berubah serentak
                    snapshot = build_dashboard_snapshot(db)
                    await ws_manager.broadcast("dashboard", snapshot)
                finally:
                    db.close()

                # Hitung mundur dan kirim tick status setiap detik ke WebSocket
                duration = phase["duration_seconds"]
                elapsed = 0
                while elapsed < duration and self._is_running:
                    # Broadcast status simulasi ke semua channel (alerts, sos, dashboard, general)
                    await ws_manager.broadcast_all({
                        "type": "simulation_status",
                        "data": self.status,
                    })
                    await asyncio.sleep(1)
                    elapsed += 1

            # Simulasi selesai secara natural
            if self._is_running:
                logger.info("[Simulasi] ✅ Simulasi banjir selesai! Mengembalikan kondisi data.")
                await self._restore_villages(db_session_factory)
                self._is_running = False
                self._current_phase = -1
                self._current_phase_name = ""
                self._started_at = None

        except asyncio.CancelledError:
            logger.info("[Simulasi] Simulasi di-cancel.")
        except Exception as e:
            logger.error(f"[Simulasi] Error saat menjalankan simulasi: {e}")
            self._is_running = False

    def _save_original_data(self, db: Session):
        """Simpan kondisi awal desa target sebelum dimanipulasi simulasi."""
        self._original_village_data.clear()
        for vid in TARGET_VILLAGE_IDS:
            village = db.query(Village).filter(Village.id == vid).first()
            if village:
                self._original_village_data[vid] = {
                    "current_risk_level": village.current_risk_level,
                    "current_probability": float(village.current_probability or 0),
                    "last_calculated_at": village.last_calculated_at,
                }

    async def _restore_villages(self, db_session_factory):
        """Kembalikan data desa dan cuaca ke kondisi real-time aktual."""
        db = db_session_factory()
        try:
            now = datetime.now()

            # 1. Hapus semua log simulasi dari WeatherDataLog dan RiverDischargeLog
            db.query(WeatherDataLog).filter(WeatherDataLog.api_source == "simulation").delete()
            db.query(RiverDischargeLog).filter(RiverDischargeLog.api_source == "simulation").delete()

            # 2. Deaktivasi SEMUA emergency status yang aktif
            active_emergencies = db.query(EmergencyStatus).filter(
                EmergencyStatus.is_emergency_active == True,
            ).all()
            for em in active_emergencies:
                em.is_emergency_active = False
                em.deactivated_at = now
                em.notes = (em.notes or "") + " | Dinonaktifkan (kembali ke real-time)"

                village = db.query(Village).filter(Village.id == em.village_id).first()
                v_name = village.name if village else "Desa"
                await broadcast_emergency_status(
                    village_name=v_name,
                    village_id=em.village_id,
                    is_active=False,
                )

            # 3. Pulihkan nilai desa target ke level normal / aman
            for vid in TARGET_VILLAGE_IDS:
                village = db.query(Village).filter(Village.id == vid).first()
                if village:
                    orig = self._original_village_data.get(vid)
                    if orig and orig["current_risk_level"] not in ["awas", "tinggi"]:
                        village.current_risk_level = orig["current_risk_level"]
                        village.current_probability = orig["current_probability"]
                    else:
                        village.current_risk_level = "rendah"
                        village.current_probability = 15.0
                    village.last_calculated_at = now

                    await broadcast_flood_alert(
                        db=db,
                        village_name=village.name,
                        village_id=village.id,
                        risk_level=village.current_risk_level,
                        probability=village.current_probability,
                    )

            db.commit()

            # 4. Broadcast update dashboard final langsung dari DB yang telah dipulihkan
            snapshot = build_dashboard_snapshot(db)
            await ws_manager.broadcast("dashboard", snapshot)

            # 5. Broadcast status simulasi nonaktif ke semua client seketika
            await ws_manager.broadcast_all({
                "type": "simulation_status",
                "data": {
                    "is_running": False,
                    "phase_name": None,
                    "current_phase": None,
                    "total_phases": len(SIMULATION_PHASES),
                    "risk_level": "rendah",
                    "probability": 0,
                    "discharge_m3s": 0,
                    "rainfall_mm": 0,
                    "duration_seconds": 0,
                    "remaining_seconds": 0,
                    "message": "Simulasi dihentikan. Semua data telah kembali ke real-time.",
                    "target_villages": TARGET_VILLAGE_IDS,
                    "target_village_names": TARGET_VILLAGE_NAMES,
                    "timestamp": datetime.now().isoformat(),
                },
            })

            # 6. Tarik data cuaca & debit LIVE (Open-Meteo & GloFAS) di latar belakang agar response HTTP instan
            async def _bg_live_sync():
                bg_db = db_session_factory()
                try:
                    from .flood_engine import assess_and_update_flood_risks
                    await assess_and_update_flood_risks(bg_db)
                    bg_db.commit()
                    fresh = build_dashboard_snapshot(bg_db)
                    await ws_manager.broadcast("dashboard", fresh)
                    logger.info("[Simulasi] Engine real-time background sync berhasil.")
                except Exception as bg_err:
                    logger.error(f"[Simulasi] Gagal kalkulasi ulang flood engine background: {bg_err}")
                finally:
                    bg_db.close()

            asyncio.create_task(_bg_live_sync())
        finally:
            db.close()

    async def _apply_phase(self, db: Session, phase: Dict[str, Any]):
        """Terapkan satu fase simulasi ke semua desa target."""
        now = datetime.now()

        # 1. Simpan log data cuaca simulasi
        weather_log = WeatherDataLog(
            precipitation_mm=phase["rainfall_mm"],
            accumulated_6h=phase["accumulated_6h"],
            accumulated_12h=phase["accumulated_12h"],
            temperature_c=phase["temperature_c"],
            wind_speed_kmh=phase["wind_speed_kmh"],
            api_source="simulation",
            latitude=-7.1282,
            longitude=112.1039,
            recorded_at=now,
        )
        db.add(weather_log)

        # 2. Simpan log data debit sungai simulasi
        discharge_log = RiverDischargeLog(
            discharge_m3s=phase["discharge_m3s"],
            forecast_1d=phase["discharge_m3s"] * 1.05,
            forecast_3d=phase["discharge_m3s"] * 0.95,
            forecast_7d=phase["discharge_m3s"] * 0.85,
            api_source="simulation",
            latitude=-7.1200,
            longitude=112.0800,
            recorded_at=now,
        )
        db.add(discharge_log)
        db.flush()

        # 3. Update setiap desa target
        for vid in TARGET_VILLAGE_IDS:
            village = db.query(Village).filter(Village.id == vid).first()
            if not village:
                continue

            old_risk = village.current_risk_level or "rendah"
            new_risk = phase["risk_level"]
            new_prob = phase["probability"]

            # Update entitas desa
            village.current_risk_level = new_risk
            village.current_probability = new_prob
            village.last_calculated_at = now

            # Simpan flood probability log
            log_entry = FloodProbabilityLog(
                village_id=vid,
                probability_score=new_prob,
                discharge_score=min(100.0, (phase["discharge_m3s"] / 1500.0) * 100.0),
                rainfall_score=min(100.0, (phase["rainfall_mm"] / 25.0) * 50.0 + (phase["accumulated_6h"] / 75.0) * 50.0),
                elevation_score=float(village.elevation_index or 0) * 3.0,
                history_score=float(village.history_score or 0),
                risk_level=new_risk,
                discharge_raw=phase["discharge_m3s"],
                rainfall_raw=phase["rainfall_mm"],
                calculated_at=now,
            )
            db.add(log_entry)

            # Broadcast perubahan risk level jika berubah
            if old_risk != new_risk:
                await broadcast_flood_alert(
                    db=db,
                    village_name=village.name,
                    village_id=village.id,
                    risk_level=new_risk,
                    probability=new_prob,
                )

                # Emergency status handling
                active_emergency = db.query(EmergencyStatus).filter(
                    EmergencyStatus.village_id == vid,
                    EmergencyStatus.is_emergency_active == True,
                ).first()

                if new_risk == "awas" and not active_emergency:
                    # Aktifkan emergency otomatis
                    emergency = EmergencyStatus(
                        village_id=vid,
                        is_emergency_active=True,
                        trigger_type="simulation",
                        probability_at_trigger=new_prob,
                        notes=f"[SIMULASI] Diaktifkan otomatis — Fase {phase['name']}",
                    )
                    db.add(emergency)
                    db.flush()

                    create_emergency_notifications(
                        db=db,
                        village_id=village.id,
                        village_name=village.name,
                        probability=new_prob,
                        is_active=True,
                        trigger_name="Simulasi Banjir",
                    )

                    await broadcast_emergency_status(
                        village_name=village.name,
                        village_id=village.id,
                        is_active=True,
                    )

                elif new_risk in ["rendah", "sedang"] and active_emergency:
                    # Nonaktifkan emergency ketika turun ke sedang/rendah
                    active_emergency.is_emergency_active = False
                    active_emergency.deactivated_at = now
                    active_emergency.notes = (active_emergency.notes or "") + f" | [SIMULASI] Dinonaktifkan — Fase {phase['name']}"

                    create_emergency_notifications(
                        db=db,
                        village_id=village.id,
                        village_name=village.name,
                        probability=new_prob,
                        is_active=False,
                        trigger_name="Simulasi Banjir",
                    )

                    await broadcast_emergency_status(
                        village_name=village.name,
                        village_id=village.id,
                        is_active=False,
                    )


# Singleton instance
simulation_manager = FloodSimulationManager()
