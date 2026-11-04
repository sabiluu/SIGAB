// src/utils/personalSimulation.js
// Logika simulasi banjir per-akun warga (Client-side Per-User Simulation)

export const PERSONAL_SIM_PHASES = [
  {
    phase: 1,
    name: 'AMAN',
    risk_level: 'rendah',
    probability: 12,
    duration: 30, // detik
    themeColor: '#10b981',
    icon: '🟢',
    description: 'Fase 1/7: Normal/Aman — Cuaca berawan, debit sungai normal.',
    isEmergency: false,
  },
  {
    phase: 2,
    name: 'WASPADA',
    risk_level: 'sedang',
    probability: 38,
    duration: 30,
    themeColor: '#f59e0b',
    icon: '🟡',
    description: 'Fase 2/7: Waspada — Hujan sedang merata, TMA sungai naik.',
    isEmergency: false,
  },
  {
    phase: 3,
    name: 'SIAGA',
    risk_level: 'tinggi',
    probability: 68,
    duration: 30,
    themeColor: '#f97316',
    icon: '🟠',
    description: 'Fase 3/7: Siaga — Hujan lebat intensif, TMA mendekati bibir tanggul.',
    isEmergency: false,
  },
  {
    phase: 4,
    name: 'AWAS',
    risk_level: 'awas',
    probability: 94,
    duration: 600, // 10 menit untuk simulasi darurat & pengajuan SOS
    themeColor: '#ef4444',
    icon: '🚨',
    description: 'Fase 4/7: AWAS (DARURAT) — Tanggul meluap, status darurat aktif! Warga dapat mengajukan tiket SOS.',
    isEmergency: true,
  },
  {
    phase: 5,
    name: 'SIAGA Menurun',
    risk_level: 'tinggi',
    probability: 60,
    duration: 30,
    themeColor: '#f97316',
    icon: '🟠',
    description: 'Fase 5/7: Siaga Menurun — Hujan reda, debit air mulai tertahan.',
    isEmergency: false,
  },
  {
    phase: 6,
    name: 'WASPADA Menurun',
    risk_level: 'sedang',
    probability: 30,
    duration: 30,
    themeColor: '#f59e0b',
    icon: '🟡',
    description: 'Fase 6/7: Waspada Menurun — Air berangsur surut ke saluran utama.',
    isEmergency: false,
  },
  {
    phase: 7,
    name: 'AMAN Normal',
    risk_level: 'rendah',
    probability: 10,
    duration: 30,
    themeColor: '#10b981',
    icon: '🟢',
    description: 'Fase 7/7: Normal Kembali — Situasi telah aman dan terkendali.',
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
    description: currentPhaseObj.description,
    theme_color: currentPhaseObj.themeColor,
    is_emergency: currentPhaseObj.isEmergency,
    icon: currentPhaseObj.icon,
  };
}

