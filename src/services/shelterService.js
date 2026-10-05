import { apiFetch } from './api';

export async function getShelters() {
  return apiFetch('/shelters');
}

export async function updateShelterCapacity(id, capacity) {
  return apiFetch(`/shelters/${id}/capacity`, {
    method: 'PUT',
    body: JSON.stringify({ capacity_occupied: capacity }),
  });
}
