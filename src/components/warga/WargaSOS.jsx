import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { createSOSTicket, getMyTickets, uploadSOSPhoto } from '../../services/sosService';
import wsService from '../../services/wsService';
import { useAuth } from '../../context/AuthContext';

import useGeolocation from '../../hooks/useGeolocation';

const userPinIcon = L.divIcon({
  className: 'custom-sos-pin',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(220, 38, 38, 0.4); animation: pulse 1.5s infinite;"></div>
      <div style="background-color: #dc2626; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
        📍
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function WargaSOS({ onNavigate, geo: externalGeo }) {
  const { user } = useAuth();
  const internalGeo = useGeolocation();
  const geo = externalGeo || internalGeo;

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  
  // Riwayat tiket warga
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

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

  // Sinkronkan GPS otomatis saat terdeteksi
  useEffect(() => {
    if (geo?.position?.latitude && geo?.position?.longitude) {
      setGpsLocation({ lat: geo.position.latitude, lng: geo.position.longitude });
      if (geo.fullAddress || geo.address) {
        setAddress(geo.fullAddress || geo.address);
      }
    }
  }, [geo?.position?.latitude, geo?.position?.longitude, geo?.fullAddress, geo?.address]);

  // Handler Refresh GPS
  const detectGPS = () => {
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
    wsService.connect('alerts');

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
        const file = new File([blob], `sos_jepret_${Date.now()}.jpg`, { type: 'image/jpeg' });
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

      const fullAddress = detailPatokan.trim() 
        ? `${address} (Patokan: ${detailPatokan.trim()})`
        : address;

      const payload = {
        reporter_id: user?.id || 1,
        village_id: user?.village_id || 1,
        gps_latitude: gpsLocation.lat,
        gps_longitude: gpsLocation.lng,
        gps_address: fullAddress,
        family_count: familyCount,
        has_elderly: vulnerable.elderly,
        has_toddler: vulnerable.toddler,
        has_disability: vulnerable.disability,
        has_pregnant: vulnerable.pregnant,
        photo_url: finalPhotoUrl
      };
      const res = await createSOSTicket(payload);
      setTicket(res);
      setStep(3);
      // Auto add to myTickets list
      setMyTickets(prev => [res, ...prev]);
    } catch (err) {
      alert('Gagal mengirim SOS: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Menunggu Verifikasi</span>;
      case 'verified':
        return <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Terverifikasi</span>;
      case 'dispatched':
        return <span style={{ background: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Armada Meluncur</span>;
      case 'arrived':
        return <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Tiba di Lokasi</span>;
      case 'completed':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Selesai</span>;
      case 'rejected':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Dibatalkan</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>{status}</span>;
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
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {stepsConfig.map((s, idx) => {
          const isDone = currentIndex >= idx;
          const isCurrent = currentIndex === idx;

          return (
            <div key={s.key} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isDone ? (isCurrent ? '#dc2626' : '#16a34a') : '#e2e8f0',
                color: isDone ? 'white' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '12px',
                flexShrink: 0,
                boxShadow: isCurrent ? '0 0 0 4px rgba(220, 38, 38, 0.2)' : 'none'
              }}>
                {isDone && !isCurrent ? '✓' : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: isCurrent ? 'bold' : '600', color: isCurrent ? '#dc2626' : (isDone ? '#1e293b' : '#94a3b8') }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '12px', color: isDone ? '#64748b' : '#94a3b8' }}>
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
    <div className="warga-main" style={{ maxWidth: '820px', margin: '0 auto', paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <button 
        onClick={() => onNavigate('beranda')} 
        style={{ marginBottom: '16px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
      >
        ← Kembali ke Beranda
      </button>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'create' ? '#ffffff' : 'transparent',
            color: activeTab === 'create' ? '#dc2626' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: activeTab === 'create' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          🚨 Buat Tiket SOS Baru
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'history' ? '#ffffff' : 'transparent',
            color: activeTab === 'history' ? '#2563eb' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📋 Status & Riwayat Tiket Saya {myTickets.length > 0 && `(${myTickets.length})`}
        </button>
      </div>

      {/* TAB 1: FORM SOS BARU */}
      {activeTab === 'create' && (
        <article className="portal-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#dc2626', margin: 0, fontSize: '1.4rem' }}>
              🚨 Permintaan Evakuasi Darurat (SOS)
            </h2>
            <span style={{ fontSize: '12px', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Prioritas Tinggi
            </span>
          </div>

          {/* STEP 1: GPS & LOKASI */}
          {step === 1 && (
            <div className="sos-step">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Langkah 1: Konfirmasi Lokasi Anda</h3>
              <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '13px' }}>
                Sistem mengunci koordinat GPS perangkat Anda untuk memandu perahu penyelamat dan armada BPBD langsung ke lokasi.
              </p>
              
              {/* Mini Map */}
              <div style={{ height: '240px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #cbd5e1', position: 'relative' }}>
                {gpsLocation ? (
                  <MapContainer center={[gpsLocation.lat, gpsLocation.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[gpsLocation.lat, gpsLocation.lng]} icon={userPinIcon}>
                      <Popup>Posisi Anda Terkunci</Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
                    📡 Mencari sinyal GPS...
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  📍 {address}
                </span>
                <button
                  type="button"
                  onClick={detectGPS}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔄 Refresh GPS
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: '#334155' }}>
                  Patokan / Alamat Lengkap Tambahan (Opsional)
                </label>
                <input 
                  type="text" 
                  placeholder="Contoh: Depan Musala Nurul Huda RT 03 / Rumah atap biru"
                  value={detailPatokan}
                  onChange={(e) => setDetailPatokan(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <button 
                onClick={() => setStep(2)} 
                disabled={!gpsLocation}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: gpsLocation ? 'pointer' : 'not-allowed',
                  fontSize: '14px'
                }}
              >
                Lanjutkan ke Data Evakuasi →
              </button>
            </div>
          )}

          {/* STEP 2: DATA KORBAN */}
          {step === 2 && (
            <div className="sos-step">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Langkah 2: Data Rombongan &amp; Kelompok Rentan</h3>
              <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '13px' }}>
                Data ini menentukan skor prioritas penyelamatan dan kapasitas perahu SAR yang ditugaskan.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Jumlah Anggota Keluarga / Jiwa
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="50"
                  value={familyCount} 
                  onChange={(e) => setFamilyCount(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
                />
              </div>

              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '10px', fontSize: '13px', color: '#1e293b' }}>
                  Kelompok Rentan (Centang jika ada):
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.elderly} onChange={e => setVulnerable({...vulnerable, elderly: e.target.checked})} />
                  <span>👵 Lansia (&gt;60 tahun) (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.toddler} onChange={e => setVulnerable({...vulnerable, toddler: e.target.checked})} />
                  <span>👶 Balita / Anak-anak (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.pregnant} onChange={e => setVulnerable({...vulnerable, pregnant: e.target.checked})} />
                  <span>🤰 Ibu Hamil (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.disability} onChange={e => setVulnerable({...vulnerable, disability: e.target.checked})} />
                  <span>♿ Penyandang Disabilitas / Sakit Parah (+10 poin prioritas)</span>
                </label>
              </div>

              {/* UPLOAD / NGEFOTO SITUASI BANJIR */}
              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📸</span> Foto Situasi / Banjir Saat Ini (Opsional)
                  </label>
                  <span style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                    Sangat Dianjurkan
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '12px', lineHeight: 1.4 }}>
                  Ngefoto ketinggian air atau lingkungan sekitar rumah membantu petugas BPBD menyiapkan armada perahu dan rute evakuasi yang tepat.
                </p>

                {/* Input File Tersembunyi */}
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
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000000', border: '2px solid #dc2626', boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.3)' }}>
                    {/* Flash shutter effect overlay */}
                    {cameraFlash && (
                      <div style={{ position: 'absolute', inset: 0, background: '#ffffff', zIndex: 30, opacity: 0.85, transition: 'opacity 0.2s' }} />
                    )}

                    {/* Live Video Feed */}
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '340px', objectFit: 'cover', display: 'block' }} 
                    />

                    {/* Viewfinder HUD Overlays */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                      <span style={{ background: 'rgba(220, 38, 38, 0.85)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em' }}>
                        <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'notifPulse 1.2s infinite' }} />
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
                        title="Balik ke kamera depan/belakang"
                      >
                        🔄 Putar Kamera
                      </button>
                    </div>

                    {/* Reticle Focus Marks */}
                    <div style={{ position: 'absolute', inset: '40px', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: '10px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '40px', height: '40px', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%' }} />
                    </div>

                    {/* Bottom Controls Bar */}
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
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Batal
                      </button>

                      {/* Main Shutter Button */}
                      <button
                        type="button"
                        onClick={capturePhotoFromCamera}
                        style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: '4px solid #dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)',
                          transition: 'transform 0.1s'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        title="Klik untuk menjepret foto sekarang"
                      >
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px' }}>
                          📸
                        </div>
                      </button>

                      <div style={{ width: '60px' }} />
                    </div>
                  </div>
                ) : cameraError ? (
                  <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                      ⚠️ Akses Kamera Terkendala
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#991b1b' }}>
                      {cameraError}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => startLiveCamera(cameraFacing)}
                        style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Coba Buka Kamera Lagi
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        style={{ padding: '6px 12px', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Pilih dari File
                      </button>
                    </div>
                  </div>
                ) : !photoPreview ? (
                  <div>
                    {/* Big Action: Snap with Live Camera */}
                    <button
                      type="button"
                      onClick={() => startLiveCamera(cameraFacing)}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                        marginBottom: '10px',
                        transition: 'transform 0.15s'
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <span style={{ fontSize: '26px' }}>📸</span>
                      <div style={{ textAlign: 'left' }}>
                        <strong style={{ display: 'block', fontSize: '14px', letterSpacing: '0.02em' }}>
                          BUKA KAMERA &amp; JEPRET LANGSUNG
                        </strong>
                        <small style={{ fontSize: '11px', opacity: 0.9 }}>
                          Ngefoto langsung situasi banjir via kamera perangkat
                        </small>
                      </div>
                    </button>

                    <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px' }}>
                        atau jika sudah ada foto:
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>🖼️</span>
                      <span>Pilih Foto dari Galeri / Berkas</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #16a34a', background: '#0f172a' }}>
                    <img 
                      src={photoPreview} 
                      alt="Hasil Foto Banjir" 
                      style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                      onClick={() => setLightboxPhoto(photoPreview)}
                    />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px', background: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        <span style={{ color: '#4ade80', fontSize: '16px' }}>✓</span> Foto Berhasil Dijepret &amp; Terkunci
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => startLiveCamera(cameraFacing)}
                          style={{ background: '#2563eb', border: 'none', color: 'white', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                        >
                          📷 Jepret Ulang
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setStep(1)} 
                  style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ← Kembali
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  style={{ flex: 2, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {loading ? 'Mengirim Data...' : '🚨 KIRIM PERMINTAAN SOS'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: TIKET BERHASIL & TRACKING LIVE */}
          {step === 3 && ticket && (
            <div className="sos-step">
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '4px' }}>✅</div>
                <h3 style={{ color: '#16a34a', margin: 0 }}>Permintaan SOS Terkirim!</h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>Data Anda telah diterima di Pusdalops BPBD Baureno.</p>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Nomor Tiket:</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{ticket.ticket_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Jumlah Korban:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{ticket.family_count} Jiwa</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Status Saat Ini:</span>
                  {getStatusBadge(ticket.status)}
                </div>

                {/* Foto Terlampir di Step 3 */}
                {ticket.photo_url && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                      📷 Foto Situasi yang Dikirim ke Petugas:
                    </span>
                    <img 
                      src={ticket.photo_url.startsWith('http') || ticket.photo_url.startsWith('data:') ? ticket.photo_url : `http://localhost:8000${ticket.photo_url}`} 
                      alt="Foto Lokasi" 
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                      onClick={() => setLightboxPhoto(ticket.photo_url.startsWith('http') || ticket.photo_url.startsWith('data:') ? ticket.photo_url : `http://localhost:8000${ticket.photo_url}`)}
                    />
                  </div>
                )}
              </div>

              {/* Real-time Tracking Stepper */}
              <div style={{ border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px', background: '#eff6ff', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #bfdbfe', paddingBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#1d4ed8', fontSize: '14px' }}>📡 Pelacakan Evakuasi Real-time</h4>
                  <span style={{ fontSize: '11px', color: '#2563eb', animation: 'pulse 2s infinite' }}>● Terhubung WebSocket</span>
                </div>
                {renderTrackerSteps(ticket.status, ticket.assigned_unit)}
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ color: '#dc2626', fontWeight: 700, margin: '0 0 6px 0', fontSize: '13px' }}>
                  Tetap tenang dan amankan diri di tempat tinggi (lantai 2 / atap).
                </p>
                <div style={{ fontSize: '12px', color: '#991b1b' }}>
                  Butuh bantuan langsung via telepon? Hubungi:
                  <a href="tel:112" style={{ display: 'inline-block', marginLeft: '6px', fontWeight: 800, color: '#dc2626', textDecoration: 'underline' }}>
                    📞 Call Center 112
                  </a>
                </div>
              </div>

              <button
                onClick={() => { setStep(1); setTicket(null); setPhotoFile(null); setPhotoPreview(null); setPhotoBase64(null); }}
                style={{ width: '100%', padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                + Buat Laporan SOS Baru Lainnya
              </button>
            </div>
          )}
        </article>
      )}

      {/* TAB 2: RIWAYAT & STATUS TIKET WARGA */}
      {activeTab === 'history' && (
        <article className="portal-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
              📋 Riwayat &amp; Status Tiket SOS Anda
            </h2>
            <button
              onClick={loadMyTickets}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              🔄 Segarkan
            </button>
          </div>

          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              ⏳ Memuat riwayat tiket...
            </div>
          ) : myTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛡️</div>
              <h3 style={{ color: '#475569', margin: '0 0 4px 0' }}>Belum Ada Tiket SOS</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                Anda belum pernah mengajukan tiket evakuasi darurat.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                style={{ marginTop: '16px', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Buat Permintaan SOS
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myTickets.map((t) => (
                <div 
                  key={t.id} 
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: t.status === 'dispatched' ? '#fffbeb' : '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginRight: '8px' }}>
                        {t.ticket_number}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(t.submitted_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <div style={{ fontSize: '13px', color: '#334155', marginBottom: '8px' }}>
                    <div>📍 <strong>Lokasi:</strong> {t.gps_address}</div>
                    <div>👥 <strong>Jumlah Korban:</strong> {t.family_count} Jiwa {t.has_elderly ? '• Lansia' : ''} {t.has_toddler ? '• Balita' : ''} {t.has_pregnant ? '• Ibu Hamil' : ''} {t.has_disability ? '• Disabilitas' : ''}</div>
                    {t.assigned_unit && (
                      <div style={{ color: '#b45309', fontWeight: 600, marginTop: '4px' }}>
                        🚤 <strong>Armada Ditugaskan:</strong> {t.assigned_unit}
                      </div>
                    )}
                  </div>

                  {/* Foto Terlampir di Riwayat */}
                  {t.photo_url && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`} 
                        alt="Foto Tiket" 
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                        onClick={() => setLightboxPhoto(t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`)}
                      />
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'block' }}>📷 Foto Situasi Lokasi</span>
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(t.photo_url.startsWith('http') || t.photo_url.startsWith('data:') ? t.photo_url : `http://localhost:8000${t.photo_url}`)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Lihat Ukuran Penuh ↗
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tracker Stepper for In-Progress Tickets */}
                  {['submitted', 'verified', 'dispatched', 'arrived'].includes(t.status) && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                      {renderTrackerSteps(t.status, t.assigned_unit)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
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

