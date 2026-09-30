/**
 * SOS Service — fungsi untuk tiket darurat.
 */

import { apiFetch } from './api';

// TODO Minggu 5-6: Implementasi setelah backend SOS API selesai

export async function createSOSTicket(data) {
  return apiFetch('/sos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSOSTickets() {
  return apiFetch('/sos');
}

export async function getMyTickets() {
  return apiFetch('/sos/my');
}

export async function getSOSTicketById(id) {
  return apiFetch(`/sos/${id}`);
}

export async function updateSOSStatus(id, updateData) {
  // updateData minimal: { status: '...' }
  return apiFetch(`/sos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}
