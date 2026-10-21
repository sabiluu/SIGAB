import { useState, useMemo, useEffect } from 'react';
import useDashboardRealtime from '../../hooks/useDashboardRealtime';
import useGeolocation from '../../hooks/useGeolocation';
import RiskMap from '../RiskMap';
import { getRouteToShelter } from '../../services/shelterService';

// Hitung jarak Haversine (km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Tema warna dinamis berdasarkan tingkat probabilitas risiko
function getRiskTheme(numericProb) {
  if (numericProb <= 25) {
    return {
      color: '#059669',
      gradientId: 'probGradGreen',
      gradientFrom: '#34d399',
      gradientTo: '#059669',
      glow: 'rgba(5, 150, 105, 0.35)',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      badgeText: '#065f46',
      label: 'AMAN',
      icon: '●',
      sub: 'Risiko Rendah'
    };
  }
  if (numericProb <= 50) {
    return {
      color: '#d97706',
      gradientId: 'probGradYellow',
      gradientFrom: '#fde047',
      gradientTo: '#d97706',
      glow: 'rgba(217, 119, 6, 0.35)',
      badgeBg: '#fffbeb',
      badgeBorder: '#fde68a',
      badgeText: '#92400e',
      label: 'WASPADA',
      icon: '▲',
      sub: 'Risiko Sedang'
    };
  }
  if (numericProb <= 75) {
    return {
      color: '#ea580c',
      gradientId: 'probGradOrange',
      gradientFrom: '#fb923c',
      gradientTo: '#ea580c',
      glow: 'rgba(234, 88, 12, 0.35)',
      badgeBg: '#fff7ed',
      badgeBorder: '#fed7aa',
      badgeText: '#9a3412',
      label: 'SIAGA',
      icon: '⚠',
      sub: 'Risiko Tinggi'
    };
  }
  return {
    color: '#dc2626',
    gradientId: 'probGradRed',
    gradientFrom: '#f87171',
    gradientTo: '#dc2626',
    glow: 'rgba(220, 38, 38, 0.4)',
    badgeBg: '#fef2f2',
    badgeBorder: '#fecaca',
    badgeText: '#991b1b',
    label: 'AWAS',
    icon: '🚨',
    sub: 'Risiko Kritis'
  };
}

const initialVillages = [
  { id: 'baureno', name: 'Baureno', tma: '24%', status: 'aman', prob: 24, defaultSelected: true },
  { id: 'gunungsari', name: 'Gunungsari', tma: '42%', status: 'waspada', prob: 42 },
  { id: 'tanggungan', name: 'Tanggungan', tma: '68%', status: 'waspada', prob: 68 },
];

