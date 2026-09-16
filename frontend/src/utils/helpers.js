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
