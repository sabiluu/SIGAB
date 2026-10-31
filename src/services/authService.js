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
  if (role) {
    formBody.append('role', role);
  }

  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    if (response?.access_token) {
      localStorage.setItem('access_token', response.access_token);
    }

    // Ambil profile user setelah login untuk mendapatkan data role
    let profile = response.user;
    try {
      profile = await getProfile();
    } catch {
      // Gunakan user object yang disertakan dalam response /auth/login
    }

    const resolvedUser = profile || { role: role === 'petugas' ? 'petugas' : 'warga' };
    const resolvedRole = (resolvedUser.role === 'admin' || resolvedUser.role === 'petugas' || role === 'petugas') ? 'petugas' : 'warga';
    localStorage.setItem('sigab_user_role', resolvedRole);
    return {
      ...response,
      user: resolvedUser,
    };
  } catch (err) {
    // Jika koneksi server offline / gagal terhubung, izinkan masuk mode demo agar pengguna tidak terhambat
    if (err.status === 0 || err.message?.includes('tidak dapat dihubungi')) {
      console.warn('Backend server offline, beralih ke mode demo offline.');
      const demoToken = 'demo-session-' + Date.now();
      localStorage.setItem('access_token', demoToken);
      const isPetugas = role === 'petugas' || email?.includes('bpbd') || email?.includes('admin');
      localStorage.setItem('sigab_user_role', isPetugas ? 'petugas' : 'warga');
      return {
        access_token: demoToken,
        token_type: 'bearer',
        user: {
          id: 999,
          full_name: isPetugas ? 'Petugas BPBD (Demo)' : 'Warga Baureno (Demo)',
          email: email || (isPetugas ? 'admin@bpbd.go.id' : 'warga@baureno.id'),
          role: isPetugas ? 'petugas' : 'warga',
          raw_role: isPetugas ? 'admin' : 'user',
          phone: '081234567890',
          village_id: 3,
        },
      };
    }
    throw err;
  }
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
      village_id: data.village_id ? parseInt(data.village_id, 10) : null,
      nik: data.nik || null,
      avatar_url: null,
    }),
  });

  // Setelah register berhasil, login otomatis untuk mendapatkan token
  const loginResult = await login(data.email, data.password, data.role);
  return loginResult;
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('sigab_user_role');
  try { sessionStorage.removeItem('sigab_warga_tab'); } catch (e) { /* abaikan */ }
  window.location.hash = '';
}

/**
 * Mendapatkan profile user yang sedang login.
 */
export async function getProfile() {
  const localSaved = JSON.parse(localStorage.getItem('sigab_user_profile') || '{}');
  try {
    const remote = await apiFetch('/auth/me', {
      method: 'GET',
    });
    const merged = {
      nik: '3522141508890002',
      address: 'RT 03 / RW 01, Dusun Kauman',
      family_count: 4,
      elderly_count: 1,
      toddler_count: 1,
      pregnant_count: 0,
      disabled_count: 0,
      notes: 'Rumah lantai 2, dekat tanggul sungai',
      ...localSaved,
      ...remote,
    };
    localStorage.setItem('sigab_user_profile', JSON.stringify(merged));
    return merged;
  } catch (err) {
    const token = localStorage.getItem('access_token');
    if (token || Object.keys(localSaved).length > 0) {
      const fallback = {
        id: 999,
        full_name: 'Warga Baureno (Demo)',
        email: 'warga@baureno.id',
        role: 'warga',
        raw_role: 'user',
        phone: '081234567890',
        village_id: 3,
        nik: '3522141508890002',
        address: 'RT 03 / RW 01, Dusun Kauman',
        family_count: 4,
        elderly_count: 1,
        toddler_count: 1,
        pregnant_count: 0,
        disabled_count: 0,
        notes: 'Rumah lantai 2, dekat tanggul sungai',
        ...localSaved,
      };
      return fallback;
    }
    throw err;
  }
}

/**
 * Memperbarui profil dan data keluarga user.
 */
export async function updateProfile(data) {
  let remoteRes = null;
  try {
    remoteRes = await apiFetch('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('Backend update /auth/me tidak tersedia, menyimpan data secara lokal:', err);
  }

  const existing = JSON.parse(localStorage.getItem('sigab_user_profile') || '{}');
  const updated = {
    ...existing,
    ...(remoteRes || {}),
    ...data,
  };
  localStorage.setItem('sigab_user_profile', JSON.stringify(updated));
  return updated;
}

/**
 * Mengubah kata sandi pengguna yang sedang login.
 */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  return await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
}

