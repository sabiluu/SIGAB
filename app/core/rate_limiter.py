"""
Module Rate Limiter — Perlindungan Brute-Force pada Endpoint Autentikasi.

Menggunakan algoritma Sliding Window berbasis memori (in-memory) dengan
thread-safety (threading.Lock). Melacak kegagalan login per IP dan per username/email
untuk mencegah serangan credential stuffing dan password guessing otomatis.
"""

import time
import threading
from typing import Dict, List, Tuple, Optional


class LoginRateLimiter:
    """
    In-memory sliding window rate limiter untuk percobaan login.
    Membatasi jumlah kegagalan login berturut-turut dalam interval waktu tertentu.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._ip_failures: Dict[str, List[float]] = {}
        self._user_failures: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def _cleanup_old_attempts(self, attempts: List[float], now: float) -> List[float]:
        cutoff = now - self.window_seconds
        return [t for t in attempts if t > cutoff]

    def is_allowed(self, ip: str, identifier: str = "") -> Tuple[bool, int]:
        """
        Cek apakah request login diperbolehkan atau diblokir.
        Mengembalikan (allowed: bool, retry_after_seconds: int).
        """
        now = time.time()
        with self._lock:
            # 1. Cek batas kegagalan IP
            ip_attempts = self._ip_failures.get(ip, [])
            ip_attempts = self._cleanup_old_attempts(ip_attempts, now)
            self._ip_failures[ip] = ip_attempts

            # 2. Cek batas kegagalan Identifier (email/username) jika ada
            user_attempts = []
            clean_id = identifier.strip().lower() if identifier else ""
            if clean_id:
                user_attempts = self._user_failures.get(clean_id, [])
                user_attempts = self._cleanup_old_attempts(user_attempts, now)
                self._user_failures[clean_id] = user_attempts

            # Evaluasi apakah salah satu melampaui batas
            is_ip_blocked = len(ip_attempts) >= self.max_attempts
            is_user_blocked = len(user_attempts) >= self.max_attempts

            if is_ip_blocked or is_user_blocked:
                # Hitung waktu tunggu hingga percobaan tertua di jendela kadaluarsa
                relevant_attempts = ip_attempts if is_ip_blocked else user_attempts
                oldest_attempt = min(relevant_attempts) if relevant_attempts else now
                retry_after = max(1, int(self.window_seconds - (now - oldest_attempt)))
                return False, retry_after

            return True, 0

    def record_failure(self, ip: str, identifier: str = ""):
        """Catat satu kegagalan login untuk IP dan identifier."""
        now = time.time()
        with self._lock:
            # Catat pada IP
            ip_attempts = self._ip_failures.get(ip, [])
            ip_attempts = self._cleanup_old_attempts(ip_attempts, now)
            ip_attempts.append(now)
            self._ip_failures[ip] = ip_attempts

            # Catat pada Identifier
            clean_id = identifier.strip().lower() if identifier else ""
            if clean_id:
                user_attempts = self._user_failures.get(clean_id, [])
                user_attempts = self._cleanup_old_attempts(user_attempts, now)
                user_attempts.append(now)
                self._user_failures[clean_id] = user_attempts

    def record_success(self, ip: str, identifier: str = ""):
        """Reset catatan kegagalan saat login berhasil."""
        with self._lock:
            if ip in self._ip_failures:
                del self._ip_failures[ip]
            clean_id = identifier.strip().lower() if identifier else ""
            if clean_id and clean_id in self._user_failures:
                del self._user_failures[clean_id]

    def reset(self):
        """Reset seluruh catatan kegagalan (berguna untuk testing)."""
        with self._lock:
            self._ip_failures.clear()
            self._user_failures.clear()


# Global singleton instance: 5 percobaan gagal per 60 detik
login_rate_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60)
