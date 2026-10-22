/**
 * useGeolocation — Custom hook untuk mendapatkan lokasi GPS warga Kecamatan Baureno, Bojonegoro.
 * Dilengkapi proteksi deviasi ISP (contoh: ISP provider mendeteksi Surabaya) dan fitur
 * pemilihan desa domisili Baureno secara presisi.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Bounding & Pusat Kecamatan Baureno, Kabupaten Bojonegoro
export const DEFAULT_BAURENO_COORDS = {
  latitude: -7.1282,
  longitude: 112.1039,
  accuracy: 10,
};

export const DEFAULT_BAURENO_LABEL = 'Desa Baureno, Bojonegoro';
export const DEFAULT_BAURENO_FULL = 'Kecamatan Baureno, Kabupaten Bojonegoro, Jawa Timur';

// Daftar 25 Desa Resmi Kecamatan Baureno, Bojonegoro
export const BAURENO_VILLAGES = [
  { id: 3, name: 'Baureno (Pusat)', latitude: -7.1282, longitude: 112.1039 },
  { id: 8, name: 'Gunungsari', latitude: -7.1269, longitude: 112.1405 },
  { id: 22, name: 'Tanggungan', latitude: -7.1036, longitude: 112.1336 },
  { id: 24, name: 'Trojalu', latitude: -7.1272, longitude: 112.1161 },
  { id: 1, name: 'Banjaran', latitude: -7.1354, longitude: 112.0754 },
  { id: 2, name: 'Banjaranyar', latitude: -7.1589, longitude: 112.0515 },
  { id: 4, name: 'Blongsong', latitude: -7.1382, longitude: 112.0965 },
  { id: 5, name: 'Bumiayu', latitude: -7.1198, longitude: 112.1221 },
  { id: 6, name: 'Drajat', latitude: -7.1526, longitude: 112.0494 },
  { id: 7, name: 'Gajah', latitude: -7.1242, longitude: 112.1592 },
  { id: 9, name: 'Kalisari', latitude: -7.1189, longitude: 112.1441 },
  { id: 10, name: 'Karangdayu', latitude: -7.1208, longitude: 112.0823 },
  { id: 11, name: 'Kauman', latitude: -7.1211, longitude: 112.1027 },
  { id: 12, name: 'Kedungrejo', latitude: -7.0906, longitude: 112.1023 },
  { id: 13, name: 'Lebaksari', latitude: -7.0931, longitude: 112.1189 },
  { id: 14, name: 'Ngemplak', latitude: -7.1557, longitude: 112.0617 },
  { id: 15, name: 'Pasinan', latitude: -7.1242, longitude: 112.1021 },
  { id: 16, name: 'Pomahan', latitude: -7.1161, longitude: 112.0699 },
  { id: 17, name: 'Pucangarum', latitude: -7.0929, longitude: 112.0766 },
  { id: 18, name: 'Selorejo', latitude: -7.1534, longitude: 112.1529 },
  { id: 19, name: 'Sembunglor', latitude: -7.119, longitude: 112.0568 },
  { id: 20, name: 'Sraturejo', latitude: -7.1365, longitude: 112.0832 },
  { id: 21, name: 'Sumuragung', latitude: -7.1372, longitude: 112.1547 },
  { id: 23, name: 'Tlogoagung', latitude: -7.1428, longitude: 112.1451 },
  { id: 25, name: 'Tulungagung', latitude: -7.1291, longitude: 112.1279 }
];

export function getDistanceFromBaurenoKm(lat, lon) {
  if (!lat || !lon) return 0;
  const R = 6371;
  const dLat = (lat - DEFAULT_BAURENO_COORDS.latitude) * (Math.PI / 180);
  const dLon = (lon - DEFAULT_BAURENO_COORDS.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(DEFAULT_BAURENO_COORDS.latitude * (Math.PI / 180)) *
    Math.cos(lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeolocation() {
  // 1. Cek apakah ada custom location yang dipilih warga
  const initialCustom = (() => {
    try {
      const saved = localStorage.getItem('sigab_custom_location');
      if (saved) return JSON.parse(saved);
    } catch {
      return null;
    }
    return null;
  })();

  // 2. Cek cache device jika tidak ada custom location
  const cachedDevice = (() => {
    try {
      const saved = localStorage.getItem('sigab_device_location');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      return null;
    }
    return null;
  })();

  const activeInitial = initialCustom || cachedDevice;

  const [position, setPosition] = useState(
    activeInitial?.position || DEFAULT_BAURENO_COORDS
  );
  const [address, setAddress] = useState(
    activeInitial?.address || DEFAULT_BAURENO_LABEL
  );
  const [fullAddress, setFullAddress] = useState(
    activeInitial?.fullAddress || DEFAULT_BAURENO_FULL
  );
  const [isCustom, setIsCustom] = useState(Boolean(initialCustom));
  const [isOutsideCoverage, setIsOutsideCoverage] = useState(false);
  const [outsideAreaName, setOutsideAreaName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRealDevice, setIsRealDevice] = useState(Boolean(cachedDevice && !initialCustom));

  const lastGeocodeRef = useRef({ lat: 0, lon: 0, time: 0 });

  // Fungsi reverse geocoding ke OpenStreetMap Nominatim dengan fallback ke BigDataCloud
  const reverseGeocode = useCallback(async (lat, lon) => {
    if (!lat || !lon) return;
    const now = Date.now();
    const last = lastGeocodeRef.current;
    const distDiff = Math.abs(lat - last.lat) + Math.abs(lon - last.lon);
    
    if (distDiff < 0.0005 && now - last.time < 15000) {
      return;
    }
    lastGeocodeRef.current = { lat, lon, time: now };

    // 1. Coba OpenStreetMap Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'id', 'User-Agent': 'SIGAB-Disaster-App/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const subdistrict = addr.village || addr.suburb || addr.neighbourhood || addr.municipality || '';
        const district = addr.municipality || addr.city_district || addr.county || addr.city || '';
        const city = addr.city || addr.town || addr.county || addr.state || '';

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
        return;
      }
    } catch (e) {
      console.warn('Nominatim reverse geocode error, trying BigDataCloud:', e);
    }

    // 2. Fallback BigDataCloud (cepat, andal, tanpa API key)
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`
      );
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.principalSubdivision || '';
        const city = data.city || '';
        const shortLabel = [locality, city].filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        const full = `${shortLabel}, ${data.countryName || 'Indonesia'}`;

        setAddress(shortLabel);
        setFullAddress(full);

        try {
          localStorage.setItem('sigab_device_location', JSON.stringify({
            position: { latitude: lat, longitude: lon },
            address: shortLabel,
            fullAddress: full,
            timestamp: Date.now()
          }));
        } catch (e) {}
        return;
      }
    } catch (e) {}

    // 3. Fallback koordinat
    const coordLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    setAddress(coordLabel);
    setFullAddress(`Koordinat: ${coordLabel}`);
  }, []);

  // Handler sukses GPS Device
  const handleSuccess = useCallback(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracy = pos.coords.accuracy || 10;
    const distFromBaureno = getDistanceFromBaurenoKm(lat, lon);

    const isOutside = distFromBaureno > 35;
    setIsOutsideCoverage(isOutside);

    // Tetap gunakan koordinat REAL device asli
    const newPos = { latitude: lat, longitude: lon, accuracy };
    setPosition(newPos);
    setIsRealDevice(true);
    setIsCustom(false);

    try {
      localStorage.removeItem('sigab_custom_location');
    } catch {}

    await reverseGeocode(lat, lon);
    setLoading(false);
  }, [reverseGeocode]);

  // Handler gagal GPS (coba fallback IP Geolocation)
  const handleError = useCallback(async (err) => {
    console.warn('GPS hardware error, trying IP Geolocation fallback:', err?.message || err);
    setError(err?.message || 'Gagal membaca sensor GPS');

    try {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (res.ok) {
        const ipData = await res.json();
        const ipLat = parseFloat(ipData.latitude);
        const ipLon = parseFloat(ipData.longitude);
        if (!isNaN(ipLat) && !isNaN(ipLon)) {
          const ipPos = { latitude: ipLat, longitude: ipLon, accuracy: 1000 };
          setPosition(ipPos);
          setIsRealDevice(true);
          setIsCustom(false);
          await reverseGeocode(ipLat, ipLon);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('IP geolocation fallback failed:', e);
    }

    // Jika gagal total dan belum ada posisi tersimpan
    const hasCustom = localStorage.getItem('sigab_custom_location');
    const hasDevice = localStorage.getItem('sigab_device_location');
    if (!hasCustom && !hasDevice) {
      setPosition(DEFAULT_BAURENO_COORDS);
      setAddress(DEFAULT_BAURENO_LABEL);
      setFullAddress(DEFAULT_BAURENO_FULL);
    }
    setLoading(false);
  }, [reverseGeocode]);

  // Request & Watch Lokasi Device
  const refresh = useCallback(() => {
    setLoading(true);
    try {
      localStorage.removeItem('sigab_custom_location');
    } catch {}
    setIsCustom(false);

    if (!navigator.geolocation) {
      handleError(new Error('Geolokasi tidak didukung oleh browser ini.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  }, [handleSuccess, handleError]);

  // Gunakan koordinat manual / custom (misal dari klik peta atau drag marker)
  const setCustomCoordinates = useCallback(async (lat, lon, accuracy = 10) => {
    const newPos = { latitude: lat, longitude: lon, accuracy };
    setPosition(newPos);
    setIsCustom(true);
    setIsRealDevice(true);
    await reverseGeocode(lat, lon);
  }, [reverseGeocode]);

  // Fungsi untuk menetapkan desa domisili warga secara presisi
  const setVillageLocation = useCallback((village) => {
    if (!village) return;
    const newPos = {
      latitude: village.latitude || village.lat,
      longitude: village.longitude || village.lon,
      accuracy: 10
    };
    const cleanName = village.name.replace(/^Desa\s+/i, '');
    const label = `Desa ${cleanName}, Bojonegoro`;
    const full = `Desa ${cleanName}, Kecamatan Baureno, Kabupaten Bojonegoro, Jawa Timur`;

    setPosition(newPos);
    setAddress(label);
    setFullAddress(full);
    setIsCustom(true);
    setIsRealDevice(false);

    try {
      localStorage.setItem('sigab_custom_location', JSON.stringify({
        position: newPos,
        address: label,
        fullAddress: full,
        villageId: village.id,
        villageName: cleanName
      }));
    } catch (e) {
      console.warn('Failed to save custom location', e);
    }
  }, []);

  // Fungsi paksa beralih ke Real Device GPS
  const useRealDeviceLocation = useCallback(() => {
    try {
      localStorage.removeItem('sigab_custom_location');
    } catch {}
    setIsCustom(false);
    refresh();
  }, [refresh]);

  // Fungsi reset ke default Baureno
  const resetToBaurenoDefault = useCallback(() => {
    try {
      localStorage.removeItem('sigab_custom_location');
      localStorage.removeItem('sigab_device_location');
    } catch {}
    setPosition(DEFAULT_BAURENO_COORDS);
    setAddress(DEFAULT_BAURENO_LABEL);
    setFullAddress(DEFAULT_BAURENO_FULL);
    setIsCustom(false);
    setIsRealDevice(false);
  }, []);

  useEffect(() => {
    // Jalankan deteksi GPS device langsung & kontinu real-time
    if (navigator.geolocation) {
      setLoading(true);
      // 1. Initial quick GPS reading
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      // 2. Continuous real-time location tracking
      const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000
      });
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      handleError(new Error('Browser tidak mendukung geolokasi'));
    }
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
    isCustom,
    isOutsideCoverage,
    outsideAreaName,
    setVillageLocation,
    resetToBaurenoDefault,
    useRealDeviceLocation,
    setCustomCoordinates,
    isRealDevice: isRealDevice || (position && (position.latitude !== DEFAULT_BAURENO_COORDS.latitude || position.longitude !== DEFAULT_BAURENO_COORDS.longitude))
  };
}

export default useGeolocation;

