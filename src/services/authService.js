import { apiFetch } from './api';

export async function login(email, password, role) {
  const response = await apiFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role })
  });
  
  localStorage.setItem('access_token', response.access_token);
  return response;
}

export async function register(data) {
  const response = await apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone || '08000000000',
      password: data.password,
      role: data.role,
      village_id: null
    })
  });
  
  localStorage.setItem('access_token', response.access_token);
  return response;
}

export function logout() {
  localStorage.removeItem('access_token');
  window.location.hash = '';
}

export async function getProfile() {
  return await apiFetch('/api/profile', {
    method: 'GET'
  });
}
