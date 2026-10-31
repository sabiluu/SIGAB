/**
 * Audio Alarm & Sound Notification Utility
 * Menggunakan Web Audio API tanpa ketergantungan file eksternal.
 * Mendukung sirine darurat (dual-tone pulse), notifikasi chime, dan SOS warning beep.
 */

let audioCtx = null;
let sirenInterval = null;
let currentOscillator = null;
let currentGain = null;
let isPlayingSiren = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted() {
  return localStorage.getItem('sigab_audio_muted') === 'true';
}

export function setAudioMuted(muted) {
  localStorage.setItem('sigab_audio_muted', muted ? 'true' : 'false');
  if (muted && isPlayingSiren) {
    stopEmergencyAlarm();
  }
}

export function toggleAudioMute() {
  const next = !isAudioMuted();
  setAudioMuted(next);
  return next;
}

/**
 * Memutar sirine darurat — Dinonaktifkan sesuai kebutuhan pengguna
 */
export function startEmergencyAlarm() {
  // Dinonaktifkan: tidak memutar sirine darurat
  return;
}

/**
 * Menghentikan sirine darurat
 */
export function stopEmergencyAlarm() {
  isPlayingSiren = false;
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

export function isAlarmRunning() {
  return isPlayingSiren;
}

/**
 * Memutar notifikasi chime (2 nada lembut naik)
 */
export function playNotificationChime() {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.24); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

/**
 * Memutar nada peringatan SOS darurat (3 nada tegas)
 */
export function playSosAlertTone() {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    [0, 0.15, 0.3].forEach((offset) => {
      const now = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    });
  } catch (e) {
    console.warn('Audio SOS error:', e);
  }
}
