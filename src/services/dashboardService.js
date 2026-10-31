/**
 * Dashboard Service — fungsi untuk mengambil data awal (snapshot) 
 * dan data referensi (shelter).
 */

import { apiFetch } from './api';

export async function fetchDashboardSnapshot() {
  return apiFetch('/dashboard/realtime');
}

export async function fetchShelters() {
  return apiFetch('/shelters');
}
