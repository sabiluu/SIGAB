/**
 * Auth Service — fungsi login, register, dan get profile.
 * (MENGGUNAKAN LOCALSTORAGE MOCK - karena backend Python gagal build)
 */

import { apiFetch } from './api';

// Helper to simulate DB using localStorage
function getUsers() {
  const usersStr = localStorage.getItem('mock_users');
  return usersStr ? JSON.parse(usersStr) : [];
}

function saveUsers(users) {
  localStorage.setItem('mock_users', JSON.stringify(users));
}

export async function login(email, password, role) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = getUsers();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return reject(new Error('Email tidak terdaftar. Silakan daftar terlebih dahulu.'));
      }
      
      if (user.password !== password) {
        return reject(new Error('Kata sandi salah. Coba lagi.'));
      }
      
      if (user.role !== role) {
        const roleAsli = user.role === 'petugas' ? 'Petugas BPBD' : 'Warga';
        const roleCoba = role === 'petugas' ? 'Petugas BPBD' : 'Warga';
        return reject(new Error(`Gagal masuk. Akun ini terdaftar sebagai ${roleAsli}, bukan ${roleCoba}.`));
      }

      localStorage.setItem('access_token', 'mock-token-123');
      localStorage.setItem('current_user_id', user.id.toString());
      
      resolve({ access_token: 'mock-token-123', token_type: 'bearer', user });
    }, 800);
  });
}

export async function register(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = getUsers();
      if (users.some(u => u.email === data.email)) {
        return reject(new Error('Email ini sudah terdaftar! Silakan gunakan email lain atau coba masuk.'));
      }
      
      const newUser = {
        id: Date.now(),
        full_name: data.name,
        email: data.email,
        password: data.password, // Plaintext untuk mock lokal saja
        role: data.role // 'warga' atau 'petugas'
      };
      
      users.push(newUser);
      saveUsers(users);
      
      localStorage.setItem('access_token', 'mock-token-123');
      localStorage.setItem('current_user_id', newUser.id.toString());
      
      resolve({
        user: newUser
      });
    }, 800);
  });
}

export async function getProfile() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const currentUserId = localStorage.getItem('current_user_id');
      if (!currentUserId) {
        return reject(new Error('Sesi telah berakhir'));
      }
      
      const users = getUsers();
      const user = users.find(u => u.id.toString() === currentUserId);
      
      if (!user) {
        return reject(new Error('Pengguna tidak ditemukan'));
      }
      
      resolve({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        village_id: 1,
        is_active: true
      });
    }, 500);
  });
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('current_user_id');
  window.location.hash = '';
}
