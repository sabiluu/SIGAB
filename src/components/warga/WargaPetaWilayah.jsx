import { useState, useMemo, useEffect } from 'react'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import useGeolocation from '../../hooks/useGeolocation'
import RiskMap from '../RiskMap'
import { getRouteToShelter } from '../../services/shelterService'

const initialVillages = [
  { id: 'tulungrejo', name: 'Tulungrejo', tma: '12%', status: 'aman', prob: 12 },
  { id: 'baureno', name: 'Baureno', tma: '24%', status: 'aman', prob: 24, defaultSelected: true },
  { id: 'kedungrejo', name: 'Kedungrejo', tma: '68%', status: 'waspada', prob: 68 },
]

export default function WargaPetaWilayah({ geo: externalGeo }) {
  const { data } = useDashboardRealtime()
  const internalGeo = useGeolocation()
  const geo = externalGeo || internalGeo

  // User GPS state — otomatis tersinkron dengan GPS device nyata
  const defaultCoords = [-7.160, 111.830]
  const [userLocation, setUserLocation] = useState(
    geo?.position ? [geo.position.latitude, geo.position.longitude] : defaultCoords
  )

  useEffect(() => {
    if (geo?.position?.latitude && geo?.position?.longitude) {
      setUserLocation([geo.position.latitude, geo.position.longitude])
    }
  }, [geo?.position?.latitude, geo?.position?.longitude])

  // Routing state
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)

  // Villlage data mapping
  const displayVillages = useMemo(() => {
    if (!data?.villages || data.villages.length === 0) return initialVillages;
    return data.villages.map(v => ({
      id: v.name,
      name: v.name,
      status: v.risk_level === 'rendah' || v.risk_level === 'aman' ? 'aman' : 'waspada',
      risk_level: v.risk_level,
      tma: (v.probability || 0).toFixed(1) + '%',
      prob: v.probability || 0
    }));
  }, [data]);

  const [selectedVillage, setSelectedVillage] = useState(
    displayVillages.find((v) => v.name.toLowerCase() === 'baureno') || displayVillages[0]
  )

  // Keep selected village in sync when realtime data arrives
  useEffect(() => {
    if (displayVillages.length > 0 && selectedVillage) {
      const updated = displayVillages.find(v => v.name.toLowerCase() === selectedVillage.name.toLowerCase());
      if (updated) setSelectedVillage(updated);
    }
  }, [displayVillages]);

  // Posko list from realtime dashboard
  const shelters = useMemo(() => {
    return data?.shelters || [];
  }, [data]);

  // Request GPS Refresh
  const handleDetectGPS = () => {
    if (geo?.refresh) {
      geo.refresh();
    }
  };

  // Calculate evacuation route to shelter
  const handleCalculateRoute = async (shelter) => {
    setSelectedShelter(shelter);
    setRouteLoading(true);
    setRouteError(null);

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

  // Convert route coordinates [lon, lat] from GeoJSON to Leaflet [lat, lon]
  const leafletRouteCoords = useMemo(() => {
    if (!routeData?.coordinates) return null;
    return routeData.coordinates.map(c => [c[1], c[0]]);
  }, [routeData]);

  return (
    <section className="warga-section">
      <div className="warga-section-header">
        <span className="warga-tag-pill green">Peta Wilayah</span>
        <div className="warga-title-row">
          <div className="warga-title-col">
            <h1>Sebaran Risiko & Rute Evakuasi — Baureno</h1>
            <p>
              Peta spasial interaktif 25 desa terhubung debit Bengawan Solo, sensor BMKG, dan navigasi posko pengungsian berbasis OSRM.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                gap: '6px'
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
          </div>
        </div>
      </div>

      <div className="peta-grid-layout">
        {/* Left Column: Interactive Map Box */}
        <div className="peta-map-card">
          <div className="peta-map-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="peta-status-badge">
              <span className="peta-status-pill">● Data Terhubung Live</span>
              <span>
                {data?.weather ? `Hujan: ${data.weather.precipitation_mm} mm/jam` : 'BMKG Baureno'}
              </span>
            </div>
            {selectedShelter && (
              <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>
                Navigasi Aktif: {selectedShelter.name}
              </span>
            )}
          </div>

          <div className="peta-canvas-container" style={{ padding: '0', backgroundColor: '#e5e7eb', position: 'relative' }}>
            <RiskMap 
              onSelectVillage={(v) => setSelectedVillage(v)}
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

        {/* Right Column: Selected Village, Route Guide & Shelters */}
        <div className="peta-sidebar">

          {/* Card: Active Evacuation Route Guide */}
          {selectedShelter && (
            <div className="peta-selected-card" style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="peta-sel-header" style={{ color: '#1d4ed8' }}>PANDUAN RUTE EVAKUASI</span>
                <button 
                  onClick={handleClearRoute}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '16px', cursor: 'pointer', padding: 0 }}
                  title="Tutup Rute"
                >
                  ✕
                </button>
              </div>
              <h2 className="peta-sel-title" style={{ fontSize: '1.1rem', marginTop: '4px' }}>{selectedShelter.name}</h2>
              <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 12px 0' }}>{selectedShelter.address}</p>

              {routeLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#2563eb' }}>
                  ⏳ Menghitung rute tercepat via OSRM...
                </div>
              ) : routeData ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Jarak Evakuasi</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a8a' }}>{routeData.distance_km} km</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Waktu Tempuh</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>~{routeData.duration_minutes} mnt</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#334155', marginBottom: '12px' }}>
                    <strong>Kapasitas Posko:</strong> {selectedShelter.capacity_occupied || 0} / {selectedShelter.capacity_total} orang
                    {selectedShelter.contact_phone && (
                      <div><strong>Kontak Posko:</strong> {selectedShelter.contact_phone} ({selectedShelter.contact_person || 'Petugas'})</div>
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
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    🚀 Buka Navigasi di Google Maps
                  </a>
                </>
              ) : routeError ? (
                <div style={{ fontSize: '12px', color: '#dc2626' }}>{routeError}</div>
              ) : null}
            </div>
          )}

          {/* Card 1: Selected Village Details */}
          <div className="peta-selected-card">
            <span className="peta-sel-header">DESA TERPILIH</span>
            <h2 className="peta-sel-title">{selectedVillage.name}</h2>

            <div className="peta-sel-metrics">
              <div className="peta-sel-num-wrap">
                <span className="peta-sel-num">{selectedVillage.tma}</span>
                <span className="peta-sel-unit">Probabilitas Risiko</span>
              </div>
              <div className="peta-sel-status-badge">
                <span className="peta-sel-status-pill">{selectedVillage.status === 'aman' ? 'AMAN' : 'WASPADA'}</span>
                <span className="peta-sel-status-sub">Status kini</span>
              </div>
            </div>

            <div className="peta-sel-alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {selectedVillage.status === 'aman'
                  ? 'Debit sungai dan curah hujan normal, tidak ada ancaman luapan air.'
                  : 'Kondisi siaga sedang/tinggi, regu relawan memantau tanggul sekitar.'}
              </span>
            </div>
          </div>

          {/* Card 2: Nearest Shelters */}
          <div className="peta-posko-card">
            <div className="peta-posko-head">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Daftar Posko Evakuasi ({shelters.length})
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
                        {selectedShelter?.id === posko.id ? '✓ Rute Terpilih' : '🗺️ Rute Evakuasi'}
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
              Kalkulasi rute didukung oleh <strong>OSRM Engine</strong> &amp; pemodelan Open-Meteo GloFAS.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

