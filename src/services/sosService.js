/**
 * SOS Service — fungsi untuk tiket darurat.
 */

import { apiFetch } from './api';

export async function createSOSTicket(data) {
  const saveLocalFallback = () => {
    const generatedId = 'TKT-' + Math.floor(1000 + Math.random() * 9000);
    const nowIso = new Date().toISOString();
    const localTicket = {
      id: generatedId,
      ticket_number: generatedId,
      ...data,
      status: 'submitted',
      submitted_at: nowIso,
      created_at: nowIso,
      is_simulation: Boolean(data.is_simulation),
    };
    try {
      const tickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
      const filtered = tickets.filter(t => String(t.id) !== String(localTicket.id) && String(t.ticket_number) !== String(localTicket.ticket_number));
      filtered.unshift(localTicket);
      localStorage.setItem('sigab_local_sos_tickets', JSON.stringify(filtered));
    } catch {
      // abaikan
    }
    return localTicket;
  };

  try {
    const res = await apiFetch('/sos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Simpan juga salinan tiket ke local storage agar persistensi ganda terjaga
    // dan riwayat tidak pernah hilang baik online maupun offline
    try {
      const tickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
      const filtered = tickets.filter(t => String(t.id) !== String(res.id) && String(t.ticket_number) !== String(res.ticket_number));
      filtered.unshift({ ...res, is_simulation: Boolean(res.is_simulation || data.is_simulation) });
      localStorage.setItem('sigab_local_sos_tickets', JSON.stringify(filtered));
    } catch {}
    return res;
  } catch (err) {
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'AbortError';

    const currentToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('access_token') || '') : '';
    const isDemoSession = !currentToken || currentToken.startsWith('demo-') || currentToken.startsWith('sigab-');
    const isAuthError = err.status === 401 || (err.message || '').toLowerCase().includes('validate credentials');
    const isNotEmergencyError = (err.status === 400 || err.status === 403) && (err.message || '').toLowerCase().includes('darurat');

    // Jika mode simulasi atau offline/demo, selalu simpan ke fallback lokal agar tiket tidak hilang
    if (isNetworkOrTimeout || (isAuthError && (isDemoSession || data.is_simulation)) || (isNotEmergencyError && data.is_simulation) || data.is_simulation) {
      console.warn('Menggunakan penyimpanan tiket SOS lokal (mode simulasi / offline / demo session).');
      return saveLocalFallback();
    }

    if (isAuthError) {
      throw new Error('Sesi login Anda telah berakhir. Silakan keluar dan masuk kembali untuk mengirim SOS ke server.');
    }

    throw err;
  }
}

export async function getSOSTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.status) query.append('status', params.status);
  if (params.is_simulation !== undefined && params.is_simulation !== null) {
    query.append('is_simulation', params.is_simulation);
  }
  const qs = query.toString() ? `?${query.toString()}` : '';
  try {
    const remote = await apiFetch(`/sos${qs}`);
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    if (Array.isArray(remote)) {
      const remoteIds = new Set(remote.map((t) => String(t.ticket_number || t.id)));
      const uniqueLocals = localTickets.filter((t) => !remoteIds.has(String(t.ticket_number || t.id)));
      const merged = [...uniqueLocals, ...remote];
      merged.sort((a, b) => new Date(b.submitted_at || b.created_at || 0) - new Date(a.submitted_at || a.created_at || 0));
      return merged;
    }
    return remote;
  } catch {
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    localTickets.sort((a, b) => new Date(b.submitted_at || b.created_at || 0) - new Date(a.submitted_at || a.created_at || 0));
    return localTickets;
  }
}

export async function getMyTickets() {
  try {
    const remote = await apiFetch('/sos/my');
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    if (Array.isArray(remote)) {
      const remoteIds = new Set(remote.map((t) => String(t.ticket_number || t.id)));
      const uniqueLocals = localTickets.filter((t) => !remoteIds.has(String(t.ticket_number || t.id)));
      const merged = [...uniqueLocals, ...remote];
      merged.sort((a, b) => new Date(b.submitted_at || b.created_at || 0) - new Date(a.submitted_at || a.created_at || 0));
      return merged;
    }
    return remote;
  } catch {
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    localTickets.sort((a, b) => new Date(b.submitted_at || b.created_at || 0) - new Date(a.submitted_at || a.created_at || 0));
    return localTickets;
  }
}

export async function getSOSTicketById(id) {
  try {
    return await apiFetch(`/sos/${id}`);
  } catch (err) {
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    const found = localTickets.find((t) => String(t.id) === String(id));
    if (found) return found;
    throw err;
  }
}

export async function updateSOSStatus(id, updateData) {
  try {
    const res = await apiFetch(`/sos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
    try {
      const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
      const idx = localTickets.findIndex((t) => String(t.id) === String(id) || String(t.ticket_number) === String(id));
      if (idx !== -1) {
        localTickets[idx] = { ...localTickets[idx], ...updateData, ...res };
        localStorage.setItem('sigab_local_sos_tickets', JSON.stringify(localTickets));
      }
    } catch {}
    return res;
  } catch (err) {
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama');

    const currentToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('access_token') || '') : '';
    const isDemoSession = !currentToken || currentToken.startsWith('demo-') || currentToken.startsWith('sigab-');

    if (isNetworkOrTimeout || isDemoSession) {
      const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
      const idx = localTickets.findIndex((t) => String(t.id) === String(id) || String(t.ticket_number) === String(id));
      if (idx !== -1) {
        localTickets[idx] = { ...localTickets[idx], ...updateData };
        localStorage.setItem('sigab_local_sos_tickets', JSON.stringify(localTickets));
        return localTickets[idx];
      }
    }
    throw err;
  }
}

export async function uploadSOSPhoto(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    return await apiFetch('/sos/upload-photo', {
      method: 'POST',
      body: formData,
    });
  } catch {
    // Fallback: convert file to data URL for offline preview
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ photo_url: reader.result });
      reader.onerror = () => resolve({ photo_url: '' });
      reader.readAsDataURL(file);
    });
  }
}
