/**
 * Flood Service — fungsi untuk data banjir & risiko desa.
 */

import { apiFetch } from './api';

// TODO Minggu 8: Implementasi setelah backend flood API selesai

export async function getVillages() {
  return apiFetch('/villages');
}

export async function getVillageDetail(id) {
  return apiFetch(`/villages/${id}`);
}

export async function getFloodLatest() {
  return apiFetch('/flood/latest');
}

export async function getFloodHistory(villageId) {
  return apiFetch(`/flood/history/${villageId}`);
}
