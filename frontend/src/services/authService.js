/**
 * Auth Service — fungsi login, register, dan get profile.
 */

import { apiFetch } from './api';

// TODO Minggu 5-6: Implementasi setelah backend auth selesai

export async function login(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProfile() {
  return apiFetch('/auth/me');
}
