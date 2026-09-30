import { apiFetch } from './api';

/**
 * Login menggunakan OAuth2 form data (sesuai backend FastAPI OAuth2PasswordRequestForm).
 */
export async function login(email, password, role) {
  // Backend menggunakan OAuth2PasswordRequestForm yang menerima form-urlencoded,
  // field-nya "username" dan "password"
  const formBody = new URLSearchParams();
  formBody.append('username', email);
  formBody.append('password', password);

  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  localStorage.setItem('access_token', response.access_token);

  // Ambil profile user setelah login untuk mendapatkan data role
  const profile = await getProfile();
  return {
    ...response,
    user: profile,
  };
}

/**
 * Register user baru.
 * Menyesuaikan field names dengan backend schema UserCreate:
 *   full_name, email, phone, password, role, village_id, avatar_url
 */
export async function register(data) {
  // Map role frontend ('warga'/'petugas') ke backend ('user'/'admin')
  const backendRole = data.role === 'petugas' ? 'admin' : 'user';

  const response = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: data.name,
      email: data.email,
      phone: data.phone || '0800000000',
      password: data.password,
      role: backendRole,
      village_id: null,
      avatar_url: null,
    }),
  });

  // Setelah register berhasil, login otomatis untuk mendapatkan token
  const loginResult = await login(data.email, data.password, data.role);
  return loginResult;
}

export function logout() {
  localStorage.removeItem('access_token');
  window.location.hash = '';
}

/**
 * Mendapatkan profile user yang sedang login.
 */
export async function getProfile() {
  return await apiFetch('/auth/me', {
    method: 'GET',
  });
}
