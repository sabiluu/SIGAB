import { useState, useMemo, useEffect, useCallback } from 'react'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import useGeolocation, { BAURENO_VILLAGES } from '../../hooks/useGeolocation'
import RiskMap from '../RiskMap'
import { getRouteToShelter, getShelters } from '../../services/shelterService'

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// 6 Posko Resmi Baureno tersinkronisasi database backend riil
const DEFAULT_SHELTERS = [
  {
    id: 1,
    name: 'Posko SDN Baureno 2',
    address: 'Jl. Raya Baureno No. 14',
    distanceStr: '0.3',
    capacity_total: 150,
    capacity_occupied: 150,
    capacity_available: 0,
    occupancy_percent: 100,
    status_label: 'Penuh',
    status_color_class: 'red',
    latitude: -7.1285,
    longitude: 112.104
  },
  {
    id: 2,
    name: 'Posko Balai Desa Baureno',
    address: 'Jl. Pemuda No. 01',
    distanceStr: '0.6',
    capacity_total: 200,
    capacity_occupied: 190,
    capacity_available: 10,
    occupancy_percent: 95,
    status_label: 'Sisa menipis',
    status_color_class: 'yellow',
    latitude: -7.1278,
    longitude: 112.103
  },
  {
    id: 3,
    name: 'Posko Masjid Al-Huda Trojalu',
    address: 'Jl. Masjid No. 5',
    distanceStr: '1.2',
    capacity_total: 100,
    capacity_occupied: 10,
    capacity_available: 90,
    occupancy_percent: 10,
    status_label: 'Tersedia',
    status_color_class: 'green',
    latitude: -7.1265,
    longitude: 112.115
  },
  {
    id: 4,
    name: 'Balai Kecamatan Baureno',
    address: 'Kecamatan Baureno',
    distanceStr: '1.5',
    capacity_total: 500,
    capacity_occupied: 0,
    capacity_available: 500,
    occupancy_percent: 0,
    status_label: 'Tersedia',
    status_color_class: 'green',
    latitude: -7.129,
    longitude: 112.105
  },
  {
    id: 5,
    name: 'SDN Baureno 1',
    address: 'Kecamatan Baureno',
    distanceStr: '0.8',
    capacity_total: 300,
    capacity_occupied: 0,
    capacity_available: 300,
    occupancy_percent: 0,
    status_label: 'Tersedia',
    status_color_class: 'green',
    latitude: -7.125,
    longitude: 112.11
  },
  {
    id: 6,
    name: "Masjid Jami' Baureno",
    address: 'Kecamatan Baureno',
    distanceStr: '1.0',
    capacity_total: 250,
    capacity_occupied: 0,
    capacity_available: 250,
    occupancy_percent: 0,
    status_label: 'Tersedia',
    status_color_class: 'green',
    latitude: -7.13,
    longitude: 112.1
  }
]

