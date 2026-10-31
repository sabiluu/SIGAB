import { apiFetch } from './api';

/**
 * Service untuk mengakses dan memperbarui konfigurasi sistem & bobot kalkulasi banjir.
 */

export async function fetchSystemConfigs() {
  return apiFetch('/config');
}

export async function fetchFloodWeights() {
  return apiFetch('/config/flood-weights');
}

export async function updateFloodWeights(weights, recalculate = true) {
  return apiFetch(`/config/flood-weights?recalculate=${recalculate}`, {
    method: 'PUT',
    body: JSON.stringify(weights),
  });
}

export async function resetFloodWeights(recalculate = true) {
  return apiFetch(`/config/flood-weights/reset?recalculate=${recalculate}`, {
    method: 'POST',
  });
}

export async function fetchConfigByKey(key) {
  return apiFetch(`/config/${key}`);
}

export async function updateConfigByKey(key, configValue, description = null) {
  return apiFetch(`/config/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ config_value: configValue, description }),
  });
}
