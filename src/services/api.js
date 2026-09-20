const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 10000;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('access_token');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
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
