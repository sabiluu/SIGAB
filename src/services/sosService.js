/**
 * SOS Service — fungsi untuk tiket darurat.
 */

import { apiFetch } from './api';

export async function createSOSTicket(data) {
  try {
    return await apiFetch('/sos', {
      method: 'POST',
      body: JSON.stringify(data),
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
      console.warn('Backend server offline saat kirim SOS, menyimpan tiket lokal.');
      const localTicket = {
        id: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
        ...data,
        status: 'MENUNGGU',
        created_at: new Date().toISOString(),
      };
      try {
        const tickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
        tickets.unshift(localTicket);
        localStorage.setItem('sigab_local_sos_tickets', JSON.stringify(tickets));
      } catch {
        // abaikan
      }
      return localTicket;
    }
    throw err;
  }
}

export async function getSOSTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.status) query.append('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  try {
    const remote = await apiFetch(`/sos${qs}`);
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    if (Array.isArray(remote)) {
      return [...localTickets, ...remote];
    }
    return remote;
  } catch {
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    return localTickets;
  }
}

export async function getMyTickets() {
  try {
    const remote = await apiFetch('/sos/my');
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
    if (Array.isArray(remote)) {
      return [...localTickets, ...remote];
    }
    return remote;
  } catch {
    const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
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
    return await apiFetch(`/sos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  } catch (err) {
    const isNetworkOrTimeout =
      err.status === 0 ||
      err.status === 408 ||
      err.message?.includes('tidak dapat dihubungi') ||
      err.message?.includes('terlalu lama');

    if (isNetworkOrTimeout) {
      const localTickets = JSON.parse(localStorage.getItem('sigab_local_sos_tickets') || '[]');
      const idx = localTickets.findIndex((t) => String(t.id) === String(id));
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
