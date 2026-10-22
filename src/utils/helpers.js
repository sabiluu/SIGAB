/**
 * Utility / helper functions untuk frontend.
 */

/**
 * Format tanggal ke format Indonesia.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Format tanggal & jam ke format Indonesia resmi (WIB).
 * Contoh: "22 Okt 2026 • 09:24 WIB"
 * @param {string|Date} date
 * @param {boolean} withSeconds
 * @returns {string}
 */
export function formatWIBDateTime(date, withSeconds = false) {
  if (!date) return '-';
  try {
    const normalized = typeof date === 'string' && date.includes(' ') && !date.includes('T') 
      ? date.replace(' ', 'T') 
      : date;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return String(date);

    const datePart = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    if (withSeconds) timeOptions.second = '2-digit';
    const timePart = d.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':');

    return `${datePart} • ${timePart} WIB`;
  } catch {
    return String(date);
  }
}

/**
 * Format jam ke format WIB (contoh: "09:24 WIB")
 * @param {string|Date} date
 * @param {boolean} withSeconds
 * @returns {string}
 */
export function formatWIBTime(date, withSeconds = false) {
  if (!date) return '-';
  try {
    const normalized = typeof date === 'string' && date.includes(' ') && !date.includes('T') 
      ? date.replace(' ', 'T') 
      : date;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return String(date);

    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    if (withSeconds) timeOptions.second = '2-digit';
    return `${d.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':')} WIB`;
  } catch {
    return String(date);
  }
}

/**
 * Warna indikator berdasarkan level risiko.
 * @param {string} level - Aman | Waspada | Siaga | Awas
 * @returns {string} hex color
 */
export function getRiskColor(level) {
  const colors = {
    Aman: '#22c55e',
    Waspada: '#eab308',
    Siaga: '#f97316',
    Awas: '#ef4444',
  };
  return colors[level] || '#6b7280';
}

/**
 * Konversi skor probabilitas ke label risiko.
 * @param {number} score - 0–100
 * @returns {string}
 */
export function getRiskLabel(score) {
  if (score >= 75) return 'Awas';
  if (score >= 50) return 'Siaga';
  if (score >= 25) return 'Waspada';
  return 'Aman';
}

/**
 * Format jarak dari meter ke km.
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
