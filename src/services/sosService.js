/**
 * SOS Service — fungsi untuk tiket darurat.
 */

import { apiFetch } from './api';

export async function createSOSTicket(data) {
  return apiFetch('/sos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSOSTickets(params = {}) {
  const query = new URLSearchParams();
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.status) query.append('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/sos${qs}`);
}

export async function getMyTickets() {
  return apiFetch('/sos/my');
}

export async function getSOSTicketById(id) {
  return apiFetch(`/sos/${id}`);
}

export async function updateSOSStatus(id, updateData) {
  return apiFetch(`/sos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

export async function uploadSOSPhoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/sos/upload-photo', {
    method: 'POST',
    body: formData,
  });
}
