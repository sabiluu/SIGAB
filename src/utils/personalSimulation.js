// src/utils/personalSimulation.js
// Logika simulasi banjir per-akun warga (Client-side Per-User Simulation)

export const PERSONAL_SIM_PHASES = [
  {
    phase: 1,
    name: 'AMAN',
    risk_level: 'rendah',
    probability: 12,
    duration: 30, // 30 detik menuju WASPADA
    discharge_m3s: 850,
    rainfall_mm: 5,
    themeColor: '#10b981',
    icon: '🟢',
    description: 'Fase 1/7: AMAN (30 detik) — Cuaca berawan, debit sungai normal menuju WASPADA.',
    isEmergency: false,
  },
  {
    phase: 2,
    name: 'WASPADA',
    risk_level: 'sedang',
    probability: 38,
    duration: 30, // 30 detik menuju SIAGA
    discharge_m3s: 1200,
    rainfall_mm: 25,
    themeColor: '#f59e0b',
    icon: '🟡',
    description: 'Fase 2/7: WASPADA (30 detik) — Hujan sedang merata, TMA sungai naik menuju status SIAGA.',
    isEmergency: false,
  },
  {
    phase: 3,
    name: 'SIAGA',
    risk_level: 'tinggi',
    probability: 68,
    duration: 30, // 30 detik menuju AWAS
    discharge_m3s: 1550,
    rainfall_mm: 55,
    themeColor: '#f97316',
    icon: '🟠',
    description: 'Fase 3/7: SIAGA (30 detik) — Debit sungai mendekati bibir tanggul, menuju status AWAS.',
    isEmergency: false,
  },
  {
    phase: 4,
    name: 'AWAS',
    risk_level: 'awas',
    probability: 94,
    duration: 600, // 10 menit (Awas menuju Siaga)
    discharge_m3s: 2100,
    rainfall_mm: 120,
    themeColor: '#ef4444',
    icon: '🚨',
    description: 'Fase 4/7: AWAS (10 Menit) — Status darurat banjir aktif menuju Siaga Menurun. Warga dapat mengajukan tiket SOS.',
    isEmergency: true,
  },
  {
    phase: 5,
    name: 'SIAGA Menurun',
    risk_level: 'tinggi',
    probability: 60,
    duration: 30, // 30 detik menuju Waspada
    discharge_m3s: 1450,
    rainfall_mm: 35,
    themeColor: '#f97316',
    icon: '🟠',
    description: 'Fase 5/7: SIAGA Menurun (30 detik) — Hujan reda, air berangsur stabil menuju WASPADA.',
    isEmergency: false,
  },
  {
    phase: 6,
    name: 'WASPADA Menurun',
    risk_level: 'sedang',
    probability: 30,
    duration: 30, // 30 detik menuju Aman
    discharge_m3s: 1100,
    rainfall_mm: 15,
    themeColor: '#f59e0b',
    icon: '🟡',
    description: 'Fase 6/7: WASPADA Menurun (30 detik) — Air berangsur surut ke saluran utama menuju AMAN.',
    isEmergency: false,
  },
  {
    phase: 7,
    name: 'AMAN Normal',
    risk_level: 'rendah',
    probability: 10,
    duration: 30, // 30 detik kembali normal
    discharge_m3s: 820,
    rainfall_mm: 2,
    themeColor: '#10b981',
    icon: '🟢',
    description: 'Fase 7/7: AMAN Normal (30 detik) — Situasi telah aman dan terkendali sepenuhnya.',
    isEmergency: false,
  },
];

const STORAGE_PREFIX = 'sigab_user_sim_state_';

export function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

export function loadUserSimState(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.isRunning) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function saveUserSimState(userId, state) {
  try {
    const key = getStorageKey(userId);
    if (!state || !state.isRunning) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(state));
    }
  } catch (e) {}
}

export function buildSimStatusObject(phaseIndex, remainingSec, isRunning = true) {
  const currentPhaseObj = PERSONAL_SIM_PHASES[phaseIndex] || PERSONAL_SIM_PHASES[0];
  return {
    is_running: isRunning,
    current_phase: currentPhaseObj.phase,
    total_phases: PERSONAL_SIM_PHASES.length,
    phase_name: currentPhaseObj.name,
    risk_level: currentPhaseObj.risk_level,
    probability: currentPhaseObj.probability,
    remaining_seconds: Math.max(0, remainingSec),
    discharge_m3s: currentPhaseObj.discharge_m3s,
    rainfall_mm: currentPhaseObj.rainfall_mm,
    description: currentPhaseObj.description,
    theme_color: currentPhaseObj.themeColor,
    is_emergency: currentPhaseObj.isEmergency,
    icon: currentPhaseObj.icon,
  };
}
