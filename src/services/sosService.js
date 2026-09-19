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

export async function updateSOSStatus(id, status) {
  return apiFetch(`/sos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
