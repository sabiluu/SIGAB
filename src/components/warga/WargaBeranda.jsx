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

  // Temukan Posko Terdekat dari Koordinat GPS Nyata Pengguna
  let nearestShelter = shelters[0];
  let nearestDistance = null;

  if (userLocation[0] && userLocation[1] && shelters.length > 0) {
    let minD = Infinity;
    shelters.forEach(s => {
      if (s.latitude && s.longitude) {
        const d = getDistanceKm(userLocation[0], userLocation[1], parseFloat(s.latitude), parseFloat(s.longitude));
        if (d !== null && d < minD) {
          minD = d;
          nearestShelter = s;
        }
      }
    });
    if (minD !== Infinity) {
      nearestDistance = minD.toFixed(1);
    }
  }

  const shelter = nearestShelter;
  const shelterName = shelter?.name || 'Posko SDN Baureno 2';
  const shelterAddress = shelter?.address || 'Jl. Raya Baureno No.14';
  const shelterCapTotal = shelter?.capacity_total || 120;
  const shelterCapOcc = shelter?.capacity_occupied || 30;
  const shelterOccPerc = shelterCapTotal > 0 ? (shelterCapOcc / shelterCapTotal) * 100 : 0;

  return (
    <div className="warga-unified-portal" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>
      
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

          <article className="portal-card nearest-card">
            <div className="side-heading">
              <h3>Posko Terdekat</h3>
              <b>Standby</b>
            </div>
            <strong>{shelterName}</strong>
            <p>
              ⌖ {nearestDistance ? `${nearestDistance} km dari lokasi Anda` : (shelter?.address ? 'Sesuai Peta' : '1.2 km')} · {shelterAddress}
            </p>
            <div className="capacity-label">
              <span>Kapasitas (Terisi {shelterCapOcc})</span>
              <strong>{shelterCapTotal} orang</strong>
            </div>
            <div className="capacity-track">
              <i style={{ width: `${Math.min(shelterOccPerc, 100)}%`, background: shelterOccPerc > 80 ? '#ef4444' : '#3b82f6', transition: 'width 1s ease-in-out' }} />
            </div>
            <button
              type="button"
              onClick={() => handleCalculateRoute(nearestShelter)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '8px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🗺️ Pandu Rute ke Posko Ini
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
      {/* 2. BAGIAN UTAMA: PETA WILAYAH SPASIAL & RUTE EVAKUASI BAURENO  */}
      {/* ============================================================== */}
      <section id="peta-wilayah-section" className="warga-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '32px' }}>
        <div className="warga-section-header">
          <span className="warga-tag-pill green">Peta Wilayah &amp; Navigasi Spasial</span>
          <div className="warga-title-row">
            <div className="warga-title-col">
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 8px 0', color: '#0f172a' }}>
                Sebaran Risiko Banjir &amp; Rute Evakuasi — Baureno
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, maxWidth: '750px', lineHeight: '1.5' }}>
                Peta geospasial 25 desa Kecamatan Baureno terhubung debit Sungai Bengawan Solo, stasiun BMKG, dan kalkulasi navigasi rute evakuasi tercepat via OSRM Engine.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={handleDetectGPS} 
                disabled={geo?.loading}
                className="peta-action-btn"
                title={geo?.fullAddress || 'Klik untuk menyinkronkan lokasi GPS perangkat Anda'}
                style={{ 
                  background: geo?.isRealDevice ? '#059669' : '#2563eb', 
                  color: 'white', 
                  borderColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <span>📍</span> 
                <span>
                  {geo?.loading 
                    ? 'Mencari GPS...' 
                    : geo?.isRealDevice 
                      ? `GPS: ${geo.address ? geo.address.split(',')[0] : 'Terkunci'}` 
                      : 'Sinkronkan GPS Device'}
                </span>
              </button>

              <button 
                type="button" 
                onClick={() => onNavigate('sos')}
                style={{ 
                  background: '#dc2626', 
                  color: 'white', 
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                🚨 Minta Evakuasi (SOS)
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
                {shelters.length > 0 ? (
                  shelters.map((posko) => (
                    <div key={posko.id} className="peta-posko-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                      <div className="peta-posko-row1">
                        <span className="peta-posko-name">{posko.name}</span>
                        <span className="peta-posko-dist">{posko.capacity_occupied}/{posko.capacity_total} org</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{posko.address}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span className="peta-posko-standby">{posko.is_active ? 'Siaga Aktif' : 'Tutup'}</span>
                        <button
                          onClick={() => handleCalculateRoute(posko)}
                          style={{
                            background: selectedShelter?.id === posko.id ? '#1d4ed8' : '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {selectedShelter?.id === posko.id ? '✓ Rute Terpilih' : '🗺️ Pandu Rute'}
                        </button>
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