export default function WargaBeranda({
  onNavigate,
  geo: externalGeo,
  userProfile,
  selectedVillageId,
  onSelectVillageId,
  onOpenLocationModal,
  initialScrollToMap = false,
  activeTab = 'beranda',
  isEmergencyActive = false,
  onToggleSimulatedEmergency
}) {
  const { data, loading } = useDashboardRealtime()
  const internalGeo = useGeolocation()
  const geo = externalGeo || internalGeo

  // State
  const [directShelters, setDirectShelters] = useState([])
  const [simulatedEmergency, setSimulatedEmergency] = useState(false)
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)

  // Fetch data posko langsung via REST API untuk sinkronisasi seketika
  useEffect(() => {
    let mounted = true
    getShelters()
      .then(res => {
        if (mounted && Array.isArray(res) && res.length > 0) {
          setDirectShelters(res)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeTab])

  // Current view mode: 'beranda' or 'peta'
  const isMapView = activeTab === 'peta' || initialScrollToMap

  // User coordinates
  const defaultCoords = [-7.1282, 112.1039]
  const userLocation = geo?.position 
    ? [geo.position.latitude, geo.position.longitude] 
    : defaultCoords

  // Posko List: Prioritaskan data realtime WebSocket / REST API backend
  const sheltersList = useMemo(() => {
    const rawList = (data?.shelters && Array.isArray(data.shelters) && data.shelters.length > 0)
      ? data.shelters
      : (directShelters && directShelters.length > 0 ? directShelters : DEFAULT_SHELTERS)

    return rawList.map((s) => {
      const total = Number(s.capacity_total) || 100
      const occupied = typeof s.capacity_occupied === 'number'
        ? s.capacity_occupied
        : (s.capacity_occupied !== null && s.capacity_occupied !== undefined ? Number(s.capacity_occupied) : 0)
      const avail = Math.max(0, total - occupied)
      const pct = total > 0 ? Math.round((occupied / total) * 100) : 0

      let statusLabel = 'Tersedia'
      let colorClass = 'green'
      if (avail === 0 || pct >= 100) {
        statusLabel = 'Penuh'
        colorClass = 'red'
      } else if (pct >= 80 || avail <= Math.max(10, total * 0.2)) {
        statusLabel = 'Sisa menipis'
        colorClass = 'yellow'
      }

      const sLat = s.latitude ? Number(s.latitude) : -7.1285
      const sLon = s.longitude ? Number(s.longitude) : 112.104
      const dist = (userLocation && userLocation[0] && userLocation[1])
        ? calculateHaversineKm(userLocation[0], userLocation[1], sLat, sLon)
        : (s.distanceStr || '0.5')

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        distanceStr: dist,
        capacity_total: total,
        capacity_occupied: occupied,
        capacity_available: avail,
        occupancy_percent: pct,
        status_label: statusLabel,
        status_color_class: colorClass,
        latitude: sLat,
        longitude: sLon,
        contact_person: s.contact_person,
        contact_phone: s.contact_phone
      }
    })
  }, [data?.shelters, directShelters, userLocation])

  // Calculation of risk probability
  const isSevereFlood = isEmergencyActive || simulatedEmergency
  const rawProb = isSevereFlood ? 94 : (data?.kecamatan_summary?.average_probability ?? 22)
  const probVal = Math.round(rawProb)
  
  // Theme and status
  const isAman = probVal <= 25
  const isWaspada = probVal > 25 && probVal <= 50
  const isSiaga = probVal > 50 && probVal <= 75
  const isAwas = probVal > 75

  // SVG Donut calculation
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (probVal / 100) * circumference

  // Sorting posko berdasarkan jarak terdekat dari koordinat warga (PRD Section 4.2)
  const sortedShelters = useMemo(() => {
    return [...sheltersList].sort((a, b) => parseFloat(a.distanceStr || 999) - parseFloat(b.distanceStr || 999))
  }, [sheltersList])

  const physicalNearest = sortedShelters[0] || sheltersList[0] || DEFAULT_SHELTERS[0]
  const availableNearest = sortedShelters.find(s => s.capacity_available > 0)
  // Posko yang ditampilkan di Card 3: dialihkan otomatis ke yang tersedia jika terdekat penuh
  const nearest = availableNearest || physicalNearest

  // Route calculation with robust multi-tier fallback
  const handleSelectShelter = useCallback(async (shelter) => {
    if (!shelter) return
    setSelectedShelter(shelter)
    setRouteLoading(true)
    try {
      const res = await getRouteToShelter(
        shelter.id,
        userLocation[0],
        userLocation[1],
        shelter.latitude,
        shelter.longitude
      )
      if (res && res.coordinates && res.coordinates.length > 0) {
        setRouteData(res)
      } else {
        // Fallback straight line between user coordinate and shelter
        setRouteData({
          coordinates: [
            [userLocation[1], userLocation[0]],
            [shelter.longitude, shelter.latitude]
          ],
          distance_km: shelter.distanceStr || '1.0',
          duration_minutes: Math.max(1, Math.round(parseFloat(shelter.distanceStr || 1) * 2.5)),
          is_fallback: true
        })
      }
    } catch {
      // Fallback straight line if network/OSRM is unavailable
      setRouteData({
        coordinates: [
          [userLocation[1], userLocation[0]],
          [shelter.longitude, shelter.latitude]
        ],
        distance_km: shelter.distanceStr || '1.0',
        duration_minutes: Math.max(1, Math.round(parseFloat(shelter.distanceStr || 1) * 2.5)),
        is_fallback: true
      })
    } finally {
      setRouteLoading(false)
    }
  }, [userLocation])

  // Automatically select and draw route to nearest shelter on Peta & Posko view mount
  useEffect(() => {
    if (isMapView && nearest && !selectedShelter) {
      handleSelectShelter(nearest)
    }
  }, [isMapView, nearest, selectedShelter, handleSelectShelter])

  const leafletRouteCoords = useMemo(() => {
    if (!routeData?.coordinates || routeData.coordinates.length < 2) return null
    return routeData.coordinates.map(c => [c[1], c[0]])
  }, [routeData])

  // =========================================================================
  // VIEW MODE: PETA & POSKO (Screenshot 2)
  // =========================================================================
  if (isMapView) {
    return (
      <div className="warga-peta-view">
        <div className="peta-posko-kicker">Peta &amp; Posko</div>
        <h1 className="peta-posko-title">Risiko banjir per desa</h1>

        {/* Info / Emergency Banner */}
        <div className="peta-info-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            {isAwas 
              ? 'Status AWAS AKTIF! Rute evakuasi dibuka. Segera menuju posko atau kirim SOS bila terjebak.'
              : 'Rute evakuasi dan permintaan SOS hanya dibuka saat status Awas. Saat ini kamu cukup memantau.'}
          </span>
          {isAwas && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('sos')}
              style={{
                marginLeft: 'auto',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🚨 Minta Bantuan SOS
            </button>
          )}
        </div>

        {/* Split Grid: Left Map (2/3), Right Posko List (1/3) */}
        <div className="peta-split-grid">
          {/* Left: Interactive Map Card */}
          <div className="peta-map-card">
            {selectedShelter && (
              <div className="peta-route-active-banner">
                <div className="route-banner-left">
                  <div className="route-banner-pin-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                  </div>
                  <div className="route-banner-text">
                    <div className="route-banner-title">
                      <span>Rute Evakuasi Menuju:</span> <strong>{selectedShelter.name}</strong>
                      {routeLoading && <span className="route-pill-loading"> (Menghitung rute...)</span>}
                    </div>
                    <div className="route-banner-meta">
                      <span className="route-meta-stat">
                        📏 <strong>{routeData?.distance_km || selectedShelter.distanceStr} km</strong>
                      </span>
                      <span className="route-meta-bullet">•</span>
                      <span className="route-meta-stat">
                        ⏱️ Est. <strong>~{routeData?.duration_minutes || Math.max(2, Math.round(parseFloat(selectedShelter.distanceStr || 1) * 2.5))} menit</strong>
                      </span>
                      <span className="route-meta-bullet">•</span>
                      <span className="route-meta-stat">
                        Sisa kuota: <strong>{selectedShelter.capacity_available} orang</strong> ({selectedShelter.status_label})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="route-banner-actions">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${selectedShelter.latitude},${selectedShelter.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-route-gmaps"
                    title="Buka petunjuk navigasi langsung di Google Maps"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Buka Google Maps
                  </a>
                </div>
              </div>
            )}

            <div className="peta-map-wrapper">
              <RiskMap
                height="100%"
                shelters={sheltersList}
                userLocation={userLocation}
                selectedShelterId={selectedShelter?.id}
                onSelectShelter={handleSelectShelter}
                routeCoordinates={leafletRouteCoords}
              />
            </div>

            {/* Bottom Legend */}
            <div className="peta-legend-strip">
              <span className="peta-legend-item">
                <span className="dot" style={{ backgroundColor: '#10b981' }} />
                <span>Aman</span>
              </span>
              <span className="peta-legend-item">
                <span className="dot" style={{ backgroundColor: '#f59e0b' }} />
                <span>Waspada</span>
              </span>
              <span className="peta-legend-item">
                <span className="dot" style={{ backgroundColor: '#ea580c' }} />
                <span>Siaga</span>
              </span>
              <span className="peta-legend-item">
                <span className="dot" style={{ backgroundColor: '#ef4444' }} />
                <span>Awas</span>
              </span>
              <span className="peta-legend-item">
                <span className="dot" style={{ backgroundColor: '#0284c7' }} />
                <span>Lokasimu</span>
              </span>
              <span className="peta-legend-item">
                <span className="legend-route-line" />
                <span>Rute Evakuasi</span>
              </span>
            </div>
          </div>

          {/* Right: Posko Column with Nearest Kanban Card */}
          <div className="posko-column-wrap">
            {/* KANBAN / CARD UTAMA: POSKO TERDEKAT (REAL GPS DEVICE) */}
            {nearest && (
              <div className="posko-nearest-featured-card">
                <div className="posko-nearest-badge-row">
                  <div className="posko-nearest-badge">
                    <span className="pulse-dot-nearest" />
                    <span>🎯 POSKO TERDEKAT</span>
                  </div>
                  <span className="posko-gps-source-tag">
                    {geo.isRealDevice ? '📍 GPS Real Device' : '📍 Lokasi Terdeteksi'}
                  </span>
                </div>

                <div className="posko-nearest-title-row">
                  <h4>{nearest.name}</h4>
                  <span className={`status-badge-pill status-${nearest.status_color_class === 'green' ? 'aman' : nearest.status_color_class === 'yellow' ? 'waspada' : 'awas'}`}>
                    {nearest.status_label}
                  </span>
                </div>

                <div className="posko-nearest-distance-badge">
                  <span className="distance-num">{nearest.distanceStr} km</span>
                  <span className="distance-desc">
                    dari lokasimu {geo.address ? `(${geo.address.split(',')[0].replace(/^Desa\s+/i, '')})` : ''}
                  </span>
                </div>

                <p className="posko-nearest-address">
                  {nearest.address}
                </p>

                <div className="posko-capacity-bar-track">
                  <div 
                    className={`posko-capacity-bar-fill ${nearest.status_color_class}`}
                    style={{ width: `${nearest.occupancy_percent}%` }}
                  />
                </div>
                <div className="posko-nearest-quota-row">
                  <span>Sisa kuota: <strong>{nearest.capacity_available}</strong> dari {nearest.capacity_total} orang</span>
                  <span>{nearest.occupancy_percent}% terisi</span>
                </div>

                <div className="posko-nearest-action-btns">
                  <button
                    type="button"
                    className="btn-nearest-route"
                    onClick={() => handleSelectShelter(nearest)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <span>{selectedShelter?.id === nearest.id ? '✓ Rute Terpilih di Peta' : 'Pilih & Lihat Rute'}</span>
                  </button>

                  {nearest.contact_phone && (
                    <a href={`tel:${nearest.contact_phone}`} className="btn-nearest-call" title="Hubungi Petugas Posko">
                      📞 Hubungi
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="posko-col-header" style={{ marginTop: '6px' }}>
              <strong>Daftar Semua Posko</strong>
              <span>{sortedShelters.length} lokasi (urut terdekat)</span>
            </div>

            {sortedShelters.map((posko) => (
              <div 
                key={posko.id} 
                className={`posko-item-card ${selectedShelter?.id === posko.id ? 'selected' : ''}`}
                onClick={() => handleSelectShelter(posko)}
                style={{ cursor: 'pointer' }}
              >
                <div className="posko-card-top">
                  <strong>{posko.name}</strong>
                  <span className={`status-badge-pill status-${posko.status_color_class === 'green' ? 'aman' : posko.status_color_class === 'yellow' ? 'waspada' : 'awas'}`}>
                    {posko.status_label}
                  </span>
                </div>
                <div className="posko-card-sub">
                  {posko.distanceStr} km • {posko.address}
                </div>

                <div className="posko-capacity-bar-track">
                  <div 
                    className={`posko-capacity-bar-fill ${posko.status_color_class}`}
                    style={{ width: `${posko.occupancy_percent}%` }}
                  />
                </div>
                <div className="posko-card-quota-text">
                  Sisa {posko.capacity_available} dari {posko.capacity_total} orang
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW MODE: BERANDA (Screenshot 1)
  // =========================================================================
  return (
    <div className="warga-beranda-view">
      {/* Header Row: Greeting & Village Selector */}
      <div className="warga-beranda-head">
        <div className="warga-greeting-wrap">
          <span className="greeting-sub">Halo, {userProfile?.full_name ? userProfile.full_name.split(' ')[0] : 'Ahmad'}</span>
          <h1>Kondisi banjir di desamu</h1>
        </div>

        <button 
          type="button" 
          className="warga-village-picker-btn"
          onClick={onOpenLocationModal}
          title="Ganti desa domisili"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>
            {(() => {
              const v = BAURENO_VILLAGES.find(item => item.id === Number(selectedVillageId || userProfile?.village_id))
              return v ? `Desa ${v.name.replace(' (Pusat)', '')}` : 'Desa Baureno'
            })()}
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>▾</span>
        </button>
      </div>

      {/* Hero Overview Card with Donut Chart */}
      <div className="warga-hero-card">
        <div className="warga-donut-gauge-box">
          <svg width="125" height="125" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="#edf2f7"
              strokeWidth="11"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke={isAman ? '#009aa6' : isWaspada ? '#f59e0b' : isSiaga ? '#ea580c' : '#ef4444'}
              strokeWidth="11"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="warga-donut-inner-text">
            <strong>{probVal}<span>%</span></strong>
            <small>peluang banjir</small>
          </div>
        </div>

        <div className="warga-hero-status-col">
          <span className={`status-badge-pill status-${isAman ? 'aman' : isWaspada ? 'waspada' : isSiaga ? 'siaga' : 'awas'}`}>
            {isAman ? 'STATUS AMAN' : isWaspada ? 'STATUS WASPADA' : isSiaga ? 'STATUS SIAGA' : 'STATUS AWAS'}
          </span>
          <h2>
            {isAman ? 'Kondisi masih aman' : isWaspada ? 'Mulai Waspada' : isSiaga ? 'Siaga Banjir' : 'Awas Banjir Parah'}
          </h2>
          <p>
            {isAman 
              ? 'Tidak ada tanda banjir dalam waktu dekat. Cukup pantau informasi seperti biasa.' 
              : 'Terjadi peningkatan debit sungai. Pantau peringatan dan siapkan dokumen penting.'}
          </p>
          <span className="warga-hero-meta">Desa Baureno • Diperbarui 21.00</span>
        </div>
      </div>

      {/* 2x2 Cards Grid */}
      <div className="warga-2x2-grid">
        {/* Card 1: Yang perlu kamu lakukan sekarang */}
        <div className="warga-card">
          <h3 className="warga-card-title">Yang perlu kamu lakukan sekarang</h3>
          
          <div className="warga-steps-list">
            <div className="warga-step-row">
              <span className="warga-step-num">1</span>
              <span className="warga-step-text">Pantau info cuaca &amp; debit sungai</span>
            </div>
            <div className="warga-step-row">
              <span className="warga-step-num">2</span>
              <span className="warga-step-text">Pastikan nomor darurat tersimpan</span>
            </div>
            <div className="warga-step-row">
              <span className="warga-step-num">3</span>
              <span className="warga-step-text">Kenali lokasi posko terdekat</span>
            </div>
          </div>

          <button 
            type="button" 
            className="warga-card-link"
            onClick={() => onNavigate && onNavigate('panduan')}
          >
            <span>Baca panduan lengkap</span>
            <span>›</span>
          </button>
        </div>

        {/* Card 2: Kondisi sekitar */}
        <div className="warga-card">
          <h3 className="warga-card-title">Kondisi sekitar</h3>

          <div className="warga-metrics-pair">
            <div className="warga-metric-subcard">
              <span className="metric-label">Curah hujan</span>
              <div className="metric-val">
                {isSevereFlood ? '148.0' : (data?.weather?.precipitation_mm != null ? Number(data.weather.precipitation_mm).toFixed(1) : '2.4')} <span>mm</span>
              </div>
            </div>
            <div className="warga-metric-subcard">
              <span className="metric-label">Debit sungai</span>
              <div className="metric-val">
                {isSevereFlood ? '1.950' : Math.round(data?.discharge?.discharge_m3s || 1210).toLocaleString('id-ID')} <span>m³/s</span>
              </div>
            </div>
          </div>

          <div className="warga-status-indicators-strip">
            <div className={`warga-status-indicator-box ${isAman ? 'active' : ''}`}>
              <span className="ind-title"><span style={{ color: '#10b981' }}>●</span> Aman</span>
              <span className="ind-sub">0–25%</span>
            </div>
            <div className={`warga-status-indicator-box ${isWaspada ? 'active' : ''}`}>
              <span className="ind-title"><span style={{ color: '#f59e0b' }}>●</span> Waspada</span>
              <span className="ind-sub">26–50%</span>
            </div>
            <div className={`warga-status-indicator-box ${isSiaga ? 'active' : ''}`}>
              <span className="ind-title"><span style={{ color: '#ea580c' }}>●</span> Siaga</span>
              <span className="ind-sub">51–75%</span>
            </div>
            <div className={`warga-status-indicator-box ${isAwas ? 'active' : ''}`}>
              <span className="ind-title"><span style={{ color: '#ef4444' }}>●</span> Awas</span>
              <span className="ind-sub">76–100%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Posko terdekat (PRD Section 4.2: Sisa Kuota Real-time & Smart Fallback) */}
        <div className="warga-card">
          <div className="warga-card-header-row">
            <h3 className="warga-card-title" style={{ margin: 0 }}>Posko terdekat</h3>
            <span className={`posko-info-badge ${nearest.capacity_available === 0 ? 'full' : ''}`}>
              {physicalNearest.capacity_available === 0 && availableNearest 
                ? 'Rekomendasi Alternatif' 
                : (nearest.capacity_available === 0 ? 'Penuh' : 'Tersedia')}
            </span>
          </div>

          <div className="warga-posko-main-info">
            <strong>{nearest.name}</strong>
            <span className={`posko-avail-pill ${nearest.status_color_class}`}>
              {nearest.capacity_available > 0 
                ? `${nearest.status_label} • sisa ${nearest.capacity_available} orang` 
                : 'Kapasitas Penuh (0 sisa)'}
            </span>
          </div>
          <div className="warga-posko-distance">{nearest.distanceStr} km dari lokasimu • {nearest.address}</div>
          <p className="warga-posko-subnote">
            {physicalNearest.capacity_available === 0 && availableNearest && physicalNearest.id !== nearest.id
              ? `Dialihkan otomatis ke ${nearest.name} (${nearest.distanceStr} km) karena posko ${physicalNearest.name} sudah penuh.`
              : 'Rute evakuasi akan dibuka otomatis jika status menjadi Awas.'}
          </p>

          <button 
            type="button" 
            className="warga-card-link"
            onClick={() => {
              if (onNavigate) {
                onNavigate('peta')
                handleSelectShelter(nearest)
              }
            }}
          >
            <span>Buka peta &amp; pilih posko</span>
            <span>›</span>
          </button>
        </div>

        {/* Card 4: Peringatan terbaru */}
        <div className="warga-card">
          <h3 className="warga-card-title">Peringatan terbaru</h3>
          <p className="warga-alert-empty-text">
            Belum ada peringatan. Kami akan memberi tahu jika status desamu berubah.
          </p>
        </div>
      </div>

      {/* Quick Navigation 3 Pills Row */}
      <div className="warga-quick-nav-row">
        <button 
          type="button" 
          className="warga-quick-pill-btn"
          onClick={() => onNavigate && onNavigate('kontak')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2.2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>Kontak darurat</span>
        </button>

        <button 
          type="button" 
          className="warga-quick-pill-btn"
          onClick={() => onNavigate && onNavigate('riwayat')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Riwayat banjir</span>
        </button>

        <button 
          type="button" 
          className="warga-quick-pill-btn"
          onClick={() => onNavigate && onNavigate('panduan')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2.2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Panduan siaga</span>
        </button>
      </div>

      {/* Simulation / Demo Mode Strip */}
      <div 
        className="warga-demo-strip"
        style={{
          background: isSevereFlood ? '#fef2f2' : '#f8fafc',
          border: isSevereFlood ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
          padding: '14px 20px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '22px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.25rem' }}>{isSevereFlood ? '🚨' : '🧪'}</span>
          <div>
            <strong style={{ color: isSevereFlood ? '#b91c1c' : '#334155', fontSize: '0.86rem', display: 'block' }}>
              {isSevereFlood ? 'Simulasi Banjir Parah Aktif (Awas Level 4)' : 'Mode Pengujian Skenario Banjir'}
            </strong>
            <span style={{ fontSize: '0.78rem', color: isSevereFlood ? '#dc2626' : '#64748b' }}>
              {isSevereFlood 
                ? 'TMA 5.4m, debit sungai 1.950 m³/s, risiko 94%. Form evakuasi SOS siap diuji.' 
                : 'Uji simulasi banjir parah untuk mencoba pengiriman form SOS darurat dan verifikasi admin.'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isSevereFlood && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('sos')}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)'
              }}
            >
              🚨 Kirim Form SOS Sekarang ➔
            </button>
          )}
          <button 
            type="button" 
            className="demo-action-btn"
            style={{
              background: isSevereFlood ? '#ffffff' : '#0f172a',
              color: isSevereFlood ? '#dc2626' : '#ffffff',
              border: isSevereFlood ? '1.5px solid #f87171' : 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => {
              const next = !isSevereFlood
              setSimulatedEmergency(next)
              if (onToggleSimulatedEmergency) {
                onToggleSimulatedEmergency(next)
              }
            }}
          >
            {isSevereFlood ? '✕ Matikan Simulasi (Kembali ke Kondisi Real)' : '⚡ Aktifkan Simulasi Banjir Parah'}
          </button>
        </div>
      </div>
    </div>
  )
}
