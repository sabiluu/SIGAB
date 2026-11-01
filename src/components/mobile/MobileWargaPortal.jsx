import { useState, useEffect, useMemo } from 'react'
import { logout, getProfile } from '../../services/authService'
import { apiFetch } from '../../services/api'
import { getSOSTickets, createSOSTicket } from '../../services/sosService'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import useGeolocation, { BAURENO_VILLAGES } from '../../hooks/useGeolocation'
import RiskMap from '../../components/RiskMap'
import LogoutModal from '../../components/common/LogoutModal'
import ProfileModal from '../../components/warga/ProfileModal'
import '../../styles/mobile.css'

export default function MobileWargaView() {
  const [activeTab, setActiveTab] = useState('beranda') // 'beranda' | 'peta' | 'sos' | 'panduan' | 'kontak'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userProfile, setUserProfile] = useState({ full_name: 'Warga Baureno', email: '', phone: '081234567890', village_id: 3 })
  const [selectedVillageId, setSelectedVillageId] = useState(3)
  const [isSimulatedDanger, setIsSimulatedDanger] = useState(false)
  const [showVillageSheet, setShowVillageSheet] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  // Real-time API data & GPS hook
  const { data: realtimeData } = useDashboardRealtime()
  const geo = useGeolocation()

  // Route & Posko state
  const [selectedShelterId, setSelectedShelterId] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // SOS state
  const [myTickets, setMyTickets] = useState([])
  const [sosFamilyCount, setSosFamilyCount] = useState(3)
  const [sosPatokan, setSosPatokan] = useState('')
  const [sosElderly, setSosElderly] = useState(true)
  const [sosToddler, setSosToddler] = useState(false)
  const [sosPregnant, setSosPregnant] = useState(false)
  const [sosDisability, setSosDisability] = useState(false)
  const [sosSubmitting, setSosSubmitting] = useState(false)
  const [sosSuccessMsg, setSosSuccessMsg] = useState('')
  const [sosErrorMsg, setSosErrorMsg] = useState('')

  // Load user profile & SOS tickets
  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setUserProfile(p)
          if (p.village_id) setSelectedVillageId(Number(p.village_id))
        }
      })
      .catch(() => {})

    loadTickets()
    const t = setInterval(loadTickets, 12000)
    return () => clearInterval(t)
  }, [])

  const loadTickets = async () => {
    try {
      const list = await getSOSTickets()
      if (Array.isArray(list)) setMyTickets(list)
    } catch (_) {}
  }

  // Normalize villages & shelters
  const villages = useMemo(() => {
    const raw = realtimeData?.villages || []
    if (raw.length === 0) {
      return BAURENO_VILLAGES.map((v) => ({
        id: v.id,
        name: v.name.replace(' (Pusat)', ''),
        cleanName: v.name.replace(/^Desa\s+/i, '').replace(' (Pusat)', ''),
        probability: 18.5,
        risk_level: 'aman',
        latitude: v.lat,
        longitude: v.lng,
      }))
    }
    return raw.map((v) => {
      const prob = Number(v.current_probability ?? v.probability ?? 18.0)
      const cleanName = (v.name || 'Baureno').replace(/^Desa\s+/i, '').trim()
      return {
        ...v,
        cleanName,
        probability: prob,
        risk_level: prob >= 76 ? 'awas' : prob >= 51 ? 'siaga' : prob >= 25 ? 'waspada' : 'aman',
      }
    })
  }, [realtimeData])

  const shelters = useMemo(() => {
    const raw = realtimeData?.shelters || []
    if (raw.length > 0) return raw
    return [
      {
        id: 1,
        name: 'Posko Balai Kecamatan Baureno',
        address: 'Jl. Raya Baureno No. 12, Baureno',
        village_id: 3,
        latitude: -7.129,
        longitude: 112.105,
        capacity_total: 500,
        capacity_occupied: 45,
        contact_person: 'Petugas BPBD',
        contact_phone: '08111222333',
      },
      {
        id: 2,
        name: 'Posko SDN Baureno 1',
        address: 'Jl. Pendidikan Baureno',
        village_id: 3,
        latitude: -7.125,
        longitude: 112.11,
        capacity_total: 300,
        capacity_occupied: 20,
        contact_person: 'Tim Relawan',
        contact_phone: '08123456789',
      },
    ]
  }, [realtimeData])

  const activeVillage = useMemo(() => {
    const found = villages.find((v) => Number(v.id) === Number(selectedVillageId)) || villages[0]
    if (!found) {
      return { id: 3, cleanName: 'Baureno', probability: 18.0, risk_level: 'aman', latitude: -7.1282, longitude: 112.1039 }
    }
    if (isSimulatedDanger) {
      return { ...found, probability: 94.0, risk_level: 'awas' }
    }
    return found
  }, [villages, selectedVillageId, isSimulatedDanger])

  // Validasi Darurat: Pengiriman SOS HANYA aktif jika status desa AWAS (prob >= 76%) ATAU tombol Simulasi Bahaya ON
  const isEmergency = useMemo(() => {
    return Boolean(
      isSimulatedDanger ||
      activeVillage.risk_level === 'awas' ||
      Number(activeVillage.probability) >= 76
    )
  }, [isSimulatedDanger, activeVillage])

  // Handler klik tombol SOS: jika belum darurat & simulasi off, tampilkan modal tolak otomatis
  const handleSOSClick = () => {
    if (!isEmergency) {
      setShowRejectModal(true)
    } else {
      setActiveTab('sos')
    }
  }

  const selectedShelter = useMemo(() => {
    if (selectedShelterId) {
      const s = shelters.find((sh) => Number(sh.id) === Number(selectedShelterId))
      if (s) return s
    }
    return shelters[0]
  }, [shelters, selectedShelterId])

  // Fetch OSRM Road Route whenever shelter or GPS changes
  useEffect(() => {
    if (!selectedShelter) return
    let active = true
    const uLat = geo.latitude || -7.1155
    const uLon = geo.longitude || 112.0835

    const loadRoute = async () => {
      setLoadingRoute(true)
      try {
        const res = await apiFetch(`/shelters/${selectedShelter.id}/route?user_lat=${uLat}&user_lon=${uLon}`)
        if (active && res && Array.isArray(res.coordinates) && res.coordinates.length >= 2) {
          setRouteData({
            coordinates: res.coordinates.map((c) => [c[1], c[0]]),
            distance_km: Number(res.distance_km || 2.1).toFixed(2),
            duration_minutes: Math.max(1, Math.round(Number(res.duration_minutes || 6))),
            shelterName: selectedShelter.name,
            destLat: selectedShelter.latitude,
            destLon: selectedShelter.longitude,
          })
          setLoadingRoute(false)
          return
        }
      } catch (_) {}

      // Fallback OSRM direct
      try {
        const r = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${uLon},${uLat};${selectedShelter.longitude},${selectedShelter.latitude}?overview=full&geometries=geojson`
        )
        const d = await r.json()
        if (active && d?.routes?.[0]?.geometry?.coordinates) {
          const coords = d.routes[0].geometry.coordinates.map((c) => [c[1], c[0]])
          setRouteData({
            coordinates: coords,
            distance_km: ((d.routes[0].distance || 2100) / 1000).toFixed(2),
            duration_minutes: Math.max(1, Math.round((d.routes[0].duration || 300) / 60)),
            shelterName: selectedShelter.name,
            destLat: selectedShelter.latitude,
            destLon: selectedShelter.longitude,
          })
          setLoadingRoute(false)
          return
        }
      } catch (_) {}

      if (active) {
        setRouteData({
          coordinates: [
            [uLat, uLon],
            [selectedShelter.latitude || -7.129, selectedShelter.longitude || 112.105],
          ],
          distance_km: '2.10',
          duration_minutes: 6,
          shelterName: selectedShelter.name,
          destLat: selectedShelter.latitude || -7.129,
          destLon: selectedShelter.longitude || 112.105,
        })
        setLoadingRoute(false)
      }
    }

    loadRoute()
    return () => {
      active = false
    }
  }, [selectedShelter, geo.latitude, geo.longitude])

  const handleSendSOS = async (e) => {
    e.preventDefault()
    if (!isEmergency) {
      setSosErrorMsg('Pengiriman SOS ditolak otomatis. Fitur panggilan darurat hanya aktif saat status wilayah DARURAT / AWAS atau saat mode Simulasi Bahaya dinyalakan.')
      setShowRejectModal(true)
      return
    }
    setSosSubmitting(true)
    setSosErrorMsg('')
    setSosSuccessMsg('')
    try {
      const uLat = geo.latitude || -7.1155
      const uLon = geo.longitude || 112.0835
      await createSOSTicket({
        name: userProfile.full_name || 'Warga Baureno',
        phone: userProfile.phone || '081234567890',
        village_id: Number(activeVillage.id || 3),
        gps_latitude: uLat,
        gps_longitude: uLon,
        gps_address: `Desa ${activeVillage.cleanName}, Kec. Baureno`,
        patokan: sosPatokan || `Dekat Balai Desa ${activeVillage.cleanName}`,
        family_count: Number(sosFamilyCount) || 1,
        has_elderly: sosElderly,
        has_toddler: sosToddler,
        has_pregnant: sosPregnant,
        has_disability: sosDisability,
        is_simulation: Boolean(isSimulatedDanger),
      })
      setSosSuccessMsg(
        isSimulatedDanger
          ? '🚨 [MODE SIMULASI] Sinyal SOS simulasi berhasil dikirim ke Pusdalops BPBD Baureno!'
          : 'Sinyal SOS darurat berhasil dikirim ke Pusdalops BPBD Baureno! Tim sedang memverifikasi lokasi Anda.'
      )
      setSosPatokan('')
      loadTickets()
    } catch (err) {
      setSosErrorMsg(err.message || 'Gagal mengirim tiket SOS.')
    } finally {
      setSosSubmitting(false)
    }
  }

  const dischargeVal = realtimeData?.discharge?.discharge_m3s
    ? Number(realtimeData.discharge.discharge_m3s).toFixed(2)
    : '1.28'
  const rainVal = realtimeData?.weather?.precipitation_mm
    ? Number(realtimeData.weather.precipitation_mm).toFixed(1)
    : '0.0'

  const riskLabelMap = {
    aman: 'AMAN',
    waspada: 'WASPADA',
    siaga: 'SIAGA',
    awas: 'AWAS / DARURAT',
  }

  return (
    <div className="sigab-mobile-root" style={{ paddingBottom: '78px' }}>
      {/* 1. STICKY MOBILE TOP HEADER */}
      <header className="m-top-header">
        <div className="m-brand" onClick={() => setActiveTab('beranda')} style={{ cursor: 'pointer' }}>
          <div className="m-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
              <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
              <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
            </svg>
          </div>
          <div className="m-brand-text">
            <span className="m-brand-title">SIGAB Warga</span>
            <span className="m-brand-sub">Desa {activeVillage.cleanName}</span>
          </div>
        </div>

        <div className="m-header-actions">
          {/* Simulasi Bahaya Pill Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulatedDanger(!isSimulatedDanger)}
            style={{
              background: isSimulatedDanger ? '#dc2626' : '#f1f5f9',
              color: isSimulatedDanger ? '#ffffff' : '#475569',
              border: isSimulatedDanger ? 'none' : '1px solid #cbd5e1',
              borderRadius: '999px',
              padding: '5px 10px',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isSimulatedDanger ? '🚨 Simulasi AWAS ON' : '🧪 Simulasi Bahaya'}
          </button>

          {/* Village Switcher Button */}
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setShowVillageSheet(true)}
            title="Pilih Desa"
          >
            📍
          </button>

          {/* Hamburger Drawer Button */}
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </header>

      {/* SLIDE-OUT MOBILE DRAWER */}
      {drawerOpen && (
        <div className="m-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="m-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid #edf2f7' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{userProfile.full_name || 'Warga Baureno'}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Desa {activeVillage.cleanName} • Kec. Baureno</div>
              </div>
              <button type="button" className="m-icon-btn" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            <button type="button" className={`m-drawer-link ${activeTab === 'beranda' ? 'active' : ''}`} onClick={() => { setActiveTab('beranda'); setDrawerOpen(false) }}>
              <span>🏠</span> Beranda Status Desa
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'peta' ? 'active' : ''}`} onClick={() => { setActiveTab('peta'); setDrawerOpen(false) }}>
              <span>🗺️</span> Peta & Posko Evakuasi
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'riwayat' ? 'active' : ''}`} onClick={() => { setActiveTab('riwayat'); setDrawerOpen(false) }}>
              <span>🕒</span> Riwayat Tiket & Banjir
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'panduan' ? 'active' : ''}`} onClick={() => { setActiveTab('panduan'); setDrawerOpen(false) }}>
              <span>📘</span> Panduan & Ceklis Siaga
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'darurat' || activeTab === 'kontak' ? 'active' : ''}`} onClick={() => { setActiveTab('darurat'); setDrawerOpen(false) }}>
              <span>📞</span> Layanan Darurat BPBD
            </button>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="m-btn m-btn-outline"
                onClick={() => {
                  setDrawerOpen(false)
                  setShowProfileModal(true)
                }}
              >
                👤 Profil Saya
              </button>
              <button
                type="button"
                className="m-btn m-btn-danger"
                onClick={() => {
                  setDrawerOpen(false)
                  setShowLogoutModal(true)
                }}
              >
                Keluar Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{ padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ==============================================================
            TAB 1: BERANDA WARGA
           ============================================================== */}
        {activeTab === 'beranda' && (
          <>
            {/* Status Card Desa */}
            <section
              className="m-card"
              style={{
                background: activeVillage.risk_level === 'awas'
                  ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                  : 'linear-gradient(135deg, #0c1a24 0%, #132c3d 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', color: '#94a3b8' }}>
                  STATUS WILAYAH ANDA
                </span>
                <span className={`m-badge ${activeVillage.risk_level}`}>
                  {riskLabelMap[activeVillage.risk_level] || 'AMAN'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 4px', color: '#ffffff' }}>
                    Desa {activeVillage.cleanName}
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                    Kecamatan Baureno, Bojonegoro
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.85rem', fontWeight: 900, lineHeight: 1 }}>
                    {Math.round(activeVillage.probability)}%
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1', marginTop: '3px' }}>
                    Indeks Risiko
                  </div>
                </div>
              </div>

              {/* 3 Compact Telemetry Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>Debit Sungai</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: '2px' }}>{dischargeVal} m³/s</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>Curah Hujan</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: '2px' }}>{rainVal} mm/j</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>Posko Siap</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: '2px' }}>{shelters.length} Lokasi</div>
                </div>
              </div>
            </section>

            {/* Emergency Action Banner (Recommended Sequence: 1. Cek Rute -> 2. Kirim SOS) */}
            <section
              className="m-card"
              style={{
                background: activeVillage.risk_level === 'awas' ? '#fef2f2' : '#f0fdfa',
                borderColor: activeVillage.risk_level === 'awas' ? '#fecaca' : '#99f6e4',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: activeVillage.risk_level === 'awas' ? '#dc2626' : '#0f766e', marginBottom: '6px' }}>
                {activeVillage.risk_level === 'awas'
                  ? '⚠️ PERINGATAN DARURAT BANJIR (LEVEL AWAS)'
                  : '🧭 LANGKAH KESIAPSIAGAAN WARGA'}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: '0 0 12px' }}>
                {activeVillage.risk_level === 'awas'
                  ? 'Air sungai meningkat tajam! Cek rute evakuasi jalan raya menuju posko terdekat terlebih dahulu, atau kirim sinyal SOS jika butuh jemputan perahu karet.'
                  : 'Kenali jalur evakuasi terdekat dari posisi GPS Anda menuju Posko BPBD sebelum kondisi darurat.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="m-btn m-btn-teal"
                  onClick={() => setActiveTab('peta')}
                >
                  <span>1. Cek Rute Evakuasi Terdekat ({routeData ? `${routeData.distance_km} km` : 'OSRM'})</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  className="m-btn m-btn-danger"
                  onClick={handleSOSClick}
                >
                  <span>2. Kirim Sinyal SOS Darurat ke BPBD</span>
                  <span>🚨</span>
                </button>
              </div>
            </section>

            {/* Posko Terdekat Card */}
            {selectedShelter && (
              <section className="m-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#009aa6' }}>
                    🏕️ POSKO REKOMENDASI TERDEKAT
                  </span>
                  <span className="m-badge aman">Buka 24 Jam</span>
                </div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0c1a24', marginBottom: '4px' }}>
                  {selectedShelter.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px' }}>
                  {selectedShelter.address} • Jarak <strong>{routeData?.distance_km || '2.1'} km</strong> (~{routeData?.duration_minutes || 6} mnt)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: '5px' }}>
                  <span>Terisi: <strong>{selectedShelter.capacity_occupied || 0}</strong> / {selectedShelter.capacity_total || 200} jiwa</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>
                    Sisa {(selectedShelter.capacity_total || 200) - (selectedShelter.capacity_occupied || 0)} tempat
                  </span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(((selectedShelter.capacity_occupied || 0) / (selectedShelter.capacity_total || 200)) * 100))}%`,
                      background: '#10b981',
                    }}
                  />
                </div>
                <button type="button" className="m-btn m-btn-outline" onClick={() => setActiveTab('peta')}>
                  Tampilkan Garis Rute di Peta 🗺️
                </button>
              </section>
            )}

            {/* Status Desa Sekitar */}
            <section className="m-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>Status Desa di Kec. Baureno</h3>
                <button
                  type="button"
                  onClick={() => setShowVillageSheet(true)}
                  style={{ background: 'none', border: 'none', color: '#009aa6', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Pilih Desa ({villages.length}) →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {villages.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVillageId(v.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '11px',
                      border: Number(v.id) === Number(activeVillage.id) ? '1.5px solid #009aa6' : '1px solid #edf2f7',
                      background: Number(v.id) === Number(activeVillage.id) ? '#f0fdfa' : '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Desa {v.cleanName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Probabilitas {Number(v.probability).toFixed(1)}%</div>
                    </div>
                    <span className={`m-badge ${v.risk_level}`}>{v.risk_level.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 2: PETA & RUTE POSKO (OSRM POLYLINE)
           ============================================================== */}
        {activeTab === 'peta' && (
          <>
            <section className="m-card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Peta Risiko & Rute Evakuasi</h2>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    📍 Dari Desa {activeVillage.cleanName} ➔ 🎯 {selectedShelter?.name}
                  </div>
                </div>
                {routeData && (
                  <span className="m-badge aman">
                    {routeData.distance_km} km • {routeData.duration_minutes} mnt
                  </span>
                )}
              </div>

              <div className="m-map-frame" style={{ height: '300px', marginBottom: '12px' }}>
                <RiskMap
                  height="300px"
                  selectedVillageName={activeVillage.cleanName}
                  villagesData={villages}
                  shelters={shelters}
                  activeRoute={routeData}
                  userLocation={{
                    latitude: geo.latitude || -7.1155,
                    longitude: geo.longitude || 112.0835,
                    label: `Posisi Anda (${activeVillage.cleanName})`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="m-btn m-btn-danger"
                  onClick={handleSOSClick}
                >
                  🚨 Butuh Jemputan? Kirim SOS
                </button>
              </div>
            </section>

            {/* Daftar Pilihan Posko Evakuasi */}
            <section className="m-card">
              <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: 800 }}>
                Pilih Posko Tujuan ({shelters.length} Posko Aktif)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {shelters.map((sh) => {
                  const isSelected = Number(sh.id) === Number(selectedShelter?.id)
                  const occ = Number(sh.capacity_occupied || 0)
                  const tot = Number(sh.capacity_total || 200)
                  const pct = Math.min(100, Math.round((occ / tot) * 100))
                  return (
                    <div
                      key={sh.id}
                      onClick={() => setSelectedShelterId(sh.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #009aa6' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.86rem', color: '#0c1a24' }}>{sh.name}</strong>
                        <span className={`m-badge ${pct >= 90 ? 'awas' : 'aman'}`}>
                          {isSelected ? '🎯 Rute Aktif' : `${tot - occ} Kosong`}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px' }}>
                        {sh.address} • 📞 {sh.contact_phone || '08111222333'}
                      </div>
                      <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#dc2626' : '#009aa6' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                        <span>Terisi {occ}/{tot} jiwa ({pct}%)</span>
                        <span style={{ color: '#009aa6', fontWeight: 700 }}>
                          {loadingRoute && isSelected ? 'Menghitung rute...' : 'Ketuk untuk lihat rute'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 3: KIRIM SINYAL SOS & TRACKER TIKET
           ============================================================== */}
        {activeTab === 'sos' && (
          <>
            <section className="m-card" style={{ borderTop: `4px solid ${isEmergency ? '#dc2626' : '#f59e0b'}` }}>
              <span className={`m-badge ${isEmergency ? 'awas' : 'waspada'}`} style={{ marginBottom: '8px' }}>
                {isEmergency ? '🚨 STATUS DARURAT AKTIF' : '🔒 PENGIRIMAN SOS TERKUNCI'}
              </span>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>
                Kirim Permintaan Evakuasi SOS
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                {isEmergency
                  ? 'Koordinat GPS dan jumlah anggota keluarga rentan akan langsung masuk ke layar utama Pusdalops BPBD Baureno.'
                  : 'Pengiriman SOS hanya diizinkan saat status wilayah DARURAT / AWAS atau saat mode Simulasi Bahaya dinyalakan.'}
              </p>

              {/* Locked Notice if Not in Emergency */}
              {!isEmergency && (
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1.5px dashed #f87171',
                    borderRadius: '13px',
                    padding: '14px',
                    marginBottom: '14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.75rem', marginBottom: '4px' }}>🔒</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
                    Pengiriman SOS Ditolak Otomatis
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: '12px' }}>
                    Status Desa {activeVillage.cleanName} saat ini masih{' '}
                    <strong>{riskLabelMap[activeVillage.risk_level] || 'AMAN'} ({Math.round(activeVillage.probability)}%)</strong>.
                    Pusdalops BPBD hanya menerima panggilan SOS saat kondisi <strong>DARURAT / AWAS</strong> (probabilitas ≥ 76%).
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSimulatedDanger(true)}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                    }}
                  >
                    <span>🧪</span> Nyalakan Simulasi Bahaya untuk Uji Coba SOS
                  </button>
                </div>
              )}

              {sosSuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '12px', borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px' }}>
                  ✅ {sosSuccessMsg}
                </div>
              )}
              {sosErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px' }}>
                  ⚠️ {sosErrorMsg}
                </div>
              )}

              <form onSubmit={handleSendSOS} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '11px', padding: '10px 12px', fontSize: '0.76rem' }}>
                  <div style={{ fontWeight: 700, color: '#0c1a24' }}>📍 Lokasi Terdeteksi: Desa {activeVillage.cleanName}</div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>
                    GPS: {(geo.latitude || -7.1155).toFixed(4)}, {(geo.longitude || 112.0835).toFixed(4)}
                  </div>
                </div>

                {/* Stepper Jumlah Jiwa */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Jumlah Anggota Keluarga yang Dievakuasi
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      disabled={!isEmergency}
                      onClick={() => setSosFamilyCount(Math.max(1, sosFamilyCount - 1))}
                      style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: isEmergency ? 'pointer' : 'not-allowed', opacity: isEmergency ? 1 : 0.6 }}
                    >
                      −
                    </button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
                      {sosFamilyCount} Jiwa
                    </div>
                    <button
                      type="button"
                      disabled={!isEmergency}
                      onClick={() => setSosFamilyCount(sosFamilyCount + 1)}
                      style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: isEmergency ? 'pointer' : 'not-allowed', opacity: isEmergency ? 1 : 0.6 }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Kelompok Rentan Checkboxes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Kelompok Rentan (Prioritas Penyelamatan)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { label: '👴 Lansia', val: sosElderly, set: setSosElderly },
                      { label: '👶 Balita', val: sosToddler, set: setSosToddler },
                      { label: '🤰 Ibu Hamil', val: sosPregnant, set: setSosPregnant },
                      { label: '♿ Disabilitas', val: sosDisability, set: setSosDisability },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={!isEmergency}
                        onClick={() => item.set(!item.val)}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: item.val ? '1.5px solid #dc2626' : '1px solid #dce5eb',
                          background: item.val ? '#fef2f2' : '#ffffff',
                          color: item.val ? '#dc2626' : '#334155',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: isEmergency ? 'pointer' : 'not-allowed',
                          opacity: isEmergency ? 1 : 0.6,
                          textAlign: 'left',
                        }}
                      >
                        {item.val ? '☑ ' : '☐ '} {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patokan Lokasi */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Patokan Rumah / Kondisi Saat Ini
                  </label>
                  <input
                    type="text"
                    disabled={!isEmergency}
                    value={sosPatokan}
                    onChange={(e) => setSosPatokan(e.target.value)}
                    placeholder="Contoh: Rumah pagar biru dekat Masjid, air setinggi lutut"
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid #dce5eb',
                      fontSize: '0.82rem',
                      opacity: isEmergency ? 1 : 0.6,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isEmergency || sosSubmitting}
                  className="m-btn m-btn-danger"
                  style={{
                    background: !isEmergency ? '#94a3b8' : '#dc2626',
                    cursor: !isEmergency ? 'not-allowed' : 'pointer',
                    opacity: !isEmergency ? 0.7 : 1,
                  }}
                >
                  {!isEmergency
                    ? '🔒 Pengiriman Ditolak (Nyalakan Simulasi Bahaya)'
                    : sosSubmitting
                    ? 'Mengirim Sinyal SOS...'
                    : '🚨 KIRIM SINYAL SOS SEKARANG'}
                </button>
              </form>
            </section>

            {/* Status Tiket SOS Terkini */}
            <section className="m-card">
              <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: 800 }}>
                Riwayat & Status Tiket SOS ({myTickets.length})
              </h3>
              {myTickets.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  Belum ada tiket SOS aktif.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myTickets.slice(0, 5).map((t) => (
                    <div key={t.id} style={{ padding: '12px', borderRadius: '11px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.82rem' }}>{t.ticket_number || `SOS-${t.id}`}</strong>
                        <span className={`m-badge ${t.status === 'completed' ? 'aman' : 'awas'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#334155' }}>
                        📍 {t.gps_address} • 👥 {t.family_count} jiwa (Skor Prioritas: {t.priority_score})
                      </div>
                      {t.assigned_unit && (
                        <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, marginTop: '4px' }}>
                          🚤 Tim Penjemput: {t.assigned_unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 4: PANDUAN SIAGA & CEKLIS KELUARGA
           ============================================================== */}
        {activeTab === 'panduan' && (
          <section className="m-card">
            <span className="m-badge aman" style={{ marginBottom: '8px' }}>SOP KESIAPSIAGAAN BPBD</span>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.12rem', fontWeight: 800 }}>
              Panduan & Ceklis Menghadapi Banjir
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  badge: 'Level 1 • AMAN (0–24%)',
                  cls: 'aman',
                  items: [
                    'Siapkan Tas Siaga Bencana (dokumen KTP/KK dalam plastik kedap air).',
                    'Simpan nomor darurat Pusdalops BPBD Bojonegoro (0353) 881-234.',
                    'Pastikan saluran air di sekitar rumah bebas dari sumbatan.',
                  ],
                },
                {
                  badge: 'Level 2 • WASPADA (25–50%)',
                  cls: 'waspada',
                  items: [
                    'Pindahkan barang elektronik dan surat berharga ke tempat tinggi.',
                    'Isi penuh baterai HP, powerbank, dan senter darurat.',
                    'Pantau pembaruan tinggi muka air Bengawan Solo di aplikasi SIGAB.',
                  ],
                },
                {
                  badge: 'Level 3 • SIAGA (51–75%)',
                  cls: 'siaga',
                  items: [
                    'Matikan aliran listrik (MCB) dan cabut regulator tabung gas LPG.',
                    'Ungsikan kelompok rentan (lansia, ibu hamil, balita, difabel) lebih dulu ke posko.',
                    'Cek peta rute aman di tab Peta & Rute.',
                  ],
                },
                {
                  badge: 'Level 4 • AWAS (76–100%)',
                  cls: 'awas',
                  items: [
                    'Segera tinggalkan area genangan menuju Posko Evakuasi terdekat.',
                    'Jangan menerobos arus deras; gunakan tombol SOS jika terjebak.',
                  ],
                },
              ].map((sec) => (
                <div key={sec.badge} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span className={`m-badge ${sec.cls}`} style={{ marginBottom: '8px' }}>{sec.badge}</span>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: '#334155', lineHeight: 1.55 }}>
                    {sec.items.map((it, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==============================================================
            TAB 3.5: RIWAYAT TIKET SOS & KEJADIAN BANJIR
           ============================================================== */}
        {activeTab === 'riwayat' && (
          <>
            {/* Status Tiket SOS Terkini */}
            <section className="m-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>Riwayat Tiket SOS</h3>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pelacakan status penjemputan perahu karet</div>
                </div>
                <span className="m-badge aman">{myTickets.length} Tiket</span>
              </div>
              {myTickets.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', padding: '18px 0', background: '#f8fafc', borderRadius: '12px' }}>
                  Belum ada riwayat permintaan SOS Anda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myTickets.map((t) => (
                    <div key={t.id} style={{ padding: '12px', borderRadius: '11px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.82rem' }}>{t.ticket_number || `SOS-${t.id}`}</strong>
                        <span className={`m-badge ${t.status === 'completed' ? 'aman' : 'awas'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#334155' }}>
                        📍 {t.gps_address} • 👥 {t.family_count} jiwa (Skor Prioritas: {t.priority_score})
                      </div>
                      {t.assigned_unit && (
                        <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, marginTop: '4px' }}>
                          🚤 Tim Penjemput: {t.assigned_unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Arsip Riwayat Banjir Baureno */}
            <section className="m-card">
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>Riwayat Banjir di Baureno</h3>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Catatan kejadian banjir luapan Bengawan Solo</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { date: '18 Februari 2024', peak: 'TMA 15.20 m', impact: 'Desa Kadungrejo, Baureno, Tanggungan tergenang 40-70 cm', status: 'Selesai' },
                  { date: '04 Maret 2023', peak: 'TMA 14.85 m', impact: 'Jalan poros desa Baureno-Pucangarum tergenang 30 cm', status: 'Selesai' },
                  { date: '21 Januari 2023', peak: 'TMA 15.05 m', impact: 'Area persawahan dan 85 KK di bantaran sungai dievakuasi', status: 'Selesai' },
                ].map((ev, i) => (
                  <div key={i} style={{ padding: '12px', borderRadius: '11px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#0c1a24' }}>📅 {ev.date}</strong>
                      <span className="m-badge waspada">{ev.peak}</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.45 }}>{ev.impact}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 5: LAYANAN DARURAT & KONTAK 24 JAM
           ============================================================== */}
        {(activeTab === 'darurat' || activeTab === 'kontak') && (
          <>
            {/* Quick SOS Trigger Banner */}
            <section className="m-card" style={{ borderTop: `4px solid ${isEmergency ? '#dc2626' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={`m-badge ${isEmergency ? 'awas' : 'waspada'}`}>
                  {isEmergency ? '🚨 STATUS DARURAT AKTIF' : 'ℹ️ LAYANAN EVAKUASI'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>24 Jam Siaga</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800 }}>Butuh Evakuasi Darurat BPBD?</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.45 }}>
                Kirimkan koordinat GPS dan rincian keluarga rentan Anda langsung ke monitor Pusdalops BPBD Baureno.
              </p>
              <button
                type="button"
                className="m-btn m-btn-danger"
                onClick={handleSOSClick}
              >
                <span>🚨 Buka Formulir Panggilan SOS</span>
              </button>
            </section>

            {/* Kontak Telepon Darurat */}
            <section className="m-card">
              <h2 style={{ margin: '0 0 6px', fontSize: '1.12rem', fontWeight: 800 }}>
                Kontak Darurat 24 Jam (Kec. Baureno)
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b' }}>
                Ketuk tombol telepon di bawah untuk langsung menghubungi petugas siaga.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Pusdalops BPBD Bojonegoro', role: 'Komando Utama Evakuasi & Perahu Karet', phone: '0353881234', display: '(0353) 881-234' },
                  { name: 'Posko Siaga Kecamatan Baureno', role: 'Koordinasi Posko & Logistik Warga', phone: '08113222333', display: '0811-3222-333' },
                  { name: 'Puskesmas Baureno (Ambulans)', role: 'Layanan Medis & Ibu Hamil/Lansia', phone: '0353891118', display: '(0353) 891-118' },
                  { name: 'Polsek & Koramil Baureno', role: 'Patroli Keamanan & Penyelamatan', phone: '110', display: 'Call Center 110' },
                ].map((c) => (
                  <div key={c.name} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0c1a24' }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{c.role}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00828f', marginTop: '4px' }}>📞 {c.display}</div>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      style={{
                        background: '#009aa6',
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        flexShrink: 0,
                      }}
                    >
                      Hubungi
                    </a>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* BOTTOM SHEET: PILIH DESA */}
      {showVillageSheet && (
        <div className="m-modal-overlay" onClick={() => setShowVillageSheet(false)}>
          <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Pilih Desa Domisili / Pantauan</h3>
              <button type="button" className="m-icon-btn" onClick={() => setShowVillageSheet(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
              {villages.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVillageId(v.id)
                    setShowVillageSheet(false)
                  }}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '11px',
                    border: Number(v.id) === Number(activeVillage.id) ? '2px solid #009aa6' : '1px solid #e2e8f0',
                    background: Number(v.id) === Number(activeVillage.id) ? '#f0fdfa' : '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0c1a24' }}>Desa {v.cleanName}</span>
                  <span className={`m-badge ${v.risk_level}`}>{Number(v.probability).toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE & LOGOUT MODALS */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => setUserProfile((prev) => ({ ...prev, ...updated }))}
      />
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />

      {/* MODAL PENOLAKAN SOS OTOMATIS */}
      {showRejectModal && (
        <div className="m-modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div
            className="m-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px 28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '30px',
                margin: '0 auto 14px',
              }}
            >
              🔒
            </div>

            <span className={`m-badge ${activeVillage.risk_level}`} style={{ marginBottom: '10px' }}>
              STATUS DESA: {riskLabelMap[activeVillage.risk_level] || 'AMAN'} ({Math.round(activeVillage.probability)}%)
            </span>

            <h3 style={{ margin: '8px 0 8px', fontSize: '1.18rem', fontWeight: 800, color: '#0f172a' }}>
              Pengiriman SOS Ditolak Otomatis
            </h3>

            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
              Mohon maaf, pengiriman tiket evakuasi SOS ke Pusdalops BPBD <strong>hanya aktif</strong> jika status wilayah berada pada level <strong>DARURAT / AWAS</strong> (probabilitas ≥ 76%), atau saat tombol <strong>Simulasi Bahaya</strong> dinyalakan.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '18px',
                textAlign: 'left',
                fontSize: '0.76rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              🧪 <strong>Ingin mencoba fitur pengiriman SOS?</strong>
              <br />
              Nyalakan mode <strong>Simulasi Bahaya</strong> untuk mengaktifkan status darurat simulasi (AWAS 94%) sehingga tombol pengiriman SOS dapat digunakan.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="m-btn m-btn-danger"
                style={{ width: '100%', padding: '13px', fontSize: '0.85rem', fontWeight: 800 }}
                onClick={() => {
                  setIsSimulatedDanger(true)
                  setShowRejectModal(false)
                  setActiveTab('sos')
                }}
              >
                🧪 Nyalakan Simulasi Bahaya & Buka SOS
              </button>

              <button
                type="button"
                className="m-btn m-btn-outline"
                style={{ width: '100%', padding: '11px', fontSize: '0.82rem' }}
                onClick={() => setShowRejectModal(false)}
              >
                Tutup & Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED 5-TAB MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="m-bottom-nav" aria-label="Navigasi Mobile Warga">
        <div className="m-nav-row">
          {/* Tab 1: Beranda */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'beranda' ? 'active' : ''}`}
            onClick={() => setActiveTab('beranda')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" />
                <path d="M10 21v-7a1 1 0 011-1h2a1 1 0 011 1v7" />
              </svg>
            </div>
            <span className="m-nav-label">Beranda</span>
          </button>

          {/* Tab 2: Peta & Posko */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'peta' ? 'active' : ''}`}
            onClick={() => setActiveTab('peta')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
            </div>
            <span className="m-nav-label">Peta & Posko</span>
          </button>

          {/* Tab 3: Riwayat */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'riwayat' ? 'active' : ''}`}
            onClick={() => setActiveTab('riwayat')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
            <span className="m-nav-label">Riwayat</span>
          </button>

          {/* Tab 4: Panduan */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'panduan' ? 'active' : ''}`}
            onClick={() => setActiveTab('panduan')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h5A2.5 2.5 0 0 1 12 4.5v15a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 1 2 15v-10.5z" />
                <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2h-5A2.5 2.5 0 0 0 12 4.5v15a2 2 0 0 1 2-2h5.5a2.5 2.5 0 0 0 2.5-2.5v-10.5z" />
              </svg>
            </div>
            <span className="m-nav-label">Panduan</span>
          </button>

          {/* Tab 5: Darurat */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'darurat' || activeTab === 'kontak' || activeTab === 'sos' ? 'active' : ''}`}
            onClick={() => setActiveTab('darurat')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <span className="m-nav-label">Darurat</span>
          </button>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="m-home-indicator" />
      </nav>
    </div>
  )
}
