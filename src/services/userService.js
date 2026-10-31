import { apiFetch } from './api';

/**
 * Service untuk Manajemen User & Pemantauan Kependudukan Warga Terdampak (/users).
 */

export async function fetchCitizenDemographicsStats() {
  return apiFetch('/users/stats');
}

export async function fetchCitizensList(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page);
  if (params.pageSize) q.append('page_size', params.pageSize);
  if (params.search) q.append('search', params.search);
  if (params.villageId) q.append('village_id', params.villageId);
  if (params.role) q.append('role', params.role);
  if (params.isActive !== undefined && params.isActive !== null) q.append('is_active', params.isActive);
  if (params.hasVulnerable) q.append('has_vulnerable', 'true');

  const qs = q.toString() ? `?${q.toString()}` : '';
  return apiFetch(`/users${qs}`);
}

export async function fetchCitizenDetail(userId) {
  return apiFetch(`/users/${userId}`);
}

export async function updateCitizenStatus(userId, isActive, reason = null) {
  return apiFetch(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive, reason }),
  });
}

export async function updateCitizenProfile(userId, profileData) {
  return apiFetch(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

export async function deleteCitizenAccount(userId) {
  return apiFetch(`/users/${userId}`, {
    method: 'DELETE',
  });
}
