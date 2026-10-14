/**
 * useGeolocation — Custom hook untuk mendapatkan lokasi GPS nyata dari device pengguna,
 * lengkap dengan reverse geocoding nama wilayah aktual (Kecamatan, Kabupaten/Kota).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Fallback jika GPS dimatikan atau diblokir (Pusat Kecamatan Baureno, Bojonegoro)
const DEFAULT_COORDS = {
  latitude: -7.1282,
  longitude: 112.1039,
  accuracy: 100,
};

const DEFAULT_LABEL = 'Baureno, Bojonegoro';

export function useGeolocation() {
  // Ambil cache lokasi terakhir jika pernah terdeteksi
  const cached = (() => {
    try {
      const saved = localStorage.getItem('sigab_device_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Hapus jika koordinat adalah data Bojonegoro Kota lama (longitude < 111.95)
        if (parsed?.position?.longitude && parsed.position.longitude < 111.95) {
          localStorage.removeItem('sigab_device_location');
          return null;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  })();

  const [position, setPosition] = useState(cached?.position || null);
  const [address, setAddress] = useState(cached?.address || (cached ? DEFAULT_LABEL : 'Mencari lokasi...'));
  const [fullAddress, setFullAddress] = useState(cached?.fullAddress || '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!cached);
  const lastGeocodeRef = useRef({ lat: 0, lon: 0, time: 0 });

  // Fungsi reverse geocoding ke OpenStreetMap Nominatim dengan throttling
  const reverseGeocode = useCallback(async (lat, lon) => {
    const now = Date.now();
    const last = lastGeocodeRef.current;
    const distDiff = Math.abs(lat - last.lat) + Math.abs(lon - last.lon);
    
    // Hanya panggil API jika berjarak signifikan (> ~100m) atau sudah > 30 detik
    if (distDiff < 0.001 && now - last.time < 30000) {
      return;
    }
    lastGeocodeRef.current = { lat, lon, time: now };

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'id', 'User-Agent': 'SIGAB-Disaster-App/1.0' } }
      );
      if (!res.ok) throw new Error('Geocode failed');
      const data = await res.json();
      
      const addr = data.address || {};
      const subdistrict = addr.village || addr.suburb || addr.neighbourhood || addr.municipality || '';
      const district = addr.municipality || addr.city_district || addr.county || addr.city || '';
      const city = addr.city || addr.town || addr.county || addr.state || '';

      // Format nama ringkas: "Kecamatan/Desa, Kota/Kabupaten"
      let shortLabel = '';
      if (subdistrict && (city || district)) {
        shortLabel = `${subdistrict}, ${district || city}`;
      } else if (district) {
        shortLabel = `${district}, ${city}`;
      } else {
        shortLabel = data.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }

      setAddress(shortLabel);
      setFullAddress(data.display_name || shortLabel);

      // Simpan ke cache lokal
      try {
        localStorage.setItem('sigab_device_location', JSON.stringify({
          position: { latitude: lat, longitude: lon },
          address: shortLabel,
          fullAddress: data.display_name,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save location to localStorage', e);
      }
    } catch {
      // Fallback label dengan koordinat
      setAddress(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
  }, []);

  // Handler sukses GPS
  const handleSuccess = useCallback((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const newPos = {
      latitude: lat,
      longitude: lon,
      accuracy: pos.coords.accuracy,
    };
    setPosition(newPos);
    setError(null);
    setLoading(false);

    // Dapatkan nama wilayah dari koordinat GPS asli
    reverseGeocode(lat, lon);
  }, [reverseGeocode]);

  // Handler gagal GPS
  const handleError = useCallback((err) => {
    console.warn('GPS device error:', err.message);
    setError(err.message);
    setLoading(false);

    if (!position) {
      // Gunakan default Baureno jika belum ada posisi sama sekali
      setPosition(DEFAULT_COORDS);
      setAddress(DEFAULT_LABEL);
      setFullAddress('Kecamatan Baureno, Kabupaten Bojonegoro, Jawa Timur');
    }
  }, [position]);

  // Request & Watch Lokasi Device
  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung oleh browser ini.');
      setPosition(DEFAULT_COORDS);
      setAddress(DEFAULT_LABEL);
      setLoading(false);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  }, [handleSuccess, handleError]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung oleh browser ini.');
      setPosition(DEFAULT_COORDS);
      setAddress(DEFAULT_LABEL);
      setLoading(false);
      return;
    }

    // Ambil posisi saat komponen dimount
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });

    // Pasang watcher untuk mengikuti pergerakan device
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [handleSuccess, handleError]);

  return { 
    position, 
    latitude: position?.latitude,
    longitude: position?.longitude,
    address, 
    fullAddress,
    error, 
    loading, 
    refresh,
    isRealDevice: !error && position && position.latitude !== DEFAULT_COORDS.latitude
  };
}

export default useGeolocation;
