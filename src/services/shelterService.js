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

export async function getRouteToShelter(shelterId, userLat, userLon, destLat = null, destLon = null) {
  try {
    return await apiFetch(`/shelters/${shelterId}/route?user_lat=${userLat}&user_lon=${userLon}`);
  } catch (err) {
    // Client-side fallback to direct OSRM if backend route is unavailable
    try {
      let targetLat = destLat;
      let targetLon = destLon;
      if (!targetLat || !targetLon) {
        const shelter = await getShelterById(shelterId).catch(() => null);
        if (shelter) {
          targetLat = shelter.latitude;
          targetLon = shelter.longitude;
        }
      }
      if (targetLat && targetLon) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${targetLon},${targetLat}?overview=full&geometries=geojson`;
        const resp = await fetch(osrmUrl);
        const data = await resp.json();
        if (data.routes && data.routes[0]) {
          const r = data.routes[0];
          return {
            coordinates: r.geometry.coordinates,
            distance_km: (r.distance / 1000).toFixed(1),
            duration_minutes: Math.max(1, Math.round(r.duration / 60)),
            is_fallback: true
          };
        }
      }
    } catch {
      // fallback failed, will be handled by caller
    }
    throw err;
  }
}

export async function getNearbyAvailableShelters(userLat, userLon, maxDistanceKm = 50, limit = 10) {
  return apiFetch(`/shelters/nearby-available?user_lat=${userLat}&user_lon=${userLon}&max_distance_km=${maxDistanceKm}&limit=${limit}`);
}
