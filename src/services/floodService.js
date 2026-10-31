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

export async function getFloodIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== 'semua') query.append('category', params.category);
  if (params.village_id) query.append('village_id', params.village_id);
  if (params.year) query.append('year', params.year);
  if (params.search) query.append('search', params.search);
  if (params.page_size) query.append('page_size', params.page_size);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/flood/incidents${qs}`);
}

export async function getFloodArchiveStats(params = {}) {
  const query = new URLSearchParams();
  if (params.year) query.append('year', params.year);
  if (params.village_id) query.append('village_id', params.village_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/flood/incidents/stats${qs}`);
}

export async function syncFloodCsv() {
  return apiFetch('/flood/archive/sync-csv', { method: 'POST' });
}


