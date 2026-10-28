import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createSOSTicket, getMyTickets, uploadSOSPhoto } from '../../services/sosService';
import wsService from '../../services/wsService';
import { useAuth } from '../../context/AuthContext';
import { formatWIBDateTime } from '../../utils/helpers';

import useGeolocation from '../../hooks/useGeolocation';

const userPinIcon = L.divIcon({
  className: 'custom-sos-pin',
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(220, 38, 38, 0.4); animation: pulse 1.5s infinite;"></div>
      <div style="background-color: #dc2626; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.45); cursor: grab;">
        📍
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapPanController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.flyTo([center.lat, center.lng], 16, { duration: 0.8 });
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }
  }, [center?.lat, center?.lng, map]);
  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect && e.latlng) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

export default function WargaSOS({ onNavigate, geo: externalGeo, isEmergencyActive = false }) {
  const { user } = useAuth();
  const internalGeo = useGeolocation();
  const geo = externalGeo || internalGeo;

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [currentClock, setCurrentClock] = useState(new Date());

  // Real-time ticking clock untuk jam real di form
  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Riwayat tiket warga
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilterStatus, setTicketFilterStatus] = useState('all');

  // Filtered tickets berdasarkan search kode tiket & status
  const filteredMyTickets = useMemo(() => {
    return myTickets.filter((t) => {
      const q = ticketSearch.trim().toLowerCase();
      const matchQuery = !q || 
        (t.ticket_number && t.ticket_number.toLowerCase().includes(q)) || 
        (t.gps_address && t.gps_address.toLowerCase().includes(q));
      if (!matchQuery) return false;

      if (ticketFilterStatus === 'all') return true;
      if (ticketFilterStatus === 'waiting') return t.status === 'submitted';
      if (ticketFilterStatus === 'process') return ['verified', 'dispatched', 'arrived'].includes(t.status);
      if (ticketFilterStatus === 'completed') return t.status === 'completed';
      return true;
    });
  }, [myTickets, ticketSearch, ticketFilterStatus]);

  // Foto situasi / banjir
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [cameraError, setCameraError] = useState(null);
  const [cameraFlash, setCameraFlash] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Data form - sinkron dengan GPS device nyata
  const [gpsLocation, setGpsLocation] = useState(
    geo?.position ? { lat: geo.position.latitude, lng: geo.position.longitude } : null
  );
  const [address, setAddress] = useState(
    geo?.fullAddress || geo?.address || 'Mencari lokasi perangkat...'
  );
  const [detailPatokan, setDetailPatokan] = useState('');
  const [familyCount, setFamilyCount] = useState(1);
  const [vulnerable, setVulnerable] = useState({
    elderly: false,
    toddler: false,
    disability: false,
    pregnant: false
  });

  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(geo?.position?.accuracy || null);
  const [locationSource, setLocationSource] = useState(
    geo?.isRealDevice ? 'real_gps' : 'syncing'
  );

  const reverseGeocodeCoords = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'id', 'User-Agent': 'SIGAB-Disaster-App/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const subdistrict = addr.village || addr.suburb || addr.neighbourhood || addr.municipality || '';
        const city = addr.city || addr.town || addr.county || addr.state || '';
        const label = [subdistrict, city].filter(Boolean).join(', ') || data.display_name;
        return { short: label, full: data.display_name || label };
      }
    } catch {}

    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`
      );
      if (res.ok) {
        const data = await res.json();
        const label = [data.locality, data.city].filter(Boolean).join(', ');
        return { short: label, full: `${label}, ${data.countryName || 'Indonesia'}` };
      }
    } catch {}

    return { short: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, full: `Koordinat ${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  };

  // Fungsi sinkronisasi koordinat GPS nyata dari device
  const syncRealDeviceLocation = useCallback(async () => {
    setLoadingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setGpsLocation({ lat, lng });
          setGpsAccuracy(acc);
          setLocationSource('real_gps');

          const names = await reverseGeocodeCoords(lat, lng);
          setAddress(names.full || names.short);
          setLoadingGps(false);

          if (geo?.setCustomCoordinates) {
            geo.setCustomCoordinates(lat, lng, acc);
          }
        },
        async (err) => {
          console.warn('Geolocation error, fallback to IP:', err);
          try {
            const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              const ipLat = parseFloat(ipData.latitude);
              const ipLng = parseFloat(ipData.longitude);
              if (!isNaN(ipLat) && !isNaN(ipLng)) {
                setGpsLocation({ lat: ipLat, lng: ipLng });
                setGpsAccuracy(1000);
                setLocationSource('ip');
                const names = await reverseGeocodeCoords(ipLat, ipLng);
                setAddress(names.full || names.short);
                setLoadingGps(false);
                return;
              }
            }
          } catch (e) {}
          setLoadingGps(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setLoadingGps(false);
    }
  }, [geo]);

  // Handler jika user menggeser pin atau mengklik titik pada peta
  const handleMapLocationSelect = async (lat, lng) => {
    setGpsLocation({ lat, lng });
    setLocationSource('manual');
    const names = await reverseGeocodeCoords(lat, lng);
    setAddress(names.full || names.short);
    if (geo?.setCustomCoordinates) {
      geo.setCustomCoordinates(lat, lng);
    }
  };

  // Jalankan sinkronisasi GPS nyata perangkat saat halaman SOS dibuka
  useEffect(() => {
    syncRealDeviceLocation();
  }, [syncRealDeviceLocation]);

  // Sinkronkan GPS otomatis saat terdeteksi dari hook geo
  useEffect(() => {
    if (geo?.position?.latitude && geo?.position?.longitude) {
      setGpsLocation({ lat: geo.position.latitude, lng: geo.position.longitude });
      if (geo.position.accuracy) {
        setGpsAccuracy(geo.position.accuracy);
      }
      if (geo.fullAddress || geo.address) {
        setAddress(geo.fullAddress || geo.address);
      }
    }
  }, [geo?.position?.latitude, geo?.position?.longitude, geo?.position?.accuracy, geo?.fullAddress, geo?.address]);

  // Handler Refresh GPS
  const detectGPS = () => {
    syncRealDeviceLocation();
    if (geo?.refresh) {
      geo.refresh();
    }
  };

  // Load ticket history
  const loadMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await getMyTickets();
      setMyTickets(res || []);
    } catch (err) {
      console.error('Gagal memuat tiket warga:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadMyTickets();
    }
  }, [activeTab]);

  // WebSocket listener for SOS events on channel 'alerts'
  useEffect(() => {
    wsService.connect('alerts', {
      villageId: user?.village_id,
      userId: user?.id,
      role: 'user',
    });

    const handleSOSUpdate = (data) => {
      // Update active ticket if matches
      if (ticket && data.ticket_id === ticket.id) {
        setTicket(prev => ({ 
          ...prev, 
          status: data.status,
          assigned_unit: data.extra_data?.assigned_unit || prev.assigned_unit 
        }));
      }

      // Update list of myTickets if present
      setMyTickets(prev => prev.map(t => {
        if (t.id === data.ticket_id) {
          return { 
            ...t, 
            status: data.status,
            assigned_unit: data.extra_data?.assigned_unit || t.assigned_unit 
          };
        }
        return t;
      }));
    };

    const events = ['sos_verified', 'sos_dispatched', 'sos_arrived', 'sos_completed', 'sos_rejected', 'sos_updated'];
    const unsubs = events.map(evt => wsService.on(evt, handleSOSUpdate));

    return () => unsubs.forEach(unsub => unsub());
  }, [ticket]);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      setPhotoFile(file);
      setPhotoPreview(compressedDataUrl);
      setPhotoBase64(compressedDataUrl);
    } catch (err) {
      console.error('Gagal memproses foto:', err);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoBase64(null);
    stopLiveCamera();
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const playCameraClickSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      }
    } catch (e) {}
  };

  const startLiveCamera = async (facing = 'environment') => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Kamera tidak dapat diakses atau izin kamera ditolak. Silakan periksa pengaturan browser Anda atau pilih foto dari berkas/galeri.');
    }
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const switchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startLiveCamera(nextFacing);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    playCameraClickSound();
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 220);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `sos_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
      }
    }, 'image/jpeg', 0.85);

    setPhotoPreview(dataUrl);
    setPhotoBase64(dataUrl);
    stopLiveCamera();
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleSubmit = async () => {
    if (!gpsLocation) {
      alert('Lokasi GPS belum terkunci. Mohon tunggu atau refresh GPS.');
      return;
    }
    setLoading(true);
    try {
      let finalPhotoUrl = null;
      if (photoFile) {
        try {
          const uploadRes = await uploadSOSPhoto(photoFile);
          if (uploadRes && uploadRes.photo_url) {
            finalPhotoUrl = uploadRes.photo_url;
          }
        } catch (uploadErr) {
          console.warn('Gagal upload ke server, fallback ke base64:', uploadErr);
          finalPhotoUrl = photoBase64;
        }
      }

      const fullAddress = (detailPatokan && detailPatokan.trim())
        ? `${address || 'Lokasi Warga'} (Patokan: ${detailPatokan.trim()})`
        : (address || 'Lokasi Warga');

      const isSim = Boolean(
        isEmergencyActive || 
        (detailPatokan && detailPatokan.toLowerCase().includes('simulasi')) || 
        (address && address.toLowerCase().includes('simulasi'))
      );

      const payload = {
        reporter_id: user?.id || 1,
        village_id: user?.village_id || 3,
        gps_latitude: gpsLocation.lat,
        gps_longitude: gpsLocation.lng,
        gps_address: fullAddress,
        family_count: familyCount,
        has_elderly: vulnerable.elderly,
        has_toddler: vulnerable.toddler,
        has_disability: vulnerable.disability,
        has_pregnant: vulnerable.pregnant,
        photo_url: finalPhotoUrl,
        is_simulation: isSim
      };
      const res = await createSOSTicket(payload);
      setTicket(res);
      setStep(3);
      // Auto add to myTickets list
      setMyTickets(prev => [res, ...prev]);
    } catch (err) {
      // Jika status darurat belum diaktifkan admin di database, auto fallback kirim sebagai simulasi/demo
      if (err.message && err.message.toLowerCase().includes('belum berstatus darurat')) {
        try {
          const fallbackPayload = {
            reporter_id: user?.id || 1,
            village_id: user?.village_id || 3,
            gps_latitude: gpsLocation.lat,
            gps_longitude: gpsLocation.lng,
            gps_address: fullAddress,
            family_count: familyCount,
            has_elderly: vulnerable.elderly,
            has_toddler: vulnerable.toddler,
            has_disability: vulnerable.disability,
            has_pregnant: vulnerable.pregnant,
            photo_url: finalPhotoUrl,
            is_simulation: true
          };
          const fallbackRes = await createSOSTicket(fallbackPayload);
          setTicket(fallbackRes);
          setStep(3);
          setMyTickets(prev => [fallbackRes, ...prev]);
          return;
        } catch (retryErr) {
          alert('Gagal mengirim SOS: ' + (retryErr.message || 'Terjadi kesalahan'));
          return;
        }
      }
      alert('Gagal mengirim SOS: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return <span className="status-badge-pill status-waspada">Menunggu Verifikasi</span>;
      case 'verified':
        return <span className="status-badge-pill status-siaga">Terverifikasi</span>;
      case 'dispatched':
        return <span className="status-badge-pill status-awas">Armada Meluncur</span>;
      case 'arrived':
        return <span className="status-badge-pill" style={{ background: '#f3e8ff', color: '#7e22ce' }}>Tiba di Lokasi</span>;
      case 'completed':
        return <span className="status-badge-pill status-aman">Selesai</span>;
      case 'rejected':
        return <span className="status-badge-pill" style={{ background: '#fee2e2', color: '#b91c1c' }}>Dibatalkan</span>;
      default:
        return <span className="status-badge-pill">{status}</span>;
    }
  };

  const renderTrackerSteps = (currentStatus, assignedUnit) => {
    const stepsConfig = [
      { key: 'submitted', title: '1. Tiket Diterima', desc: 'Menunggu konfirmasi petugas Pusdalops BPBD' },
      { key: 'verified', title: '2. Terverifikasi', desc: 'Petugas sedang menyusun koordinasi regu lapangan' },
      { key: 'dispatched', title: '3. Armada Bergerak', desc: assignedUnit ? `Armada ditugaskan: ${assignedUnit}` : 'Perahu karet & personel SAR dalam perjalanan' },
      { key: 'arrived', title: '4. Tiba di Lokasi', desc: 'Tim SAR telah tiba di titik evakuasi Anda' },
      { key: 'completed', title: '5. Selesai Evakuasi', desc: 'Warga telah dievakuasi ke tempat aman/posko' },
    ];

    const order = ['submitted', 'verified', 'dispatched', 'arrived', 'completed'];
    const currentIndex = order.indexOf(currentStatus);

    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {stepsConfig.map((s, idx) => {
          const isDone = currentIndex >= idx;
          const isCurrent = currentIndex === idx;

          return (
            <div key={s.key} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative' }}>
              {idx < stepsConfig.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: '14px',
                  top: '28px',
                  bottom: '-14px',
                  width: '2px',
                  background: isDone && !isCurrent ? '#10b981' : '#e2e8f0',
                  zIndex: 1
                }} />
              )}
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: isDone ? (isCurrent ? '#dc2626' : '#10b981') : '#f1f5f9',
                color: isDone ? 'white' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                flexShrink: 0,
                zIndex: 2,
                boxShadow: isCurrent ? '0 0 0 4px rgba(220, 38, 38, 0.2)' : 'none'
              }}>
                {isDone && !isCurrent ? '✓' : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: isCurrent ? 800 : 700, color: isCurrent ? '#dc2626' : (isDone ? '#0c1a24' : '#64748b'), fontSize: '0.88rem' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: isDone ? '#475569' : '#94a3b8', marginTop: '2px' }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="warga-sos-view">
      {/* Top Action Row: Back & Live Clock */}
      <div className="sos-top-actions">
        <button 
          type="button"
          onClick={() => onNavigate('beranda')} 
          className="sos-back-btn"
          title="Kembali ke halaman utama"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Kembali ke Beranda</span>
        </button>

        <div className="sos-clock-badge">
          <span className="sos-pulse-dot" />
          <span>Waktu Pelaporan Real:</span>
          <strong style={{ color: 'var(--warga-navy)' }}>{formatWIBDateTime(currentClock, true)}</strong>
        </div>
      </div>

      {/* Header Title */}
      <div className="peta-posko-kicker">Layanan Tanggap Darurat</div>
      <h1 className="peta-posko-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>Permintaan Evakuasi (SOS)</span>
        <span className="sos-priority-tag">Prioritas Tinggi</span>
      </h1>

      {/* Segmented Tab Switcher */}
      <div className="sos-segmented-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`sos-segmented-tab tab-danger ${activeTab === 'create' ? 'active' : ''}`}
        >
          <span>🚨 Buat Tiket SOS Baru</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`sos-segmented-tab ${activeTab === 'history' ? 'active' : ''}`}
        >
          <span>📋 Riwayat & Status Tiket {myTickets.length > 0 && `(${myTickets.length})`}</span>
        </button>
      </div>

      {/* TAB 1: FORM SOS BARU */}
      {activeTab === 'create' && (
        <div className="sos-card">
          {/* Multi-step Horizontal Stepper */}
          <div className="sos-stepper-wrap">
            <div className={`sos-step-indicator ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
              <div className="sos-step-circle">{step > 1 ? '✓' : '1'}</div>
              <span className="sos-step-label">Lokasi GPS</span>
            </div>
            <div className={`sos-step-indicator ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
              <div className="sos-step-circle">{step > 2 ? '✓' : '2'}</div>
              <span className="sos-step-label">Data Evakuasi</span>
            </div>
            <div className={`sos-step-indicator ${step === 3 ? 'active' : ''}`}>
              <div className="sos-step-circle">3</div>
              <span className="sos-step-label">Pelacakan</span>
            </div>
          </div>

          {/* Quick Simulation Data Fill Banner */}
          {step < 3 && (
            <div className="sos-simulation-card">
              <div className="sos-sim-text">
                <strong>
                  <span>🧪</span> Mode Pengujian Skenario Banjir
                </strong>
                <p>
                  Isi otomatis formulir dengan data skenario luapan sungai untuk menguji alur penanganan darurat.
                </p>
              </div>
              <button
                type="button"
                className="btn-fill-sim"
                onClick={() => {
                  setFamilyCount(4);
                  setVulnerable({ elderly: true, toddler: true, pregnant: false, disability: false });
                  setDetailPatokan('Air luapan sungai masuk ke dalam rumah setinggi 1.5 meter, arus deras, butuh evakuasi perahu karet segera!');
                  if (!gpsLocation) {
                    setGpsLocation({ lat: -7.1285, lng: 112.104 });
                    setAddress('Bantaran Bengawan Solo, RT 02 / RW 01, Desa Baureno, Kec. Baureno');
                  }
                }}
              >
                <span>⚡ Isi Otomatis Simulasi</span>
              </button>
            </div>
          )}

          {/* STEP 1: GPS & LOKASI */}
          {step === 1 && (
            <div className="sos-step">
              <h3 className="sos-section-title">1. Konfirmasi Titik Lokasi Anda</h3>
              <p className="sos-section-desc">
                Sistem mendeteksi koordinat GPS perangkat Anda secara real time. Anda dapat menggeser pin merah atau mengetuk peta untuk mengatur titik evakuasi secara akurat.
              </p>
              
              {/* Mini Map */}
              <div style={{ height: '280px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', border: '1.5px solid var(--warga-border)', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {gpsLocation ? (
                  <MapContainer center={[gpsLocation.lat, gpsLocation.lng]} zoom={16} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapPanController center={gpsLocation} />
                    <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                    <Marker 
                      position={[gpsLocation.lat, gpsLocation.lng]} 
                      icon={userPinIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          handleMapLocationSelect(pos.lat, pos.lng);
                        }
                      }}
                    >
                      <Popup>
                        <div style={{ textAlign: 'center', fontSize: '12px' }}>
                          <strong style={{ color: '#dc2626' }}>📍 Titik Evakuasi</strong><br />
                          <span>{address}</span><br />
                          <small style={{ color: '#64748b' }}>Geser pin atau klik peta untuk memindahkan</small>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', gap: '8px' }}>
                    <div style={{ width: '26px', height: '26px', border: '3px solid #cbd5e1', borderTopColor: 'var(--warga-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>📡 Mengunci koordinat GPS perangkat Anda...</span>
                  </div>
                )}
                
                {/* Floating Map Hint */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 999,
                  background: 'rgba(15, 23, 42, 0.78)',
                  backdropFilter: 'blur(4px)',
                  color: 'white',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>🎯 Klik peta / geser pin untuk atur titik</span>
                </div>
              </div>

              {/* Status Lokasi & Detail GPS Card */}
              <div className="sos-location-card">
                <div className="sos-location-head">
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div className="sos-location-label">Alamat Terdeteksi:</div>
                    <div className="sos-location-address">
                      📍 {address}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={detectGPS}
                    disabled={loadingGps}
                    className="btn-refresh-gps"
                  >
                    {loadingGps ? '📡 Mencari...' : '🔄 Refresh GPS'}
                  </button>
                </div>

                {gpsLocation && (
                  <div className="sos-coords-strip">
                    <span><strong>Lat:</strong> {gpsLocation.lat.toFixed(6)}</span>
                    <span><strong>Lng:</strong> {gpsLocation.lng.toFixed(6)}</span>
                    {gpsAccuracy && <span><strong>Akurasi:</strong> ±{Math.round(gpsAccuracy)}m</span>}
                    <span className={`sos-source-badge ${locationSource === 'real_gps' ? 'gps' : locationSource === 'manual' ? 'manual' : 'ip'}`}>
                      {locationSource === 'real_gps' ? '● Lokasi Perangkat Real (GPS)' : locationSource === 'manual' ? '● Titik Disesuaikan Manual' : '● Lokasi Jaringan (IP)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Detail Patokan Input */}
              <div className="sos-form-group">
                <label className="sos-form-label">
                  Patokan / Alamat Lengkap Tambahan (Opsional)
                </label>
                <input 
                  type="text" 
                  className="sos-input-text"
                  placeholder="Contoh: Depan Musala Nurul Huda RT 03 / Rumah pagar biru dekat balai desa"
                  value={detailPatokan}
                  onChange={(e) => setDetailPatokan(e.target.value)}
                />
              </div>

              {/* Next Button */}
              <div className="sos-action-row">
                <button 
                  type="button"
                  onClick={() => setStep(2)} 
                  disabled={!gpsLocation}
                  className="btn-sos-primary"
                  style={{ width: '100%', flex: 'none' }}
                >
                  <span>Lanjutkan ke Data Evakuasi</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DATA KORBAN & FOTO */}
          {step === 2 && (
            <div className="sos-step">
              <h3 className="sos-section-title">2. Data Rombongan & Kelompok Rentan</h3>
              <p className="sos-section-desc">
                Data ini menentukan skor prioritas penyelamatan dan kapasitas perahu SAR yang ditugaskan ke lokasi Anda.
              </p>
              
              {/* Jumlah Anggota Keluarga Stepper */}
              <div className="sos-form-group">
                <label className="sos-form-label">
                  Jumlah Jiwa yang Perlu Dievakuasi
                </label>
                <div className="sos-counter-box">
                  <span style={{ fontSize: '0.85rem', color: 'var(--warga-text-muted)', fontWeight: 600 }}>
                    Total anggota keluarga di lokasi:
                  </span>
                  <div className="sos-counter-controls">
                    <button
                      type="button"
                      className="sos-counter-btn"
                      onClick={() => setFamilyCount(Math.max(1, familyCount - 1))}
                      title="Kurangi"
                    >
                      −
                    </button>
                    <span className="sos-counter-num">{familyCount}</span>
                    <button
                      type="button"
                      className="sos-counter-btn"
                      onClick={() => setFamilyCount(Math.min(50, familyCount + 1))}
                      title="Tambah"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="sos-preset-row">
                  {[1, 2, 4, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`sos-preset-chip ${familyCount === num ? 'active' : ''}`}
                      onClick={() => setFamilyCount(num)}
                    >
                      {num === 6 ? '6+ Jiwa' : `${num} Jiwa`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kelompok Rentan Selectable Grid */}
              <div className="sos-form-group">
                <label className="sos-form-label">
                  Kelompok Rentan (Pilih jika ada anggota keluarga di lokasi):
                </label>
                <div className="sos-vulnerable-grid">
                  {/* Lansia */}
                  <div 
                    className={`sos-vulnerable-card ${vulnerable.elderly ? 'selected' : ''}`}
                    onClick={() => setVulnerable(prev => ({ ...prev, elderly: !prev.elderly }))}
                  >
                    <div className="sos-vuln-left">
                      <span className="sos-vuln-icon">👵</span>
                      <div className="sos-vuln-info">
                        <strong>Lansia (&gt;60 th)</strong>
                        <span>Butuh bantuan mobilitas</span>
                      </div>
                    </div>
                    <span className="sos-vuln-badge">+5 Poin</span>
                  </div>

                  {/* Balita */}
                  <div 
                    className={`sos-vulnerable-card ${vulnerable.toddler ? 'selected' : ''}`}
                    onClick={() => setVulnerable(prev => ({ ...prev, toddler: !prev.toddler }))}
                  >
                    <div className="sos-vuln-left">
                      <span className="sos-vuln-icon">👶</span>
                      <div className="sos-vuln-info">
                        <strong>Balita / Anak</strong>
                        <span>Butuh rompi pelampung anak</span>
                      </div>
                    </div>
                    <span className="sos-vuln-badge">+5 Poin</span>
                  </div>

                  {/* Ibu Hamil */}
                  <div 
                    className={`sos-vulnerable-card ${vulnerable.pregnant ? 'selected' : ''}`}
                    onClick={() => setVulnerable(prev => ({ ...prev, pregnant: !prev.pregnant }))}
                  >
                    <div className="sos-vuln-left">
                      <span className="sos-vuln-icon">🤰</span>
                      <div className="sos-vuln-info">
                        <strong>Ibu Hamil</strong>
                        <span>Prioritas medis & ambulans</span>
                      </div>
                    </div>
                    <span className="sos-vuln-badge">+5 Poin</span>
                  </div>

                  {/* Disabilitas */}
                  <div 
                    className={`sos-vulnerable-card ${vulnerable.disability ? 'selected' : ''}`}
                    onClick={() => setVulnerable(prev => ({ ...prev, disability: !prev.disability }))}
                  >
                    <div className="sos-vuln-left">
                      <span className="sos-vuln-icon">♿</span>
                      <div className="sos-vuln-info">
                        <strong>Disabilitas / Sakit</strong>
                        <span>Butuh tandu evakuasi</span>
                      </div>
                    </div>
                    <span className="sos-vuln-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>+10 Poin</span>
                  </div>
                </div>
              </div>

              {/* DOKUMENTASI FOTO SITUASI BANJIR */}
              <div className="sos-photo-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="sos-form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📸</span> Foto Situasi Genangan / Banjir (Opsional)
                  </label>
                  <span className="sos-source-badge gps">
                    Sangat Dianjurkan
                  </span>
                </div>
                <p style={{ margin: '0 0 14px 0', color: 'var(--warga-text-muted)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  Dokumentasi visual ketinggian air dan kondisi lingkungan sekitar membantu tim BPBD menyiapkan armada penyelamat serta menentukan rute evakuasi yang tepat.
                </p>

                {/* Hidden File Inputs */}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={cameraInputRef} 
                  onChange={handlePhotoSelect} 
                  style={{ display: 'none' }} 
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={galleryInputRef} 
                  onChange={handlePhotoSelect} 
                  style={{ display: 'none' }} 
                />

                {/* Live Camera Viewfinder */}
                {isCameraActive ? (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000000', border: '2px solid #dc2626', boxShadow: '0 8px 24px rgba(220, 38, 38, 0.25)' }}>
                    {cameraFlash && (
                      <div style={{ position: 'absolute', inset: 0, background: '#ffffff', zIndex: 30, opacity: 0.85, transition: 'opacity 0.2s' }} />
                    )}

                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} 
                    />

                    {/* Viewfinder HUD Overlays */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                      <span style={{ background: 'rgba(220, 38, 38, 0.85)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'pulseDotNearest 1.2s infinite' }} />
                        KAMERA AKTIF
                      </span>

                      <button
                        type="button"
                        onClick={switchCamera}
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        🔄 Beralih Kamera
                      </button>
                    </div>

                    <div style={{ position: 'absolute', inset: '40px', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: '10px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '40px', height: '40px', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%' }} />
                    </div>

                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                      <button
                        type="button"
                        onClick={stopLiveCamera}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Batal
                      </button>

                      <button
                        type="button"
                        onClick={capturePhotoFromCamera}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: '4px solid #dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)'
                        }}
                        title="Ambil foto"
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px' }}>
                          📸
                        </div>
                      </button>

                      <div style={{ width: '60px' }} />
                    </div>
                  </div>
                ) : cameraError ? (
                  <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '13px', marginBottom: '4px' }}>
                      ⚠️ Akses Kamera Terkendala
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#991b1b' }}>
                      {cameraError}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => startLiveCamera(cameraFacing)}
                        className="btn-sos-primary"
                        style={{ padding: '6px 14px', fontSize: '12px', flex: 'none' }}
                      >
                        Coba Lagi
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="btn-sos-secondary"
                        style={{ padding: '6px 14px', fontSize: '12px', flex: 'none' }}
                      >
                        Pilih dari File
                      </button>
                    </div>
                  </div>
                ) : !photoPreview ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => startLiveCamera(cameraFacing)}
                      className="btn-open-camera"
                    >
                      <span style={{ fontSize: '20px' }}>📸</span>
                      <span>Ambil Foto Langsung dengan Kamera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="btn-open-gallery"
                    >
                      <span>📁</span>
                      <span>Pilih Foto dari Galeri / Dokumen</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #10b981', background: '#0f172a' }}>
                    <img 
                      src={photoPreview} 
                      alt="Hasil Foto Banjir" 
                      style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                      onClick={() => setLightboxPhoto(photoPreview)}
                    />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px', background: 'rgba(15, 23, 42, 0.88)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        <span style={{ color: '#4ade80' }}>✓</span> Foto Siap Dikirim
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => startLiveCamera(cameraFacing)}
                          style={{ background: 'var(--warga-teal)', border: 'none', color: 'white', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                        >
                          📷 Ambil Ulang
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          style={{ background: '#dc2626', border: 'none', color: 'white', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Back & Submit */}
              <div className="sos-action-row">
                <button 
                  type="button"
                  onClick={() => setStep(1)} 
                  className="btn-sos-secondary"
                >
                  ← Kembali ke Lokasi
                </button>
                <button 
                  type="button"
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="btn-sos-danger-submit"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>{loading ? 'Mengirim Data...' : 'KIRIM PERMINTAAN SOS'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: TIKET BERHASIL & TRACKING LIVE */}
          {step === 3 && ticket && (
            <div className="sos-step">
              <div className="sos-success-hero">
                <div className="sos-success-icon">✓</div>
                <h3 className="sos-section-title" style={{ color: '#15803d' }}>
                  Permintaan SOS Berhasil Dikirim!
                </h3>
                <p className="sos-section-desc" style={{ marginBottom: 0 }}>
                  Laporan darurat Anda telah masuk ke monitor Pusdalops BPBD Baureno.
                </p>
              </div>

              {/* Summary Card */}
              <div className="sos-ticket-summary-card">
                <div className="sos-ticket-summary-row">
                  <span style={{ color: 'var(--warga-text-muted)' }}>Nomor Tiket:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--warga-navy)' }}>
                    {ticket.ticket_number}
                  </span>
                </div>
                <div className="sos-ticket-summary-row">
                  <span style={{ color: 'var(--warga-text-muted)' }}>Waktu Terkirim:</span>
                  <span style={{ fontWeight: 700, color: 'var(--warga-navy)' }}>
                    {formatWIBDateTime(ticket.submitted_at || new Date())}
                  </span>
                </div>
                <div className="sos-ticket-summary-row">
                  <span style={{ color: 'var(--warga-text-muted)' }}>Jumlah Korban:</span>
                  <span style={{ fontWeight: 700, color: 'var(--warga-navy)' }}>
                    {ticket.family_count} Jiwa
                  </span>
                </div>
                <div className="sos-ticket-summary-row">
                  <span style={{ color: 'var(--warga-text-muted)' }}>Status Saat Ini:</span>
                  {getStatusBadge(ticket.status)}
                </div>

                {ticket.photo_url && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--warga-border)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--warga-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                      📷 Foto Situasi yang Dikirim:
                    </span>
                    <img 
                      src={ticket.photo_url.startsWith('http') || ticket.photo_url.startsWith('data:') ? ticket.photo_url : `http://localhost:8000${ticket.photo_url}`} 
                      alt="Foto Lokasi" 
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--warga-border)', cursor: 'pointer' }}
                      onClick={() => setLightboxPhoto(ticket.photo_url.startsWith('http') || ticket.photo_url.startsWith('data:') ? ticket.photo_url : `http://localhost:8000${ticket.photo_url}`)}
                    />
                  </div>
                )}
              </div>

              {/* Real-time Tracking Stepper */}
              <div className="sos-tracker-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0f2fe', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#0369a1', fontSize: '0.92rem', fontWeight: 800 }}>
                    📡 Pelacakan Evakuasi Real-time
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="sos-pulse-dot" style={{ background: '#0284c7' }} /> Terhubung Live
                  </span>
                </div>
                {renderTrackerSteps(ticket.status, ticket.assigned_unit)}
              </div>

              {/* Call 112 Hotline Box */}
              <div className="sos-call-112-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.4rem' }}>📞</span>
                  <div>
                    <strong style={{ color: '#b91c1c', display: 'block', fontSize: '0.85rem' }}>
                      Butuh bantuan langsung via telepon?
                    </strong>
                    <span style={{ color: '#7f1d1d', fontSize: '0.76rem' }}>
                      Tetap di tempat tinggi, hubungi petugas siaga darurat:
                    </span>
                  </div>
                </div>
                <a 
                  href="tel:112" 
                  className="btn-fill-sim"
                  style={{ textDecoration: 'none' }}
                >
                  Panggil 112 (Bebas Pulsa)
                </a>
              </div>

              <button
                type="button"
                onClick={() => { setStep(1); setTicket(null); setPhotoFile(null); setPhotoPreview(null); setPhotoBase64(null); }}
                className="btn-sos-secondary"
                style={{ width: '100%' }}
              >
                + Buat Laporan SOS Baru Lainnya
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT & STATUS TIKET WARGA */}
      {activeTab === 'history' && (
        <div className="sos-card">
          <div className="sos-card-head">
            <h2 className="sos-card-title">
              📋 Riwayat & Status Tiket SOS Anda
            </h2>
            <button
              type="button"
              onClick={loadMyTickets}
              className="btn-refresh-gps"
            >
              🔄 Segarkan Data
            </button>
          </div>

          {/* Search bar & Filter Pills for My Tickets */}
          {myTickets.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid var(--warga-border)'
            }}>
              {/* Search Input */}
              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
                <input
                  type="text"
                  placeholder="Cari kode tiket (SOS-2026-...) ..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="sos-input-text"
                  style={{ padding: '8px 12px 8px 34px', fontSize: '0.82rem' }}
                />
                <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }}>
                  🔍
                </span>
                {ticketSearch && (
                  <button
                    type="button"
                    onClick={() => setTicketSearch('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setTicketFilterStatus('all')}
                  className={`sos-preset-chip ${ticketFilterStatus === 'all' ? 'active' : ''}`}
                >
                  Semua ({myTickets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFilterStatus('waiting')}
                  className={`sos-preset-chip ${ticketFilterStatus === 'waiting' ? 'active' : ''}`}
                >
                  Menunggu ({myTickets.filter(t => t.status === 'submitted').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFilterStatus('process')}
                  className={`sos-preset-chip ${ticketFilterStatus === 'process' ? 'active' : ''}`}
                >
                  Diproses ({myTickets.filter(t => ['verified', 'dispatched', 'arrived'].includes(t.status)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFilterStatus('completed')}
                  className={`sos-preset-chip ${ticketFilterStatus === 'completed' ? 'active' : ''}`}
                >
                  Selesai ({myTickets.filter(t => t.status === 'completed').length})
                </button>
              </div>
            </div>
          )}

          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--warga-text-muted)' }}>
              ⏳ Memuat riwayat tiket evakuasi...
            </div>
          ) : myTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--warga-border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛡️</div>
              <h3 style={{ color: 'var(--warga-navy)', margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800 }}>Belum Ada Tiket SOS</h3>
              <p style={{ color: 'var(--warga-text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Anda belum pernah mengajukan tiket evakuasi darurat.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="btn-sos-danger-submit"
                style={{ marginTop: '16px', padding: '10px 20px', fontSize: '0.82rem' }}
              >
                🚨 Buat Permintaan SOS
              </button>
            </div>
          ) : filteredMyTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--warga-border)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🔍</div>
              <h4 style={{ color: 'var(--warga-navy)', margin: '0 0 4px 0', fontWeight: 800 }}>Tidak Ada Tiket yang Cocok</h4>
              <p style={{ color: 'var(--warga-text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Tidak ditemukan tiket dengan kata kunci "{ticketSearch}".
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredMyTickets.map((t) => (
                <div 
                  key={t.id} 
                  style={{
                    border: '1px solid var(--warga-border)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    background: t.status === 'dispatched' ? '#fffdf5' : '#ffffff',
                    boxShadow: '0 2px 8px rgba(12, 26, 36, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--warga-navy)', marginRight: '10px' }}>
                        {t.ticket_number}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--warga-text-muted)' }}>
                        {formatWIBDateTime(t.submitted_at)}
                      </span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <div style={{ fontSize: '0.84rem', color: 'var(--warga-text-body)', lineHeight: 1.5, marginBottom: '8px' }}>
                    <div>📍 <strong>Lokasi:</strong> {t.gps_address}</div>
                    <div>👥 <strong>Jumlah Korban:</strong> {t.family_count} Jiwa {t.has_elderly ? '• Lansia' : ''} {t.has_toddler ? '• Balita' : ''} {t.has_pregnant ? '• Ibu Hamil' : ''} {t.has_disability ? '• Disabilitas' : ''}</div>
                    {t.assigned_unit && (
                      <div style={{ color: '#b45309', fontWeight: 700, marginTop: '4px' }}>
                        🚤 <strong>Armada Ditugaskan:</strong> {t.assigned_unit}
                      </div>
                    )}
                  </div>

                  {/* Foto Terlampir di Riwayat */}
                  {t.photo_url && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--warga-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`} 
                        alt="Foto Tiket" 
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--warga-border)', cursor: 'pointer' }}
                        onClick={() => setLightboxPhoto(t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`)}
                      />
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warga-navy)', display: 'block' }}>📷 Foto Situasi Banjir</span>
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`)}
                          style={{ background: 'none', border: 'none', color: 'var(--warga-teal)', fontSize: '0.74rem', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 700 }}
                        >
                          Lihat Ukuran Penuh ↗
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tracker Stepper for In-Progress Tickets */}
                  {['submitted', 'verified', 'dispatched', 'arrived'].includes(t.status) && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--warga-border)' }}>
                      {renderTrackerSteps(t.status, t.assigned_unit)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal untuk Melihat Foto Penuh */}
      {lightboxPhoto && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setLightboxPhoto(null)}
        >
          <div style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
            <img 
              src={lightboxPhoto} 
              alt="Foto Situasi Penuh" 
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'block' }} 
            />
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              style={{ position: 'absolute', top: '-14px', right: '-14px', background: '#dc2626', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