export default function WargaBeranda({ 
  onNavigate, 
  geo: externalGeo, 
  userProfile, 
  selectedVillageId, 
  onSelectVillageId,
  onOpenLocationModal,
  initialScrollToMap = false
}) {
  const { data, loading, error } = useDashboardRealtime();
  const internalGeo = useGeolocation();
  const geo = externalGeo || internalGeo;

  // Koordinat GPS Pengguna (Default Pusat Baureno)
  const defaultCoords = [-7.1282, 112.1039];
  const [userLocation, setUserLocation] = useState(
    geo?.position ? [geo.position.latitude, geo.position.longitude] : defaultCoords
  );

  useEffect(() => {
    if (geo?.position?.latitude && geo?.position?.longitude) {
      setUserLocation([geo.position.latitude, geo.position.longitude]);
    }
  }, [geo?.position?.latitude, geo?.position?.longitude]);

  // Routing State
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [activeShelterId, setActiveShelterId] = useState(null);

  // Village Data Mapping
  const displayVillages = useMemo(() => {
    if (!data?.villages || data.villages.length === 0) return initialVillages;
    return data.villages.map(v => ({
      id: v.id,
      name: v.name,
      status: v.risk_level === 'rendah' || v.risk_level === 'aman' ? 'aman' : 'waspada',
      risk_level: v.risk_level || 'rendah',
      tma: (v.probability || 0).toFixed(1) + '%',
      prob: v.probability || 0,
      latitude: v.latitude,
      longitude: v.longitude
    }));
  }, [data]);

  const [selectedVillage, setSelectedVillage] = useState(null);

  // Otomatis sinkronkan desa terpilih
  useEffect(() => {
    if (displayVillages.length === 0) return;

    if (selectedVillageId) {
      const found = displayVillages.find(v => v.id === selectedVillageId || String(v.id) === String(selectedVillageId));
      if (found) {
        setSelectedVillage(found);
        return;
      }
    }

    if (userProfile?.village_id) {
      const found = displayVillages.find(v => v.id === userProfile.village_id || String(v.id) === String(userProfile.village_id));
      if (found) {
        setSelectedVillage(found);
        return;
      }
    }

    setSelectedVillage(prev => {
      if (!prev) return displayVillages[0];
      const refreshed = displayVillages.find(v => v.id === prev.id || v.name.toLowerCase() === prev.name.toLowerCase());
      return refreshed || prev;
    });
  }, [displayVillages, userProfile?.village_id, selectedVillageId]);

  // Handler saat klik poligon desa di peta
  const handleSelectVillage = (mapVillage) => {
    if (!mapVillage) return;
    const cleanMapName = (mapVillage.name || '').replace(/^Desa\s+/i, '').trim().toLowerCase();
    const found = displayVillages.find(v => {
      const cleanVName = v.name.replace(/^Desa\s+/i, '').trim().toLowerCase();
      return cleanVName === cleanMapName || cleanVName.includes(cleanMapName) || cleanMapName.includes(cleanVName);
    });
    if (found) {
      setSelectedVillage(found);
      if (onSelectVillageId) onSelectVillageId(found.id);
    } else {
      setSelectedVillage(mapVillage);
    }
  };

  // Handler dropdown pemilih desa
  const handleDropdownChange = (e) => {
    const val = Number(e.target.value) || e.target.value;
    const found = displayVillages.find(v => v.id === val || String(v.id) === String(val) || v.name === val);
    if (found) {
      setSelectedVillage(found);
      if (onSelectVillageId) onSelectVillageId(found.id);
    }
  };

  // Daftar Posko dari Realtime Backend
  const shelters = useMemo(() => {
    return data?.shelters || [];
  }, [data]);

  // Hitung metrik sisa kapasitas dan jarak GPS untuk seluruh posko evakuasi
  const enrichedShelters = useMemo(() => {
    if (!shelters || shelters.length === 0) return [];
    return shelters.map(s => {
      let dist = null;
      if (userLocation[0] && userLocation[1] && s.latitude && s.longitude) {
        dist = getDistanceKm(userLocation[0], userLocation[1], parseFloat(s.latitude), parseFloat(s.longitude));
      }
      const total = Number(s.capacity_total) || 0;
      const occupied = Number(s.capacity_occupied) || 0;
      const available = Math.max(0, total - occupied);
      const occPercent = total > 0 ? Math.min(100, Math.round((occupied / total) * 100)) : 0;
      const availPercent = 100 - occPercent;

      let status = 'tersedia';
      let statusLabel = 'Tersedia Aman';
      let statusColor = '#059669';
      let statusBg = '#ecfdf5';
      let statusBorder = '#a7f3d0';

      if (available === 0 || occPercent >= 100) {
        status = 'penuh';
        statusLabel = 'Kapasitas Penuh';
        statusColor = '#dc2626';
        statusBg = '#fef2f2';
        statusBorder = '#fecaca';
      } else if (available <= 20 || occPercent >= 80) {
        status = 'menipis';
        statusLabel = 'Sisa Menipis';
        statusColor = '#d97706';
        statusBg = '#fffbeb';
        statusBorder = '#fde68a';
      }

      return {
        ...s,
        distanceKm: dist,
        distanceStr: dist !== null ? dist.toFixed(1) : null,
        capacity_total: total,
        capacity_occupied: occupied,
        capacity_available: available,
        occupancy_percent: occPercent,
        available_percent: availPercent,
        capacity_status: status,
        capacity_status_label: statusLabel,
        capacity_status_color: statusColor,
        capacity_status_bg: statusBg,
        capacity_status_border: statusBorder
      };
    }).sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return 0;
    });
  }, [shelters, userLocation]);

  // Refresh GPS Device
  const handleDetectGPS = () => {
    if (geo?.refresh) {
      geo.refresh();
    }
  };

  // Hitung Rute Evakuasi OSRM
  const handleCalculateRoute = async (shelter) => {
    setSelectedShelter(shelter);
    setRouteLoading(true);
    setRouteError(null);

    // Otomatis scroll ke area peta jika dipanggil dari kartu atas
    const mapEl = document.getElementById('peta-wilayah-section');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth' });
    }

    try {
      const res = await getRouteToShelter(shelter.id, userLocation[0], userLocation[1]);
      setRouteData(res);
    } catch (err) {
      console.error('Gagal mengambil rute OSRM:', err);
      setRouteError('Gagal menghitung rute evakuasi. Menggunakan estimasi jarak garis lurus.');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleClearRoute = () => {
    setSelectedShelter(null);
    setRouteData(null);
    setRouteError(null);
  };

  const leafletRouteCoords = useMemo(() => {
    if (!routeData?.coordinates) return null;
    return routeData.coordinates.map(c => [c[1], c[0]]);
  }, [routeData]);

  // Auto-scroll ke peta jika dipanggil via tab 'peta'
  useEffect(() => {
    if (initialScrollToMap) {
      const timer = setTimeout(() => {
        const el = document.getElementById('peta-wilayah-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialScrollToMap]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Memuat data realtime Baureno...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Error: {error}</div>;

  const { weather, discharge, kecamatan_summary } = data || {};
  const userVillage = userProfile?.village_id 
    ? displayVillages.find(v => v.id === userProfile.village_id)
    : null;
  const prob = kecamatan_summary?.average_probability ?? 0;
  const isAman = kecamatan_summary?.overall_status === 'rendah';
  
  // Format waktu
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(typeof isoString === 'string' ? isoString.replace(' ', 'T') : isoString);
      return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    } catch {
      return '--:--';
    }
  };
  const lastUpdated = formatTime(weather?.recorded_at || discharge?.recorded_at);
  
  // Hitung nilai probabilitas & tema warna dinamis
  const numericProb = typeof prob === 'number' ? prob : Number(prob) || 0;
  const displayProb = numericProb % 1 === 0 ? numericProb.toString() : numericProb.toFixed(1);
  const displayPercent = Math.min(Math.max(numericProb, 0), 100);
  const theme = getRiskTheme(numericProb);

  // Radius lingkar gauge
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const effectivePercent = numericProb > 0 ? Math.max(displayPercent, 2) : 0;
  const strokeDashoffset = circumference - (effectivePercent / 100) * circumference;

  // Posko terdekat default dan posko aktif yang dipilih
  const nearestShelter = enrichedShelters[0] || null;
  const activeShelter = (activeShelterId ? enrichedShelters.find(s => s.id === activeShelterId) : null) || nearestShelter || {
    id: 0,
    name: 'Posko SDN Baureno 2',
    address: 'Jl. Raya Baureno No.14',
    capacity_total: 120,
    capacity_occupied: 30,
    capacity_available: 90,
    occupancy_percent: 25,
    available_percent: 75,
    distanceStr: '1.2',
    capacity_status: 'tersedia',
    capacity_status_label: 'Tersedia Aman',
    capacity_status_color: '#059669',
    capacity_status_bg: '#ecfdf5',
    capacity_status_border: '#a7f3d0'
  };

  // Posko alternatif terdekat yang masih memiliki sisa kuota (bila posko terdekat penuh)
  const nearestAlternativeShelter = enrichedShelters.find(s => s.id !== activeShelter?.id && s.capacity_available > 0) || null;

  return (
    <div className="warga-unified-portal" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>
      
      {/* Status Lokasi Device & Opsi Pemilihan Desa */}
      {geo?.isOutsideCoverage && !geo?.isCustom && (
        <div 
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>📍</span>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534' }}>
                Lokasi Device Nyata Terhubung: {geo.address || 'GPS Terkunci'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d', lineHeight: 1.45, marginTop: '2px' }}>
                Koordinat real ({geo.latitude?.toFixed(4)}, {geo.longitude?.toFixed(4)}) aktif digunakan untuk laporan evakuasi SOS. Jika Anda ingin memantau desa Baureno tertentu, Anda dapat memilih desa domisili.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLocationModal || handleDetectGPS}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
            }}
          >
            <span>🏡</span> Pilih Desa Domisili Baureno
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. BAGIAN ATAS: OVERVIEW STATUS, METRIK CUACA & POSKO CEPAT     */}
      {/* ============================================================== */}
      <div className="portal-body warga-body" style={{ maxWidth: '1400px', padding: 0, margin: 0, width: '100%' }}>
        <section className="warga-main">
          {/* Overview Gauge Card */}
          <article className={`warga-overview portal-card ${!isAman ? 'status-danger' : ''}`}>
            <div 
              className="warga-gauge-wrapper" 
              style={{
                position: 'relative',
                width: '185px',
                height: '185px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg 
                viewBox="0 0 180 180" 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  transform: 'rotate(-90deg)',
                  overflow: 'visible'
                }}
              >
                <defs>
                  <linearGradient id={theme.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={theme.gradientFrom} />
                    <stop offset="100%" stopColor={theme.gradientTo} />
                  </linearGradient>
                  <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={theme.glow} />
                  </filter>
                </defs>

                {/* Background Ring */}
                <circle
                  cx="90"
                  cy="90"
                  r="74"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />

                {/* Subtle Inner Guide */}
                <circle
                  cx="90"
                  cy="90"
                  r="67"
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  fill="none"
                  opacity="0.6"
                />

                {/* Dynamic Animated Progress Arc */}
                <circle
                  cx="90"
                  cy="90"
                  r="74"
                  stroke={`url(#${theme.gradientId})`}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  filter="url(#gaugeShadow)"
                  style={{
                    transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              </svg>

              {/* Central Info Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', lineHeight: 1 }}>
                  <strong
                    style={{
                      fontSize: '3rem',
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color: theme.color,
                      fontFamily: "'Inter', system-ui, sans-serif"
                    }}
                  >
                    {displayProb}
                  </strong>
                  <span
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: theme.color,
                      marginLeft: '2px'
                    }}
                  >
                    %
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '7px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    backgroundColor: theme.badgeBg,
                    border: `1px solid ${theme.badgeBorder}`,
                    color: theme.badgeText,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <span>{theme.icon}</span>
                  <span>{theme.label}</span>
                </div>
              </div>
            </div>

            <div className="overview-copy">
              <div className="fresh-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Real-time</span>
                <span>◷ Diperbarui {lastUpdated} WIB</span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', padding: '2px 8px', fontWeight: 600, fontSize: '11px' }}>
                  Cakupan: Kec. Baureno, Bojonegoro
                </span>
              </div>
              <h1>
                {isAman 
                  ? 'Kondisi hidrologi Kecamatan Baureno dalam batas normal (AMAN).'
                  : `Peringatan: Status Siaga/Awas. Probabilitas rata-rata Kecamatan Baureno mencapai ${Math.round(prob)}%.`}
              </h1>
              <p>
                Angka <strong>{displayProb}%</strong> adalah rata-rata risiko banjir untuk wilayah <strong>Kecamatan Baureno, Bojonegoro</strong> berdasarkan debit Sungai Bengawan Solo dan curah hujan real-time BMKG.
              </p>
              {userVillage && (
                <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#334155', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏠 Desa Terdaftar: <strong>{userVillage.name}</strong> (Risiko: {userVillage.probability || userVillage.prob}% • {userVillage.risk_level?.toUpperCase() || 'AMAN'})</span>
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedVillage(userVillage);
                      if (onSelectVillageId) onSelectVillageId(userVillage.id);
                      const el = document.getElementById('peta-wilayah-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }} 
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '12px' }}
                  >
                    Fokus di Peta ↓
                  </button>
                </div>
              )}
              <div className="trend">
                <div>
                  <small>TREN RISIKO 12 JAM</small>
                  <strong>stabil</strong>
                </div>
                <div className="trend-bars">
                  <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                </div>
              </div>
            </div>
          </article>

          {/* Weather & River Metrics */}
          <h2 className="subsection-title" style={{ marginTop: '28px' }}>
            Kondisi Cuaca &amp; Sungai Bengawan Solo Terkini
          </h2>
          <div className="weather-grid">
            <article className="metric-card portal-card">
              <div className="metric-top">
                <span>☁</span>
                <b>{weather?.precipitation_mm > 0 ? 'Hujan' : 'Cerah'}</b>
              </div>
              <strong>
                {weather?.precipitation_mm || 0}<small>mm/j</small>
              </strong>
              <p>Curah Hujan</p>
            </article>

            <article className="metric-card portal-card">
              <div className="metric-top">
                <span>♜</span>
                <b>{discharge?.discharge_m3s > 2000 ? 'Tinggi' : 'Normal'}</b>
              </div>
              <strong>
                {discharge?.discharge_m3s || 0}<small>m³/s</small>
              </strong>
              <p>Debit Bengawan Solo</p>
            </article>

            <article className="metric-card portal-card">
              <div className="metric-top">
                <span>▥</span>
                <b>Hangat</b>
              </div>
              <strong>
                {weather?.temperature_c || 0}<small>°C</small>
              </strong>
              <p>Suhu Udara</p>
            </article>

            <article className="metric-card portal-card">
              <div className="metric-top">
                <span>→</span>
                <b>Tenang</b>
              </div>
              <strong>
                {weather?.wind_speed_kmh || 0}<small>km/j</small>
              </strong>
              <p>Kecepatan Angin</p>
            </article>
          </div>
        </section>

        {/* Aside Right: Hotline & Nearest Shelter */}
        <aside className="warga-side">
          <article className="hotline-card">
            <h3>♧ &nbsp; Kontak Cepat Darurat</h3>
            <div>
              <span>Pusdalops BPBD</span>
              <strong>0353-881234</strong>
            </div>
            <div>
              <span>Call Center</span>
              <strong>112</strong>
            </div>
            <div>
              <span>Posko Kecamatan Baureno</span>
              <strong>0353-887788</strong>
            </div>
          </article>

          {/* Card: Posko Evakuasi Terdekat & Indikator Sisa Kapasitas */}
          <article className="portal-card nearest-card posko-indikator-card">
            <div className="posko-indikator-header">
              <div className="posko-header-title">
                <span className="posko-header-icon">🏠</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Posko Terdekat</h3>
                  <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Pusat Evakuasi Warga Baureno</small>
                </div>
              </div>
              <span className={`posko-status-badge ${activeShelter.capacity_status}`} style={{
                background: activeShelter.capacity_status_bg,
                color: activeShelter.capacity_status_color,
                border: `1px solid ${activeShelter.capacity_status_border}`,
                padding: '3px 8px',
                borderRadius: '20px',
                fontSize: '0.7rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: activeShelter.capacity_status_color 
                }} />
                {activeShelter.capacity_status_label}
              </span>
            </div>

            {/* Quick Selector jika ada lebih dari 1 posko */}
            {enrichedShelters.length > 1 && (
              <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                <select
                  value={activeShelterId || activeShelter.id}
                  onChange={(e) => setActiveShelterId(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: '#334155',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer'
                  }}
                  title="Pilih posko untuk melihat kapasitas"
                >
                  {enrichedShelters.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {idx === 0 ? '📍 [Terdekat] ' : ''}{s.name} ({s.distanceStr ? `${s.distanceStr} km` : 'Baureno'} • Sisa {s.capacity_available} jiwa)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Info Nama & Lokasi Posko */}
            <div style={{ marginTop: '6px' }}>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block', lineHeight: 1.3 }}>
                {activeShelter.name}
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>
                  📍 {activeShelter.distanceStr ? `${activeShelter.distanceStr} km dari lokasi Anda` : 'Kecamatan Baureno'}
                </span>
                <span>•</span>
                <span style={{ color: '#64748b' }}>{activeShelter.address}</span>
              </p>
            </div>

            {/* HERO BOX: INDIKATOR SISA KAPASITAS POSKO */}
            <div className="sisa-kapasitas-hero-box" style={{
              marginTop: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: activeShelter.capacity_status === 'penuh' 
                ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' 
                : activeShelter.capacity_status === 'menipis' 
                ? 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)' 
                : 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
              border: `1.5px solid ${activeShelter.capacity_status_border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              {/* Header Box Sisa Kapasitas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  fontSize: '0.66rem', 
                  fontWeight: 800, 
                  letterSpacing: '0.04em', 
                  textTransform: 'uppercase', 
                  color: activeShelter.capacity_status_color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Indikator Sisa Kapasitas
                </span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  color: activeShelter.capacity_status_color 
                }}>
                  {activeShelter.available_percent}% Kuota Kosong
                </span>
              </div>

              {/* Angka Utama Sisa Kapasitas */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                <span style={{ 
                  fontSize: '2.1rem', 
                  fontWeight: 900, 
                  lineHeight: 1, 
                  color: activeShelter.capacity_status_color,
                  fontFamily: "'Inter', system-ui, sans-serif"
                }}>
                  {activeShelter.capacity_available}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 700 }}>
                    Jiwa Tersisa
                  </strong>
                  <small style={{ fontSize: '0.67rem', color: '#64748b' }}>
                    dari kapasitas total {activeShelter.capacity_total} orang
                  </small>
                </div>
              </div>

              {/* Dual-Track Visual Progress Bar */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ 
                  height: '10px', 
                  width: '100%', 
                  background: '#e2e8f0', 
                  borderRadius: '9999px', 
                  overflow: 'hidden', 
                  display: 'flex',
                  position: 'relative'
                }}>
                  {/* Porsi Terisi */}
                  <div style={{ 
                    width: `${activeShelter.occupancy_percent}%`, 
                    background: activeShelter.occupancy_percent >= 100 
                      ? '#dc2626' 
                      : activeShelter.occupancy_percent >= 80 
                      ? '#f59e0b' 
                      : '#3b82f6',
                    transition: 'width 0.8s ease'
                  }} />
                  {/* Porsi Sisa */}
                  <div style={{ 
                    width: `${activeShelter.available_percent}%`, 
                    background: activeShelter.capacity_status === 'penuh' 
                      ? '#e2e8f0' 
                      : activeShelter.capacity_status === 'menipis' 
                      ? '#fde68a' 
                      : '#34d399',
                    transition: 'width 0.8s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', marginTop: '5px', color: '#64748b' }}>
                  <span>Terisi: <strong style={{ color: '#334155' }}>{activeShelter.capacity_occupied} ({activeShelter.occupancy_percent}%)</strong></span>
                  <span>Sisa: <strong style={{ color: activeShelter.capacity_status_color }}>{activeShelter.capacity_available} ({activeShelter.available_percent}%)</strong></span>
                </div>
              </div>

              {/* Grid 3-Pilar Metrik Kapasitas */}
              <div className="posko-stats-3col">
                <div>
                  <small>Daya Tampung</small>
                  <strong>{activeShelter.capacity_total} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>jiwa</span></strong>
                </div>
                <div>
                  <small>Telah Terisi</small>
                  <strong style={{ color: activeShelter.occupancy_percent >= 80 ? '#dc2626' : '#2563eb' }}>
                    {activeShelter.capacity_occupied} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>jiwa</span>
                  </strong>
                </div>
                <div>
                  <small>Sisa Kuota</small>
                  <strong style={{ color: activeShelter.capacity_status_color }}>
                    {activeShelter.capacity_available} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>jiwa</span>
                  </strong>
                </div>
              </div>

              {/* Status Note Banner */}
              <div style={{ 
                fontSize: '0.71rem', 
                color: activeShelter.capacity_status_color, 
                background: 'rgba(255,255,255,0.75)', 
                padding: '6px 8px', 
                borderRadius: '6px', 
                marginTop: '10px',
                borderLeft: `3px solid ${activeShelter.capacity_status_color}`,
                lineHeight: 1.4
              }}>
                {activeShelter.capacity_status === 'penuh' ? (
                  <span>⛔ <strong>Kapasitas Penuh!</strong> Posko ini sudah tidak dapat menerima warga baru. Harap pilih posko alternatif di bawah.</span>
                ) : activeShelter.capacity_status === 'menipis' ? (
                  <span>⚠️ <strong>Sisa Menipis!</strong> Kuota tersisa tinggal sedikit ({activeShelter.capacity_available} jiwa). Segera amankan rute Anda.</span>
                ) : (
                  <span>✅ <strong>Kapasitas Aman!</strong> Tersedia ruang tampung ({activeShelter.capacity_available} jiwa) untuk penanganan evakuasi.</span>
                )}
              </div>
            </div>

            {/* Smart Recommendation jika posko terdekat penuh */}
            {activeShelter.capacity_status === 'penuh' && nearestAlternativeShelter && (
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                fontSize: '0.74rem'
              }}>
                <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '3px' }}>
                  💡 Posko Alternatif Terdekat Tersedia:
                </div>
                <div style={{ color: '#1e293b' }}>
                  <strong>{nearestAlternativeShelter.name}</strong> ({nearestAlternativeShelter.distanceStr ? `${nearestAlternativeShelter.distanceStr} km` : 'dekat'})
                </div>
                <div style={{ color: '#059669', fontWeight: 600, fontSize: '0.7rem', marginTop: '2px' }}>
                  ✓ Tersedia sisa {nearestAlternativeShelter.capacity_available} jiwa ({nearestAlternativeShelter.available_percent}% kosong)
                </div>
                <button
                  type="button"
                  onClick={() => setActiveShelterId(nearestAlternativeShelter.id)}
                  style={{
                    marginTop: '6px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Pilih Posko Alternatif Ini →
                </button>
              </div>
            )}

            {/* Kontak PIC Posko jika ada */}
            {(activeShelter.contact_person || activeShelter.contact_phone) && (
              <div style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#475569',
                background: '#f8fafc',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <span>📞 Narahubung: <strong>{activeShelter.contact_person || 'Petugas'}</strong></span>
                {activeShelter.contact_phone && (
                  <a 
                    href={`tel:${activeShelter.contact_phone}`} 
                    style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                  >
                    {activeShelter.contact_phone}
                  </a>
                )}
              </div>
            )}

            {/* Tombol Pandu Rute */}
            <button
              type="button"
              onClick={() => handleCalculateRoute(activeShelter)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '9px 12px',
                background: selectedShelter?.id === activeShelter.id ? '#1d4ed8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <span>🗺️</span>
              <span>{selectedShelter?.id === activeShelter.id ? '✓ Rute Terpilih di Peta' : 'Pandu Rute ke Posko Ini'}</span>
            </button>
          </article>

          <article className="portal-card history-card">
            <div className="side-heading">
              <h3>Riwayat Kejadian</h3>
              <button
                type="button"
                onClick={() => onNavigate('riwayat')}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.7rem' }}
              >
                Lihat semua ›
              </button>
            </div>
            <div className="history-item">
              <i className="red" />
              <div>
                <strong>Banjir Luapan Bengawan Solo</strong>
                <small>Debit 3.900 m³/s</small>
              </div>
              <time>12 Feb 2026</time>
            </div>
            <div className="history-item">
              <i className="yellow" />
              <div>
                <strong>Siaga Hujan Ekstrem</strong>
                <small>112 mm/jam</small>
              </div>
              <time>28 Jan 2026</time>
            </div>
            <div className="history-item">
              <i className="green" />
              <div>
                <strong>Kondisi Normal (Aman)</strong>
                <small>Pemulihan tuntas</small>
              </div>
              <time>19 Des 2025</time>
            </div>
          </article>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* SEKAT TRANSISI ELEGAN: BERANDA → PETA WILAYAH SPASIAL          */}
      {/* ============================================================== */}
      <div className="warga-portal-sekat" aria-hidden="true">
        <div className="sekat-track-line" />
        <div className="sekat-bridge-capsule">
          <div className="sekat-radar-badge">
            <span className="sekat-radar-dot-wrapper">
              <span className="sekat-radar-ring" />
              <span className="sekat-radar-dot" />
            </span>
            <span className="sekat-radar-label">RADAR SPASIAL LIVE</span>
          </div>

          <div className="sekat-bridge-divider" />

          <div className="sekat-bridge-stats">
            <span className="sekat-stat-item">
              <span>🗺️</span>
              <span><strong>25 Desa</strong> Terpetakan</span>
            </span>
            <span className="sekat-stat-bullet">•</span>
            <span className="sekat-stat-item">
              <span>🌊</span>
              <span><strong>Bengawan Solo</strong> Terkoneksi</span>
            </span>
            <span className="sekat-stat-bullet">•</span>
            <span className="sekat-stat-item">
              <span>⚡</span>
              <span><strong>OSRM</strong> Navigasi Siap</span>
            </span>
          </div>

          <button
            type="button"
            className="sekat-scroll-btn"
            onClick={() => {
              const el = document.getElementById('peta-wilayah-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            title="Gulir langsung ke Peta Wilayah & Rute"
          >
            <span>Eksplorasi Peta</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 13l5 5 5-5M7 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. BAGIAN UTAMA: PETA WILAYAH SPASIAL & RUTE EVAKUASI BAURENO  */}
      {/* ============================================================== */}
      <section id="peta-wilayah-section" className="warga-section" style={{ paddingTop: '8px' }}>
        <div className="peta-header-hero">
          <div className="peta-hero-meta-row">
            <div className="peta-meta-chips">
              <span className="warga-tag-pill green" style={{ margin: 0 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                Peta Wilayah &amp; Navigasi Spasial
              </span>
              <span className="peta-meta-chip active">
                <span>📍</span>
                <span>Desa Aktif: <strong>{geo.address ? geo.address.split(',')[0].replace(/^Desa\s+/i, '') : 'Baureno'}</strong></span>
              </span>
              <span className="peta-meta-chip green">
                <span>🌊</span>
                <span>DAS Bengawan Solo: <strong>{discharge?.status ? discharge.status.toUpperCase() : 'NORMAL'}</strong></span>
              </span>
            </div>
            
            <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⏱️ Diperbarui: <strong>{lastUpdated} WIB</strong></span>
            </div>
          </div>

          <div className="warga-title-row" style={{ marginTop: '4px' }}>
            <div className="warga-title-col">
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '2px 0 8px 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
                Sebaran Risiko Banjir &amp; Rute Evakuasi — Baureno
              </h1>
              <p style={{ color: '#475569', fontSize: '0.88rem', margin: 0, maxWidth: '780px', lineHeight: '1.55' }}>
                Peta interaktif 25 desa Kecamatan Baureno terhubung sensor debit Sungai Bengawan Solo, stasiun curah hujan BMKG, serta navigasi rute evakuasi tercepat dan titik posko aman secara realtime.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={onOpenLocationModal || handleDetectGPS} 
                disabled={geo?.loading}
                className="peta-action-btn"
                title="Klik untuk memilih desa domisili atau kalibrasi GPS"
                style={{ 
                  background: geo?.isCustom ? '#0284c7' : geo?.isRealDevice ? '#059669' : '#2563eb', 
                  color: 'white', 
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <span>📍</span> 
                <span>
                  {geo?.loading 
                    ? 'Mencari GPS...' 
                    : geo?.isCustom
                      ? `Desa: ${geo.address ? geo.address.split(',')[0].replace(/^Desa\s+/i, '') : 'Pilihan'}`
                      : geo?.isRealDevice 
                        ? `GPS: ${geo.address ? geo.address.split(',')[0] : 'Terkunci'}` 
                        : 'Pilih Lokasi Desa'}
                </span>
                <span style={{ opacity: 0.7, fontSize: '10px' }}>▾</span>
              </button>

              <button 
                type="button" 
                onClick={() => onNavigate('sos')}
                style={{ 
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', 
                  color: 'white', 
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <span>🚨</span> Minta Bantuan (SOS)
              </button>
            </div>
          </div>
        </div>

        <div className="peta-grid-layout">
          {/* Kolom Kiri: Peta Interaktif Leaflet */}
          <div className="peta-map-card">
            <div className="peta-map-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="peta-status-badge">
                <span className="peta-status-pill">● Data Terhubung Live</span>
                <span>
                  {data?.weather ? `Hujan: ${data.weather.precipitation_mm} mm/jam` : 'BMKG Baureno'}
                </span>
              </div>
              {selectedShelter && (
                <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700, background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  Navigasi Aktif: {selectedShelter.name}
                </span>
              )}
            </div>

            <div className="peta-canvas-container" style={{ padding: '0', backgroundColor: '#e5e7eb', position: 'relative' }}>
              <RiskMap 
                onSelectVillage={handleSelectVillage}
                selectedVillageName={selectedVillage?.name}
                shelters={shelters}
                onSelectShelter={handleCalculateRoute}
                selectedShelterId={selectedShelter?.id}
                userLocation={userLocation}
                routeCoordinates={leafletRouteCoords}
                height="530px"
              />
              <div className="map-legend-bottom">
                <span><i className="red-dot" /> Sangat Tinggi / Awas</span>
                <span><i className="orange-dot" /> Tinggi / Siaga</span>
                <span><i className="yellow-dot" /> Sedang / Waspada</span>
                <span><i className="green-dot" /> Rendah / Aman</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '13px' }}>🏠</span> Posko Evakuasi
                </span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Detail Desa Terpilih, Panduan Rute & Daftar Posko */}
          <div className="peta-sidebar">

            {/* Card: Panduan Rute Evakuasi Aktif */}
            {selectedShelter && (
              <div className="peta-selected-card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="peta-sel-header" style={{ color: '#a7f3d0' }}>PANDUAN RUTE EVAKUASI</span>
                  <button 
                    onClick={handleClearRoute}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.18)', 
                      border: 'none', 
                      color: '#ffffff', 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '13px', 
                      cursor: 'pointer', 
                      padding: 0 
                    }}
                    title="Tutup Rute"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="peta-sel-title" style={{ fontSize: '1.25rem', marginTop: '6px', color: '#ffffff', marginBottom: '4px' }}>
                  {selectedShelter.name}
                </h2>
                <p style={{ fontSize: '12px', color: '#e2e8f0', margin: '0 0 14px 0' }}>{selectedShelter.address}</p>

                {routeLoading ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#ffffff', fontWeight: 500 }}>
                    ⏳ Menghitung rute tercepat via OSRM...
                  </div>
                ) : routeData ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Jarak Evakuasi</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a' }}>{routeData.distance_km} km</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Waktu Tempuh</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857' }}>~{routeData.duration_minutes} mnt</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#ffffff', marginBottom: '14px', lineHeight: '1.6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: '5px', marginBottom: '5px' }}>
                        <span style={{ color: '#e2e8f0' }}>Kapasitas Posko:</span>
                        <strong style={{ color: '#ffffff' }}>{selectedShelter.capacity_occupied || 0} / {selectedShelter.capacity_total} orang</strong>
                      </div>
                      {selectedShelter.contact_phone && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#e2e8f0' }}>Kontak Posko:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedShelter.contact_phone} ({selectedShelter.contact_person || 'Petugas'})</strong>
                        </div>
                      )}
                    </div>

                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${selectedShelter.latitude},${selectedShelter.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        background: '#2563eb',
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '12px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                      }}
                    >
                      🚀 Buka Navigasi di Google Maps
                    </a>
                  </>
                ) : routeError ? (
                  <div style={{ fontSize: '12px', color: '#ffffff', background: 'rgba(220,38,38,0.3)', border: '1px solid #ef4444', padding: '8px 10px', borderRadius: '6px' }}>{routeError}</div>
                ) : null}
              </div>
            )}

            {/* Card: Rincian Desa Terpilih */}
            {(() => {
              const isUserDomicile = Boolean(
                userProfile?.village_id && 
                selectedVillage && 
                (selectedVillage.id === userProfile.village_id || String(selectedVillage.id) === String(userProfile.village_id))
              );

              const getCardTheme = (riskLevel) => {
                switch (riskLevel) {
                  case 'awas':
                    return {
                      bg: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
                      shadow: '0 10px 20px -3px rgba(185, 28, 28, 0.3)',
                      header: '#fca5a5',
                      stroke: '#ef4444',
                      label: 'AWAS',
                      msg: 'BAHAYA BANJIR! Segera lakukan evakuasi ke posko terdekat.'
                    };
                  case 'tinggi':
                    return {
                      bg: 'linear-gradient(135deg, #c2410c, #9a3412)',
                      shadow: '0 10px 20px -3px rgba(194, 65, 12, 0.3)',
                      header: '#fdba74',
                      stroke: '#f97316',
                      label: 'SIAGA',
                      msg: 'Peringatan risiko tinggi! Siagakan evakuasi mandiri ke posko terdekat.'
                    };
                  case 'sedang':
                    return {
                      bg: 'linear-gradient(135deg, #b45309, #78350f)',
                      shadow: '0 10px 20px -3px rgba(180, 83, 9, 0.3)',
                      header: '#fde68a',
                      stroke: '#f59e0b',
                      label: 'WASPADA',
                      msg: 'Kondisi siaga sedang/waspada, regu relawan memantau tanggul sekitar.'
                    };
                  default:
                    return {
                      bg: 'linear-gradient(135deg, #047857, #065f46)',
                      shadow: '0 10px 20px -3px rgba(6, 95, 70, 0.25)',
                      header: '#a7f3d0',
                      stroke: '#34d399',
                      label: 'AMAN',
                      msg: 'Debit sungai dan curah hujan normal, tidak ada ancaman luapan air.'
                    };
                }
              };

              const cardTheme = getCardTheme(selectedVillage?.risk_level);

              return (
                <div 
                  className="peta-selected-card"
                  style={{
                    background: cardTheme.bg,
                    boxShadow: cardTheme.shadow,
                    transition: 'background 0.3s ease, box-shadow 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span className="peta-sel-header" style={{ color: cardTheme.header, margin: 0 }}>
                      DESA TERPILIH
                    </span>
                    
                    {/* Dropdown Pemilih Desa */}
                    <select
                      value={selectedVillage?.id || ''}
                      onChange={handleDropdownChange}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.45)',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        outline: 'none',
                        maxWidth: '180px'
                      }}
                      title="Pilih desa untuk melihat rincian risikonya"
                    >
                      {displayVillages.map(v => (
                        <option key={v.id} value={v.id} style={{ color: '#0f172a' }}>
                          Desa {v.name.replace(/^Desa\s+/i, '')} {userProfile?.village_id === v.id ? '⭐ (Domisili Anda)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <h2 className="peta-sel-title" style={{ color: '#ffffff', margin: 0, fontSize: '1.65rem' }}>
                      {selectedVillage ? selectedVillage.name.replace(/^Desa\s+/i, '') : 'Memuat...'}
                    </h2>
                    {isUserDomicile && (
                      <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>
                        🏠 Domisili Anda
                      </span>
                    )}
                  </div>

                  <div className="peta-sel-metrics">
                    <div className="peta-sel-num-wrap">
                      <span className="peta-sel-num" style={{ color: '#ffffff' }}>
                        {selectedVillage?.tma || (selectedVillage?.prob !== undefined ? `${selectedVillage.prob.toFixed(1)}%` : '0%')}
                      </span>
                      <span className="peta-sel-unit">Probabilitas Risiko</span>
                    </div>
                    <div className="peta-sel-status-badge">
                      <span className="peta-sel-status-pill">
                        {selectedVillage?.risk_level ? cardTheme.label : (selectedVillage?.status === 'aman' ? 'AMAN' : 'WASPADA')}
                      </span>
                      <span className="peta-sel-status-sub">Status kini</span>
                    </div>
                  </div>

                  <div className="peta-sel-alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cardTheme.stroke} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{cardTheme.msg}</span>
                  </div>
                </div>
              );
            })()}

            {/* Card: Daftar Posko Evakuasi Pengungsian */}
            <div className="peta-posko-card">
              <div className="peta-posko-head">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Daftar Posko Evakuasi Baureno ({shelters.length})
              </div>

              <div className="peta-posko-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {enrichedShelters.length > 0 ? (
                  enrichedShelters.map((posko) => (
                    <div key={posko.id} className="peta-posko-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                      <div className="peta-posko-row1">
                        <span className="peta-posko-name">{posko.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: posko.capacity_status_bg,
                            color: posko.capacity_status_color,
                            border: `1px solid ${posko.capacity_status_border}`
                          }}>
                            Sisa: {posko.capacity_available} jiwa
                          </span>
                          <span className="peta-posko-dist">{posko.distanceStr ? `${posko.distanceStr} km` : `${posko.capacity_occupied}/${posko.capacity_total} org`}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{posko.address}</div>

                      {/* Mini Dual Track Indicator */}
                      <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginTop: '2px' }}>
                        <div style={{ width: `${posko.occupancy_percent}%`, background: posko.occupancy_percent >= 100 ? '#dc2626' : posko.occupancy_percent >= 80 ? '#f59e0b' : '#3b82f6' }} />
                        <div style={{ width: `${posko.available_percent}%`, background: posko.capacity_status === 'penuh' ? '#e2e8f0' : '#34d399' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span className="peta-posko-standby">{posko.is_active ? 'Siaga Aktif' : 'Tutup'}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveShelterId(posko.id);
                              const topEl = document.querySelector('.posko-indikator-card');
                              if (topEl) topEl.scrollIntoView({ behavior: 'smooth' });
                            }}
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Detail Sisa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCalculateRoute(posko)}
                            style={{
                              background: selectedShelter?.id === posko.id ? '#1d4ed8' : '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {selectedShelter?.id === posko.id ? '✓ Rute Terpilih' : '🗺️ Pandu Rute'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    Memuat data posko...
                  </div>
                )}
              </div>
            </div>

            {/* Data Source Note */}
            <div className="peta-datasource-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                Kalkulasi rute didukung oleh <strong>OSRM Engine</strong> &amp; pemodelan hidrologi BMKG / Open-Meteo.
              </span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
