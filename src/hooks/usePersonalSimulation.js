import { useState, useEffect, useCallback } from 'react';
import {
  PERSONAL_SIM_PHASES,
  loadUserSimState,
  saveUserSimState,
  buildSimStatusObject,
} from '../utils/personalSimulation';

export default function usePersonalSimulation(userId) {
  const [simState, setSimState] = useState(() => ({
    isRunning: false,
    phaseIndex: 0,
    remainingSec: 0,
  }));

  // Inisialisasi awal dari localStorage saat userId tersedia
  useEffect(() => {
    if (!userId) return;
    const saved = loadUserSimState(userId);
    if (saved && saved.isRunning) {
      const now = Date.now();
      const elapsedSec = Math.floor((now - (saved.lastUpdated || now)) / 1000);
      let pIdx = saved.phaseIndex || 0;
      let rem = (saved.remainingSec != null ? saved.remainingSec : PERSONAL_SIM_PHASES[pIdx].duration) - elapsedSec;

      // Geser fase jika tab sempat ditutup / offline
      while (rem <= 0 && pIdx < PERSONAL_SIM_PHASES.length - 1) {
        pIdx += 1;
        rem += PERSONAL_SIM_PHASES[pIdx].duration;
      }

      if (pIdx >= PERSONAL_SIM_PHASES.length - 1 && rem <= 0) {
        // Simulasi telah selesai seluruhnya
        saveUserSimState(userId, null);
        setSimState({ isRunning: false, phaseIndex: 0, remainingSec: 0 });
      } else {
        const validState = {
          isRunning: true,
          phaseIndex: pIdx,
          remainingSec: Math.max(1, rem),
        };
        setSimState(validState);
      }
    } else {
      setSimState({ isRunning: false, phaseIndex: 0, remainingSec: 0 });
    }
  }, [userId]);

  // Sinkronisasi realtime lintas komponen & tab browser (Desktop <-> Mobile sync)
  useEffect(() => {
    if (!userId) return;

    const handleSync = (e) => {
      // Jika event berasal dari user lain, abaikan
      if (e?.detail?.userId && e.detail.userId !== userId) return;
      const saved = loadUserSimState(userId);
      if (saved && saved.isRunning) {
        setSimState((prev) => {
          // Jangan timpa jika state sudah identik untuk mencegah rerender berlebih
          if (
            prev.isRunning === saved.isRunning &&
            prev.phaseIndex === saved.phaseIndex &&
            Math.abs((prev.remainingSec || 0) - (saved.remainingSec || 0)) <= 1
          ) {
            return prev;
          }
          return {
            isRunning: true,
            phaseIndex: saved.phaseIndex || 0,
            remainingSec: saved.remainingSec || 0,
          };
        });
      } else {
        setSimState((prev) => (prev.isRunning ? { isRunning: false, phaseIndex: 0, remainingSec: 0 } : prev));
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('sigab_sim_state_changed', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('sigab_sim_state_changed', handleSync);
    };
  }, [userId]);

  // Main countdown timer dengan single atomic state update
  useEffect(() => {
    if (!simState.isRunning) return;

    const interval = setInterval(() => {
      setSimState((prevState) => {
        if (!prevState.isRunning) return prevState;

        // Ketika durasi fase saat ini habis (1 detik terakhir)
        if (prevState.remainingSec <= 1) {
          const nextIdx = prevState.phaseIndex + 1;

          if (nextIdx < PERSONAL_SIM_PHASES.length) {
            // Pindah TEPAT ke 1 fase berikutnya secara berurutan
            const nextDuration = PERSONAL_SIM_PHASES[nextIdx].duration;
            const updated = {
              isRunning: true,
              phaseIndex: nextIdx,
              remainingSec: nextDuration,
              lastUpdated: Date.now(),
            };
            saveUserSimState(userId, updated);
            return updated;
          } else {
            // Seluruh 7 fase telah selesai
            saveUserSimState(userId, null);
            return {
              isRunning: false,
              phaseIndex: 0,
              remainingSec: 0,
            };
          }
        }

        // Hitung mundur detik berjalan
        const newRem = prevState.remainingSec - 1;
        const updated = {
          ...prevState,
          remainingSec: newRem,
          lastUpdated: Date.now(),
        };

        if (newRem % 5 === 0) {
          saveUserSimState(userId, updated);
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simState.isRunning, userId]);

  const startSimulation = useCallback((initialPhaseIndex = 0) => {
    const idx = Math.max(0, Math.min(initialPhaseIndex, PERSONAL_SIM_PHASES.length - 1));
    const duration = PERSONAL_SIM_PHASES[idx].duration;
    const newState = {
      isRunning: true,
      phaseIndex: idx,
      remainingSec: duration,
      lastUpdated: Date.now(),
    };
    setSimState(newState);
    saveUserSimState(userId, newState);
  }, [userId]);

  const stopSimulation = useCallback(() => {
    setSimState({
      isRunning: false,
      phaseIndex: 0,
      remainingSec: 0,
    });
    saveUserSimState(userId, null);
  }, [userId]);

  const simStatus = buildSimStatusObject(simState.phaseIndex, simState.remainingSec, simState.isRunning);
  const isEmergency = simState.isRunning && Boolean(simStatus.is_emergency);

  return {
    simStatus,
    isRunning: simState.isRunning,
    isEmergency,
    startSimulation,
    stopSimulation,
  };
}
