const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const DEFAULT_TIMEOUT = 8000;

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isLocalhost(url) {
  if (!url) return false;
  return (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('0.0.0.0') ||
    url.includes('::1')
  );
}

function isRemoteClient() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h !== 'localhost' && h !== '127.0.0.1' && h !== '0.0.0.0';
}

export async function apiFetch(endpoint, options = {}) {
  // Jika frontend diakses dari internet/HP (bukan localhost) tapi API_BASE_URL masih localhost:8000:
  // Browser di HP tidak mungkin menjangkau localhost laptop developer dan fetch HTTP akan di-block (mixed content).
  // Langsung tolak tanpa menunggu timeout 8-10 detik agar fallback demo berjalan instan!
  if (isRemoteClient() && isLocalhost(API_BASE_URL)) {
    throw new ApiError('Server backend lokal tidak dapat dihubungi dari perangkat eksternal.', 0);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('access_token');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  const isFormData = options.body instanceof FormData;
  const hasCustomContentType = options.headers && options.headers['Content-Type'];
  const headers = {
    ...(!isFormData && !(options.body instanceof URLSearchParams) && !hasCustomContentType && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        // Jangan auto-logout jika menggunakan demo / mock session offline
        const currentToken = localStorage.getItem('access_token') || '';
        if (!currentToken.startsWith('demo-') && !currentToken.startsWith('sigab-')) {
          localStorage.removeItem('access_token');
          if (typeof window !== 'undefined') {
            const currentHash = (window.location.hash || '').toLowerCase();
            const isAdminRoute = ['#petugas', '#admin', '#portal-petugas', '#portal-admin', '#dashboard-petugas', '#dashboard-admin', '#radar', '#radar-admin', '#sos', '#sos-admin', '#posko', '#posko-admin'].includes(currentHash);
            const isWargaRoute = ['#warga', '#portal', '#portal-warga', '#dashboard-warga'].includes(currentHash);
            if (isAdminRoute) {
              window.location.hash = '#masuk-petugas';
            } else if (isWargaRoute) {
              window.location.hash = '#masuk-warga';
            }
          }
        }
      }
      const message = typeof payload === 'object' ? payload.detail : payload;
      throw new ApiError(message || `HTTP ${response.status}`, response.status);
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('Permintaan terlalu lama. Coba lagi.', 408);
    if (error instanceof ApiError) throw error;
    throw new ApiError('Server tidak dapat dihubungi. Periksa koneksi Anda.', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default API_BASE_URL;

export async function getSimulationStatus() {
  return apiFetch('/simulation/status');
}

export async function startSimulation() {
  return apiFetch('/simulation/start', { method: 'POST', body: JSON.stringify({}), timeout: 30000 });
}

export async function stopSimulation() {
  return apiFetch('/simulation/stop', { method: 'POST', body: JSON.stringify({}), timeout: 30000 });
}
