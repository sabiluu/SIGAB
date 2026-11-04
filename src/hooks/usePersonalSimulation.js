import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PERSONAL_SIM_PHASES,
  loadUserSimState,
  saveUserSimState,
  buildSimStatusObject,
} from '../utils/personalSimulation';

export default function usePersonalSimulation(userId) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Load initial state for this user from localStorage
  useEffect(() => {
    if (!userId) return;
    const saved = loadUserSimState(userId);
    if (saved && saved.isRunning) {
      const now = Date.now();
      const elapsedSec = Math.floor((now - (saved.lastUpdated || now)) / 1000);
      let pIdx = saved.phaseIndex || 0;
      let rem = (saved.remainingSec != null ? saved.remainingSec : PERSONAL_SIM_PHASES[pIdx].duration) - elapsedSec;

      // Handle phases that might have passed while tab was closed/inactive
      while (rem <= 0 && pIdx < PERSONAL_SIM_PHASES.length - 1) {
        pIdx += 1;
        rem += PERSONAL_SIM_PHASES[pIdx].duration;
      }

      if (pIdx >= PERSONAL_SIM_PHASES.length - 1 && rem <= 0) {
        // Simulation finished
        setIsRunning(false);
        saveUserSimState(userId, null);
      } else {
        setPhaseIndex(pIdx);
        setRemainingSec(Math.max(1, rem));
        setIsRunning(true);
      }
    } else {
      setIsRunning(false);
    }
  }, [userId]);

  // Main countdown timer
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRemainingSec((prevRem) => {
        if (prevRem <= 1) {
          // Advance phase
          setPhaseIndex((prevPIdx) => {
            if (prevPIdx < PERSONAL_SIM_PHASES.length - 1) {
              const nextIdx = prevPIdx + 1;
              const nextDuration = PERSONAL_SIM_PHASES[nextIdx].duration;
              saveUserSimState(userId, {
                isRunning: true,
                phaseIndex: nextIdx,
                remainingSec: nextDuration,
                lastUpdated: Date.now(),
              });
              return nextIdx;
            } else {
              // Finished all 7 phases
              setIsRunning(false);
              saveUserSimState(userId, null);
              return 0;
            }
          });
          const nextIdx = Math.min(phaseIndex + 1, PERSONAL_SIM_PHASES.length - 1);
          return PERSONAL_SIM_PHASES[nextIdx].duration;
        }

        const newRem = prevRem - 1;
        // Save progress periodically
        if (newRem % 5 === 0) {
          saveUserSimState(userId, {
            isRunning: true,
            phaseIndex,
            remainingSec: newRem,
            lastUpdated: Date.now(),
          });
        }
        return newRem;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phaseIndex, userId]);

  const startSimulation = useCallback((initialPhaseIndex = 0) => {
    const idx = Math.max(0, Math.min(initialPhaseIndex, PERSONAL_SIM_PHASES.length - 1));
    const duration = PERSONAL_SIM_PHASES[idx].duration;
    setPhaseIndex(idx);
    setRemainingSec(duration);
    setIsRunning(true);
    saveUserSimState(userId, {
      isRunning: true,
      phaseIndex: idx,
      remainingSec: duration,
      lastUpdated: Date.now(),
    });
  }, [userId]);

  const stopSimulation = useCallback(() => {
    setIsRunning(false);
    setPhaseIndex(0);
    setRemainingSec(0);
    saveUserSimState(userId, null);
  }, [userId]);

  const jumpToPhase = useCallback((targetPhaseIndex) => {
    startSimulation(targetPhaseIndex);
  }, [startSimulation]);

  const simStatus = buildSimStatusObject(phaseIndex, remainingSec, isRunning);
  const isEmergency = isRunning && Boolean(simStatus.is_emergency);

  return {
    simStatus,
    isRunning,
    isEmergency,
    startSimulation,
    stopSimulation,
    jumpToPhase,
  };
}

