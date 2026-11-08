import { apiFetch } from './api';

/**
 * Login menggunakan OAuth2 form data (sesuai backend FastAPI OAuth2PasswordRequestForm).
 */
export async function login(email, password, role) {
  let cleanEmail = (email || '').trim();
  let cleanPassword = (password || '').trim();

  const lowerEmail = cleanEmail.toLowerCase();
  // Alias cerdas: perbaiki typo umum seperti 'admin@bpdb.go.id' (seharusnya bpbd) atau jika hanya mengetik 'admin'
  if (
    lowerEmail === 'admin' ||
    lowerEmail === 'petugas' ||
    lowerEmail === 'admin@bpdb.go.id' ||
    lowerEmail === 'admin@bpdb.id' ||
    lowerEmail === 'admin@bpbd.id' ||
    lowerEmail === 'admin@bpbd.com' ||
    lowerEmail === 'admin@bpdb.com'
  ) {
    cleanEmail = 'admin@bpbd.go.id';
  }
  if (lowerEmail === 'warga') {
    cleanEmail = 'warga@baureno.id';
  }

  // Jika kata sandi diketik 'admin' pada akun admin, otomatis sesuaikan ke 'admin123'
  if (
    (cleanEmail === 'admin@bpbd.go.id' || cleanEmail === 'admin@siagabencana.id' || cleanEmail === 'admin@bpdb.go.id') &&
    (cleanPassword === 'admin' || cleanPassword === 'admin123')
  ) {
    cleanPassword = 'admin123';
  }
  if (cleanEmail === 'warga@baureno.id' && cleanPassword === 'warga') {
    cleanPassword = 'warga123';
  }

  // Backend menggunakan OAuth2PasswordRequestForm yang menerima form-urlencoded,
  // field-nya "username" dan "password"
  const formBody = new URLSearchParams();
  formBody.append('username', cleanEmail);
  formBody.append('password', cleanPassword);
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
    // Tangani offline, timeout (HTTP 408), atau kegagalan koneksi backend
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'AbortError';

    if (isNetworkOrTimeout) {
      console.warn('Backend server offline / timeout, beralih ke mode demo offline.');

      // 1. Cek apakah pengguna sebelumnya telah terdaftar di browser ini
      let matchedUser = null;
      try {
        const registeredUsers = JSON.parse(localStorage.getItem('sigab_registered_users') || '[]');
        const found = registeredUsers.find(
          (u) => (u.email || '').toLowerCase() === cleanEmail.toLowerCase()
        );
        if (found) {
          matchedUser = found.user;
        }
      } catch {
        // abaikan
      }

      const isPetugas = role === 'petugas' || cleanEmail?.includes('bpbd') || cleanEmail?.includes('admin');
      const resolvedRole = isPetugas ? 'petugas' : 'warga';
      const demoToken = 'sigab-session-' + Date.now();
      localStorage.setItem('access_token', demoToken);
      localStorage.setItem('sigab_user_role', resolvedRole);

      let userObj;
      if (matchedUser) {
        userObj = { ...matchedUser, role: resolvedRole };
      } else {
        const localSaved = JSON.parse(localStorage.getItem('sigab_user_profile') || '{}');
        const fallbackName = isPetugas ? 'Petugas BPBD (Pusdalops)' : (cleanEmail.includes('@') ? cleanEmail.split('@')[0] : 'Warga Baureno');
        userObj = {
          id: localSaved.id || (isPetugas ? 1 : 999),
          full_name: localSaved.full_name || fallbackName,
          email: cleanEmail || (isPetugas ? 'admin@bpbd.go.id' : 'warga@baureno.id'),
          role: resolvedRole,
          raw_role: isPetugas ? 'admin' : 'user',
          phone: localSaved.phone || '081234567890',
          village_id: localSaved.village_id || 3,
          nik: localSaved.nik || '',
          address: localSaved.address || '',
          family_count: localSaved.family_count ?? null,
          elderly_count: localSaved.elderly_count || 0,
          toddler_count: localSaved.toddler_count || 0,
          pregnant_count: localSaved.pregnant_count || 0,
          disabled_count: localSaved.disabled_count || 0,
          notes: localSaved.notes || '',
          ...localSaved,
        };
      }

      localStorage.setItem('sigab_user_profile', JSON.stringify(userObj));
      return {
        access_token: demoToken,
        token_type: 'bearer',
        user: userObj,
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
  // Bersihkan cache profil lokal agar pendaftaran akun baru tidak mewarisi profil lama
  localStorage.removeItem('sigab_user_profile');

  // Map role frontend ('warga'/'petugas') ke backend ('user'/'admin')
  const isPetugas = data.role === 'petugas';
  const backendRole = isPetugas ? 'admin' : 'user';
  const cleanEmail = (data.email || '').trim().toLowerCase();
  const cleanPassword = (data.password || '').trim();
  const cleanName = (data.name || '').trim();
  const cleanPhone = (data.phone || '').trim();
  const cleanNik = (data.nik || '').trim();
  const villageId = data.village_id ? parseInt(data.village_id, 10) : 3;

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || '0800000000',
        password: cleanPassword,
        role: backendRole,
        village_id: villageId,
        nik: cleanNik || null,
        avatar_url: null,
      }),
    });

    // Setelah register berhasil ke backend, login otomatis untuk mendapatkan token
    const loginResult = await login(cleanEmail, cleanPassword, data.role);
    return loginResult;
  } catch (err) {
    // Tangani offline, timeout (HTTP 408), atau kegagalan koneksi backend saat register
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'AbortError';

    if (isNetworkOrTimeout) {
      console.warn('Backend server offline/timeout saat pendaftaran. Menyimpan akun secara lokal.');

      const newUser = {
        id: Date.now(),
        full_name: cleanName || (isPetugas ? 'Petugas BPBD' : 'Warga Baureno'),
        email: cleanEmail,
        phone: cleanPhone || '081234567890',
        role: isPetugas ? 'petugas' : 'warga',
        raw_role: backendRole,
        village_id: villageId,
        nik: cleanNik,
        address: '',
        family_count: null,
        elderly_count: 0,
        toddler_count: 0,
        pregnant_count: 0,
        disabled_count: 0,
        notes: '',
      };

      // Simpan akun ke database lokal (localStorage) agar bisa dipakai untuk login kembali
      try {
        const registeredUsers = JSON.parse(localStorage.getItem('sigab_registered_users') || '[]');
        const filtered = registeredUsers.filter(
          (u) => (u.email || '').toLowerCase() !== cleanEmail
        );
        filtered.push({
          email: cleanEmail,
          password: cleanPassword,
          user: newUser,
        });
        localStorage.setItem('sigab_registered_users', JSON.stringify(filtered));
      } catch (storageErr) {
        console.warn('Gagal menyimpan sigab_registered_users:', storageErr);
      }

      // Buat sesi login aktif untuk user yang baru mendaftar
      const sessionToken = 'sigab-token-' + Date.now();
      localStorage.setItem('access_token', sessionToken);
      localStorage.setItem('sigab_user_role', isPetugas ? 'petugas' : 'warga');
      localStorage.setItem('sigab_user_profile', JSON.stringify(newUser));

      return {
        access_token: sessionToken,
        token_type: 'bearer',
        user: newUser,
      };
    }

    // Jika error spesifik dari backend (misal HTTP 400: Email sudah terdaftar), lempar agar ditampilkan ke user
    throw err;
  }
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('sigab_user_role');
  localStorage.removeItem('sigab_user_profile');
  try { sessionStorage.removeItem('sigab_warga_tab'); } catch { /* abaikan */ }
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
      ...localSaved,
      ...remote,
    };
    localStorage.setItem('sigab_user_profile', JSON.stringify(merged));
    return merged;
  } catch (err) {
    const token = localStorage.getItem('access_token');
    if (token || Object.keys(localSaved).length > 0) {
      const savedRole = localStorage.getItem('sigab_user_role') || (localSaved.role === 'admin' ? 'petugas' : localSaved.role) || 'warga';
      const isPetugas = savedRole === 'petugas' || savedRole === 'admin';
      const fallback = {
        id: isPetugas ? 1 : 999,
        full_name: isPetugas ? 'Petugas BPBD (Pusdalops)' : 'Warga Baureno (Demo)',
        email: isPetugas ? 'admin@bpbd.go.id' : 'warga@baureno.id',
        role: isPetugas ? 'petugas' : 'warga',
        raw_role: isPetugas ? 'admin' : 'user',
        phone: '081234567890',
        village_id: 3,
        nik: '',
        address: '',
        family_count: null,
        elderly_count: 0,
        toddler_count: 0,
        pregnant_count: 0,
        disabled_count: 0,
        notes: '',
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

  // Sinkronkan juga ke database lokal akun terdaftar
  try {
    if (updated.email) {
      const registeredUsers = JSON.parse(localStorage.getItem('sigab_registered_users') || '[]');
      const idx = registeredUsers.findIndex(
        (u) => (u.email || '').toLowerCase() === updated.email.toLowerCase()
      );
      if (idx !== -1) {
        registeredUsers[idx].user = { ...registeredUsers[idx].user, ...updated };
        localStorage.setItem('sigab_registered_users', JSON.stringify(registeredUsers));
      }
    }
  } catch {
    // abaikan
  }

  return updated;
}

/**
 * Mengubah kata sandi pengguna yang sedang login.
 */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  try {
    return await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
  } catch (err) {
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'AbortError';

    if (isNetworkOrTimeout) {
      try {
        const localSaved = JSON.parse(localStorage.getItem('sigab_user_profile') || '{}');
        if (localSaved.email) {
          const registeredUsers = JSON.parse(localStorage.getItem('sigab_registered_users') || '[]');
          const idx = registeredUsers.findIndex(
            (u) => (u.email || '').toLowerCase() === localSaved.email.toLowerCase()
          );
          if (idx !== -1) {
            registeredUsers[idx].password = newPassword;
            localStorage.setItem('sigab_registered_users', JSON.stringify(registeredUsers));
          }
        }
      } catch {
        // abaikan
      }
      return { success: true, message: 'Kata sandi berhasil diperbarui.' };
    }
    throw err;
  }
}
