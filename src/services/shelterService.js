import { apiFetch } from './api';

export async function getShelters() {
  return apiFetch('/shelters');
}

export async function getShelterById(id) {
  return apiFetch(`/shelters/${id}`);
}

export async function updateShelterCapacity(id, capacity) {
  return apiFetch(`/shelters/${id}/capacity`, {
    method: 'PUT',
    body: JSON.stringify({ capacity_occupied: capacity }),
  });
}

export async function createShelter(data) {
  return apiFetch('/shelters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteShelter(id) {
  return apiFetch(`/shelters/${id}`, {
    method: 'DELETE',
  });
}

export async function getRouteToShelter(shelterId, userLat, userLon) {
  return apiFetch(`/shelters/${shelterId}/route?user_lat=${userLat}&user_lon=${userLon}`);
}

export async function getNearbyAvailableShelters(userLat, userLon, maxDistanceKm = 50, limit = 10) {
  return apiFetch(`/shelters/nearby-available?user_lat=${userLat}&user_lon=${userLon}&max_distance_km=${maxDistanceKm}&limit=${limit}`);
}
