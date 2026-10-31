import { useEffect, useState } from 'react'
import AuthPage from './pages/AuthPage'
import RoleHome from './pages/RoleHome'
import SOSManager from './pages/admin/SOSManager'
import RadarPeta from './pages/admin/RadarPeta'
import PoskoManager from './pages/admin/PoskoManager'
import RiskMap from './components/RiskMap'
import { LoadingState, ErrorState, EmptyState } from './components/common/AsyncState'
import { fetchDashboardSnapshot } from './services/dashboardService'
import './styles/landing.css'

// Formula ambang batas risiko banjir SIGAB (PRD v3.0 §3.2)
export function getRiskStatus(prob) {
  const p = Number(prob || 0)
  if (p >= 76) return { status: 'awas', level: 'Awas', levelNum: 4, color: '#dc2626' }
  if (p >= 51) return { status: 'siaga', level: 'Siaga', levelNum: 3, color: '#ea580c' }
  if (p >= 25) return { status: 'waspada', level: 'Waspada', levelNum: 2, color: '#d97706' }
  return { status: 'aman', level: 'Aman', levelNum: 1, color: '#059669' }
}

// 25 Desa Kecamatan Baureno dengan data spasial dan baseline probabilitas real database
const DEFAULT_VILLAGES_CONFIG = [
  { id: 9, name: 'Desa Kalisari', cleanName: 'Kalisari', prob: 30.3, char: 'Tanggul Bengawan Solo', nearestShelter: 'Gedung Serbaguna Kalisari', dist: '0.6 km', time: '8 mnt', capacity: '120/150 jiwa', jalur: 'Jl. Kalisari Barat (Bebas genangan)' },
  { id: 24, name: 'Desa Trojalu', cleanName: 'Trojalu', prob: 18.6, char: 'Daerah Dataran Rendah', nearestShelter: 'Posko Masjid Al-Huda Trojalu', dist: '0.9 km', time: '11 mnt', capacity: '85/100 jiwa', jalur: 'Jl. Poros Desa Trojalu Timur' },
  { id: 3, name: 'Desa Baureno', cleanName: 'Baureno', prob: 15.2, char: 'Pusat Kecamatan & Posko Utama', nearestShelter: 'Posko Balai Desa Baureno', dist: '1.2 km', time: '15 mnt', capacity: '145/250 jiwa', jalur: 'Jl. Raya Baureno Utama' },
  { id: 17, name: 'Desa Pucangarum', cleanName: 'Pucangarum', prob: 31.8, char: 'Bantaran Sungai Hilir', nearestShelter: 'Balai Desa Pucangarum', dist: '1.0 km', time: '12 mnt', capacity: '90/150 jiwa', jalur: 'Jl. Tanggul Pucangarum' },
  { id: 13, name: 'Desa Lebaksari', cleanName: 'Lebaksari', prob: 29.1, char: 'Area Rawan Luapan', nearestShelter: 'SDN Lebaksari', dist: '0.8 km', time: '10 mnt', capacity: '70/120 jiwa', jalur: 'Jl. Poros Lebaksari' },
  { id: 5, name: 'Desa Bumiayu', cleanName: 'Bumiayu', prob: 28.7, char: 'Bantaran Bengawan Solo', nearestShelter: 'Posko Siaga Bumiayu', dist: '0.5 km', time: '6 mnt', capacity: '190/200 jiwa', jalur: 'Jl. Tanggul Atas Bumiayu' },
  { id: 12, name: 'Desa Kedungrejo', cleanName: 'Kedungrejo', prob: 28.4, char: 'Cekungan Aliran Sungai', nearestShelter: 'Balai Warga Kedungrejo', dist: '1.1 km', time: '13 mnt', capacity: '80/130 jiwa', jalur: 'Jl. Poros Kedungrejo' },
  { id: 10, name: 'Desa Karangdayu', cleanName: 'Karangdayu', prob: 27.0, char: 'Dataran Rendah Rawan Genangan', nearestShelter: 'Aula Karangdayu', dist: '0.7 km', time: '9 mnt', capacity: '130/160 jiwa', jalur: 'Jl. Poros Karangdayu' },
  { id: 19, name: 'Desa Sembunglor', cleanName: 'Sembunglor', prob: 26.7, char: 'Jalur Aliran Banjir', nearestShelter: 'Balai Desa Sembunglor', dist: '1.3 km', time: '16 mnt', capacity: '95/150 jiwa', jalur: 'Jl. Poros Sembunglor' },
  { id: 22, name: 'Desa Tanggungan', cleanName: 'Tanggungan', prob: 26.4, char: 'Bantaran Sungai Utara', nearestShelter: 'Balai Pertemuan Tanggungan', dist: '1.1 km', time: '14 mnt', capacity: '75/140 jiwa', jalur: 'Jl. Tanggungan Timur' },
  { id: 18, name: 'Desa Selorejo', cleanName: 'Selorejo', prob: 25.4, char: 'Kawasan Tanggul Kritis', nearestShelter: 'SDN Selorejo', dist: '0.9 km', time: '11 mnt', capacity: '60/110 jiwa', jalur: 'Jl. Tanggul Selorejo' },
  { id: 23, name: 'Desa Tlogoagung', cleanName: 'Tlogoagung', prob: 24.6, char: 'Wilayah Dataran Sedang', nearestShelter: 'Balai RW Tlogoagung', dist: '1.4 km', time: '17 mnt', capacity: '80/120 jiwa', jalur: 'Jl. Poros Tlogoagung' },
  { id: 6, name: 'Desa Drajat', cleanName: 'Drajat', prob: 23.1, char: 'Dataran Sedang Baureno', nearestShelter: 'Balai Desa Drajat', dist: '1.6 km', time: '19 mnt', capacity: '75/130 jiwa', jalur: 'Jl. Desa Drajat' },
  { id: 14, name: 'Desa Ngemplak', cleanName: 'Ngemplak', prob: 22.8, char: 'Pemukiman Terbuka', nearestShelter: 'SDN Ngemplak', dist: '1.2 km', time: '15 mnt', capacity: '65/100 jiwa', jalur: 'Jl. Poros Ngemplak' },
  { id: 1, name: 'Desa Banjaran', cleanName: 'Banjaran', prob: 22.1, char: 'Area Persawahan & Pemukiman', nearestShelter: 'Masjid Jami Banjaran', dist: '0.8 km', time: '10 mnt', capacity: '110/180 jiwa', jalur: 'Jl. Desa Banjaran Selatan' },
  { id: 8, name: 'Desa Gunungsari', cleanName: 'Gunungsari', prob: 21.6, char: 'Dataran Lebih Tinggi', nearestShelter: 'Balai RW Gunungsari', dist: '1.7 km', time: '20 mnt', capacity: '70/110 jiwa', jalur: 'Jl. Poros Gunungsari' },
  { id: 11, name: 'Desa Kauman', cleanName: 'Kauman', prob: 21.0, char: 'Perbatasan Selatan Baureno', nearestShelter: 'Balai Desa Kauman', dist: '1.5 km', time: '18 mnt', capacity: '80/130 jiwa', jalur: 'Jl. Kauman Tengah' },
  { id: 16, name: 'Desa Pomahan', cleanName: 'Pomahan', prob: 20.1, char: 'Area Dataran Aman', nearestShelter: 'Balai Warga Pomahan', dist: '1.6 km', time: '19 mnt', capacity: '55/90 jiwa', jalur: 'Jl. Poros Pomahan' },
  { id: 2, name: 'Desa Banjaranyar', cleanName: 'Banjaranyar', prob: 19.5, char: 'Dataran Bebas Genangan', nearestShelter: 'Balai RW Banjaranyar', dist: '1.5 km', time: '19 mnt', capacity: '50/100 jiwa', jalur: 'Jl. Raya Banjaranyar' },
  { id: 25, name: 'Desa Tulungagung', cleanName: 'Tulungagung', prob: 18.9, char: 'Wilayah Selatan Berbukit', nearestShelter: 'SDN Tulungagung', dist: '1.8 km', time: '22 mnt', capacity: '65/110 jiwa', jalur: 'Jl. Tulungagung Raya' },
  { id: 15, name: 'Desa Pasinan', cleanName: 'Pasinan', prob: 15.6, char: 'Daerah Perumahan Warga', nearestShelter: 'SDN Pasinan I', dist: '1.4 km', time: '18 mnt', capacity: '60/120 jiwa', jalur: 'Jl. Tanggul Pasinan' },
  { id: 4, name: 'Desa Blongsong', cleanName: 'Blongsong', prob: 13.8, char: 'Pemukiman Aman Banjir', nearestShelter: 'Balai Desa Blongsong', dist: '1.8 km', time: '22 mnt', capacity: '90/150 jiwa', jalur: 'Jl. Poros Blongsong' },
  { id: 7, name: 'Desa Gajah', cleanName: 'Gajah', prob: 12.5, char: 'Dataran Tinggi Baureno', nearestShelter: 'Balai Desa Gajah', dist: '2.0 km', time: '24 mnt', capacity: '85/140 jiwa', jalur: 'Jl. Raya Gajah' },
  { id: 20, name: 'Desa Sraturejo', cleanName: 'Sraturejo', prob: 11.9, char: 'Dataran Bebas Aliran', nearestShelter: 'Balai Warga Sraturejo', dist: '2.1 km', time: '25 mnt', capacity: '60/100 jiwa', jalur: 'Jl. Poros Sraturejo' },
  { id: 21, name: 'Desa Sumuragung', cleanName: 'Sumuragung', prob: 5.0, char: 'Elevasi Tertinggi Baureno', nearestShelter: 'SDN Sumuragung', dist: '2.3 km', time: '28 mnt', capacity: '75/120 jiwa', jalur: 'Jl. Sumuragung Utama' }
]

const SVG_ICONS = {
  brandWave: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  map: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  siren: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18v-6a5 5 0 1 1 10 0v6" />
      <path d="M5 21h14" />
      <path d="M12 2v2" />
      <path d="M4 10l2 1" />
      <path d="M20 10l-2 1" />
    </svg>
  ),
  route: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  ),
  phone: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  arrowRight: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  chevronRight: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  play: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  ),
  droplet: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  cloudRain: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6" />
      <path d="M8 14v6" />
      <path d="M12 16v6" />
    </svg>
  ),
  shieldCheck: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function getActiveRoute() {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash || ''
  if (hash) return hash.toLowerCase()
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (path) return `#${path}`
  return ''
}

function App() {
  const [hash, setHash] = useState(getActiveRoute)

  // Real-time API state from Open-Meteo & Flood Calculation Engine
  const [realtimeData, setRealtimeData] = useState(null)

  // State for popups & features
  const [selectedVillageForRoute, setSelectedVillageForRoute] = useState(null)
  const [showAllVillagesModal, setShowAllVillagesModal] = useState(false)
  const [villageSearch, setVillageSearch] = useState('')
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showCallCenterModal, setShowCallCenterModal] = useState(false)
  const [selectedLandingVillage, setSelectedLandingVillage] = useState('Baureno')

  useEffect(() => {
    const handleRouteChange = () => setHash(getActiveRoute())
    window.addEventListener('hashchange', handleRouteChange)
    window.addEventListener('popstate', handleRouteChange)
    return () => {
      window.removeEventListener('hashchange', handleRouteChange)
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadRealtime = async () => {
      try {
        const res = await fetchDashboardSnapshot()
        if (isMounted && res) {
          setRealtimeData(res)
        }
      } catch (err) {
        console.warn('Dashboard snapshot API offline, fallback ke baseline probabilitas', err)
      }
    }
    loadRealtime()
    const timer = setInterval(loadRealtime, 30000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  // Routing Handler
  const authMatch = hash.match(/^#(masuk|daftar)(?:-(warga|petugas))?$/)
  if (authMatch) {
    return <AuthPage initialMode={authMatch[1] === 'daftar' ? 'register' : 'login'} initialRole={authMatch[2] || 'warga'} />
  }

  if (hash === '#demo') {
    return (
      <div style={{ padding: '60px', display: 'flex', gap: '30px', background: '#f5f7f6', minHeight: '100vh', alignItems: 'center' }}>
        <div style={{ flex: 1 }}><LoadingState label="Sedang memuat data dari server..." /></div>
        <div style={{ flex: 1 }}><ErrorState message="Gagal terhubung ke API Server." onRetry={() => {}} /></div>
        <div style={{ flex: 1 }}><EmptyState title="Belum ada data tiket" message="Tiket SOS warga yang masuk akan tampil di sini." /></div>
      </div>
    )
  }

  const adminRoutes = {
    '#radar': RadarPeta,
    '#radar-admin': RadarPeta,
    '#sos': SOSManager,
    '#sos-admin': SOSManager,
    '#posko': PoskoManager,
    '#posko-admin': PoskoManager,
  }

  if (adminRoutes[hash]) {
    const token = localStorage.getItem('access_token')
    if (!token) {
      window.history.replaceState(null, '', '#masuk-petugas')
      return <AuthPage initialMode="login" initialRole="petugas" />
    }
    const Component = adminRoutes[hash]
    return <Component />
  }

  const isPetugasPortal = [
    '#petugas',
    '#admin',
    '#portal-petugas',
    '#portal-admin',
    '#dashboard-petugas',
    '#dashboard-admin'
  ].includes(hash)

  const isWargaPortal = [
    '#warga',
    '#portal',
    '#portal-warga',
    '#dashboard-warga'
  ].includes(hash)

  if (isPetugasPortal || isWargaPortal) {
    const role = isPetugasPortal ? 'petugas' : 'warga'
    const token = localStorage.getItem('access_token')
    if (!token) {
      window.history.replaceState(null, '', `#masuk-${role}`)
      return <AuthPage initialMode="login" initialRole={role} />
    }
    return <RoleHome role={role} />
  }

  // Integrasi probabilitas real-time tiap desa dengan API Backend / Flood Engine
  const villagesData = DEFAULT_VILLAGES_CONFIG.map((cfg) => {
    let prob = cfg.prob
    if (realtimeData?.villages && Array.isArray(realtimeData.villages)) {
      const matched = realtimeData.villages.find((v) => {
        const vClean = (v.name || '').replace(/^Desa\s+/i, '').toLowerCase()
        return vClean === cfg.cleanName.toLowerCase()
      })
      if (matched) {
        const raw = matched.current_probability ?? matched.probability
        if (raw != null) prob = Number(raw)
      }
    }
    const risk = getRiskStatus(prob)
    return {
      ...cfg,
      prob: Math.round(prob * 10) / 10,
      status: risk.status,
      level: risk.level,
      color: risk.color,
      tma: `${(prob * 0.08 + 1.2).toFixed(1)}m`,
    }
  })

  // Kompatibilitas referensi VILLAGES_DATA
  const VILLAGES_DATA = villagesData

  const filteredVillages = villagesData.filter(v => 
    v.name.toLowerCase().includes(villageSearch.toLowerCase()) || 
    v.cleanName.toLowerCase().includes(villageSearch.toLowerCase()) ||
    v.status.toLowerCase().includes(villageSearch.toLowerCase()) ||
    v.level.toLowerCase().includes(villageSearch.toLowerCase())
  ).sort((a, b) => b.prob - a.prob)

  // 3 desa representatif untuk widget Status Wilayah (Kalisari, Trojalu, Baureno atau desa aktif terpilih)
  const displayVillages = (() => {
    const keys = ['Kalisari', 'Trojalu', 'Baureno']
    const cleanSelected = (selectedLandingVillage || '').replace(/^Desa\s+/i, '')
    let targetKeys = [...keys]
    if (cleanSelected && !keys.some(k => k.toLowerCase() === cleanSelected.toLowerCase())) {
      targetKeys = [cleanSelected, keys[0], keys[2]]
    }
    return targetKeys.map(k => {
      return villagesData.find(v => v.cleanName.toLowerCase() === k.toLowerCase()) || villagesData[0]
    })
  })()

  // Ringkasan metrik real-time hero & status bar berdasarkan kondisi nyata API
  const avgProbability = realtimeData?.kecamatan_summary?.average_probability != null
    ? Number(realtimeData.kecamatan_summary.average_probability)
    : (Array.isArray(villagesData) && villagesData.length > 0
        ? villagesData.reduce((acc, v) => acc + (Number(v.prob) || 0), 0) / villagesData.length
        : 21.6)

  const heroOverallRisk = getRiskStatus(avgProbability)
  const isKecamatanSafe = heroOverallRisk.status === 'aman'

  const realtimeDischarge = realtimeData?.discharge?.discharge_m3s != null
    ? Number(realtimeData.discharge.discharge_m3s).toFixed(2)
    : '1.28'
  const realtimeRainfall = realtimeData?.weather?.precipitation_mm != null
    ? Number(realtimeData.weather.precipitation_mm).toFixed(1)
    : '0.0'

  return (
    <div className="landing-page">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      <aside className="announcement-bar" aria-label="Status Siaga Kebencanaan">
        <div className="announcement-content">
          <span className="pulse-dot" />
          <span className="announcement-title">STATUS {heroOverallRisk.level.toUpperCase()}:</span>
          <span className="announcement-text">
            {isKecamatanSafe 
              ? `Kondisi debit Bengawan Solo (${realtimeDischarge} m³/s) & cuaca Baureno terpantau normal dan aman.` 
              : `Debit air Kali Solo Baureno terpantau ${realtimeDischarge} m³/s (${heroOverallRisk.level}) — Warga bantaran sungai diimbau waspada.`}
          </span>
        </div>
        <a href="#status-wilayah" className="announcement-link">
          Lihat detail {SVG_ICONS.arrowRight}
        </a>
      </aside>

      {/* 2. HEADER / NAVBAR */}
      <header className="landing-header">
        <a href="#" className="landing-brand">
          <div className="brand-icon-box">
            {SVG_ICONS.brandWave}
          </div>
          <div className="brand-text-col">
            <span className="brand-title">SIGAB</span>
            <span className="brand-subtitle">Siaga Bencana Baureno</span>
          </div>
        </a>

        <nav className="landing-nav" aria-label="Navigasi Utama">
          <a href="#status-wilayah">Status Wilayah</a>
          <a href="#layanan">Layanan</a>
          <a href="#panduan">Panduan</a>
          <a href="#kontak">Kontak Darurat</a>
        </nav>

        <div className="header-actions">
          {typeof window !== 'undefined' && localStorage.getItem('access_token') ? (
            <a
              href={localStorage.getItem('sigab_user_role') === 'petugas' ? '#petugas' : '#warga'}
              className="header-register-btn"
            >
              Buka Dashboard Saya {SVG_ICONS.arrowRight}
            </a>
          ) : (
            <>
              <a href="#masuk" className="header-login-link">Masuk</a>
              <a href="#daftar-warga" className="header-register-btn">
                Daftar sebagai Warga {SVG_ICONS.arrowRight}
              </a>
            </>
          )}
        </div>
      </header>

      <main>
        {/* 3. HERO SECTION */}
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-left">
              <div className="hero-pill-badge">
                <span className="dot" /> SISTEM PERINGATAN DINI KEBENCANAAN KECAMATAN BAURENO
              </div>
              <h1>
                Lebih siap<br />
                sebelum<br />
                <span className="highlight">air naik.</span>
              </h1>
              <p className="hero-description">
                Sistem peringatan dini dan respons banjir yang membantu warga Baureno mengambil keputusan tepat—sebelum kondisi menjadi darurat.
              </p>
              
              {/* Rounded CTA Buttons matching Figma screenshot */}
              <div className="hero-cta-group">
                <a href="#status-wilayah" className="btn-primary-teal">
                  Pantau wilayah saya {SVG_ICONS.arrowRight}
                </a>
                <button 
                  type="button" 
                  onClick={() => setShowGuideModal(true)} 
                  className="btn-secondary-white"
                >
                  <span className="play-icon-box">{SVG_ICONS.play}</span>
                  Lihat panduan siaga
                </button>
              </div>

              {/* Social Proof: 4 avatars AF, SI, RH, + and exact text */}
              <div className="hero-social-proof">
                <div className="avatar-stack">
                  <div className="avatar-circle avatar-af">AF</div>
                  <div className="avatar-circle avatar-si">SI</div>
                  <div className="avatar-circle avatar-rh">RH</div>
                  <div className="avatar-circle avatar-plus">+</div>
                </div>
                <div className="social-proof-col">
                  <strong>12.480+ warga</strong>
                  <span>telah terhubung dengan SIGAB</span>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-visual-wrapper">
                <div className="hero-image-frame">
                  <img src="/hero-river.jpg" alt="Pemandangan sungai Bengawan Solo dari udara" />
                  <div className="hero-location-chip">
                    {SVG_ICONS.pin}
                    <span>Kecamatan Baureno</span>
                    <span className="live-pill">LIVE</span>
                  </div>
                </div>

                {/* Floating Card exactly matching Figma screenshot */}
                <aside className="floating-hero-card" aria-label="Status Peringatan Terkini">
                  <div className="hero-card-header">
                    <span className="header-tag">
                      <span className="dot" /> PERINGATAN TERAKHIR
                    </span>
                    <span className="header-location">Kecamatan Baureno</span>
                  </div>
                  <div className="hero-card-main">
                    <div className="status-badge-wrap">
                      <span 
                        className={`status-badge ${heroOverallRisk.status}`}
                        style={{ color: heroOverallRisk.color }}
                      >
                        {heroOverallRisk.level}
                      </span>
                      <span className="status-subtext">Level {heroOverallRisk.levelNum} dari 4</span>
                    </div>
                    <div className="metric-value-large" title="Rata-rata probabilitas risiko banjir Kecamatan Baureno (Live API)">
                      <span className="num">{Math.round(avgProbability)}%</span>
                      <span className="unit">Rerata Risiko</span>
                    </div>
                  </div>
                  
                  {/* Two Metrics: Debit air & Curah hujan */}
                  <div className="hero-card-metrics">
                    <div className="metric-item">
                      <div className="metric-icon-wrap">
                        {SVG_ICONS.droplet}
                      </div>
                      <div className="metric-data-col">
                        <span className="metric-label-mini">Debit Bengawan Solo</span>
                        <strong className="metric-val-bold">{realtimeDischarge} m³/s</strong>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-icon-wrap">
                        {SVG_ICONS.cloudRain}
                      </div>
                      <div className="metric-data-col">
                        <span className="metric-label-mini">Curah hujan</span>
                        <strong className="metric-val-bold">{realtimeRainfall} mm/jam</strong>
                      </div>
                    </div>
                  </div>

                  <div className="hero-card-footer">
                    <span className="safe-evac-status">
                      {SVG_ICONS.shieldCheck} {isKecamatanSafe ? 'Tidak ada perintah evakuasi' : 'Pantau kesiapsiagaan desa'}
                    </span>
                    <a href={typeof window !== 'undefined' && localStorage.getItem('access_token') && localStorage.getItem('sigab_user_role') === 'petugas' ? '#petugas' : '#warga'}>
                      Buka dashboard {SVG_ICONS.arrowRight}
                    </a>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        {/* 4. STATS STRIP (EXACT TO FIGMA PROTOTYPE) */}
        <section className="stats-strip" aria-label="Statistik Utama">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-number">25</div>
              <div className="stat-label-col">
                <span>desa dipantau</span>
                <span>secara real-time</span>
              </div>
            </div>

            <div className="stat-divider" />

            <div className="stat-box">
              <div className="stat-number">60<span className="stat-unit-sub">dtk</span></div>
              <div className="stat-label-col">
                <span>interval pembaruan</span>
                <span>data sensor</span>
              </div>
            </div>

            <div className="stat-divider" />

            <div className="stat-box">
              <div className="stat-number">8</div>
              <div className="stat-label-col">
                <span>posko evakuasi</span>
                <span>siap beroperasi</span>
              </div>
            </div>

            <div className="stat-divider" />

            <div className="stat-box">
              <div className="stat-number">24/7</div>
              <div className="stat-label-col">
                <span>Pusdalops BPBD</span>
                <span>dalam siaga</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. FEATURES / SERVICES SECTION ("PERLINDUNGAN TERINTEGRASI") */}
        <section className="features-section" id="layanan">
          <span className="section-tag-kicker">PERLINDUNGAN TERINTEGRASI</span>
          <div className="features-header-split">
            <h2>
              Satu sistem untuk setiap<br />
              tahap kesiapsiagaan.
            </h2>
            <p>
              Dari informasi risiko hingga koordinasi evakuasi, SIGAB menyederhanakan hal<br />
              kompleks menjadi tindakan yang mudah dipahami warga.
            </p>
          </div>

          <div className="features-grid">
            {/* Card 1: 01 Bell */}
            <article className="feature-card">
              <div className="feature-card-top">
                <div className="feature-icon-box">{SVG_ICONS.bell}</div>
                <span className="feature-step-num">01</span>
              </div>
              <h3>Peringatan lebih dini</h3>
              <p>Notifikasi status air dan prediksi cuaca real-time langsung ke ponsel warga sekitar bantaran.</p>
              <a href="#status-wilayah" className="feature-card-link">
                Pelajari deteksi {SVG_ICONS.arrowRight}
              </a>
            </article>

            {/* Card 2: 02 Folded Map */}
            <article className="feature-card">
              <div className="feature-card-top">
                <div className="feature-icon-box">{SVG_ICONS.map}</div>
                <span className="feature-step-num">02</span>
              </div>
              <h3>Peta risiko yang jelas</h3>
              <p>Peta wilayah interaktif berbasis desa, memantau titik rawan banjir secara akurat.</p>
              <a href="#status-wilayah" className="feature-card-link">
                Buka peta digital {SVG_ICONS.arrowRight}
              </a>
            </article>

            {/* Card 3: 03 Siren Alarm */}
            <article className="feature-card">
              <div className="feature-card-top">
                <div className="feature-icon-box">{SVG_ICONS.siren}</div>
                <span className="feature-step-num">03</span>
              </div>
              <h3>SOS satu sentuhan</h3>
              <p>Tombol darurat langsung mengirim koordinat GPS tim evakuasi saat keadaan darurat.</p>
              <a href="#masuk-warga" className="feature-card-link">
                Alur penyelamatan {SVG_ICONS.arrowRight}
              </a>
            </article>

            {/* Card 4: 04 Route Nodes */}
            <article className="feature-card">
              <div className="feature-card-top">
                <div className="feature-icon-box">{SVG_ICONS.route}</div>
                <span className="feature-step-num">04</span>
              </div>
              <h3>Evakuasi terkoordinasi</h3>
              <p>Rekomendasi posko evakuasi terdekat, ketersediaan logistik, dan jalur aman.</p>
              <span 
                className="feature-card-link"
                onClick={() => setSelectedVillageForRoute(VILLAGES_DATA[0])}
              >
                Pelajari rute aman {SVG_ICONS.arrowRight}
              </span>
            </article>
          </div>
        </section>

        {/* 6. STATUS WILAYAH */}
        <section className="status-region-section" id="status-wilayah">
          <div className="status-region-grid">
            {/* Left: Real Leaflet & OSM Map Card */}
            <div className="map-visual-card">
              <div style={{ position: 'relative', width: '100%', height: '380px', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 4px 14px rgba(12, 26, 36, 0.08)' }}>
                <RiskMap
                  height="380px"
                  selectedVillageName={selectedLandingVillage}
                  onSelectVillage={(v) => {
                    if (v && v.name) {
                      const cleanName = v.name.replace(/^Desa\s+/i, '')
                      setSelectedLandingVillage(cleanName)
                      const matched = villagesData.find(vd => vd.cleanName.toLowerCase() === cleanName.toLowerCase() || vd.name.toLowerCase().includes(cleanName.toLowerCase()))
                      if (matched) {
                        setSelectedVillageForRoute(matched)
                      }
                    }
                  }}
                />
                <div className="map-legend-pill" style={{ zIndex: 1000, pointerEvents: 'none', bottom: '14px', left: '14px' }}>
                  <span className="river-indicator" />
                  <span>Bengawan Solo • Real-Time OSM Spasial</span>
                </div>
              </div>
            </div>

            {/* Right: Text & 3 Village Rows */}
            <div className="status-region-right">
              <span className="section-tag-kicker">STATUS WILAYAH</span>
              <h2>Kenali kondisi sekitar Anda dalam sekejap.</h2>
              <p className="lead">
                Data sensor sungai dan laporan lapangan disederhanakan menjadi status sederhana: Siaga, Waspada, atau Aman yang jelas.
              </p>

              <div className="village-status-list">
                {displayVillages.map((v) => (
                  <div 
                    key={v.id}
                    className={`village-status-item ${selectedLandingVillage?.toLowerCase().includes(v.cleanName.toLowerCase()) ? 'active-village' : ''}`}
                    onClick={() => {
                      setSelectedLandingVillage(v.cleanName)
                      setSelectedVillageForRoute(v)
                    }}
                    title="Klik untuk memusatkan peta & melihat rute posko"
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  >
                    <div className="village-item-info">
                      <span className="village-item-name">{v.name}</span>
                      <span className="village-item-tma">
                        Probabilitas Banjir <strong>{Number(v.prob).toFixed(1)}%</strong> • {v.char}
                      </span>
                    </div>
                    <span className={`badge-status ${v.status}`}>{v.level}</span>
                  </div>
                ))}
              </div>

              <button 
                type="button" 
                className="btn-view-all-villages"
                onClick={() => setShowAllVillagesModal(true)}
              >
                Lihat semua wilayah {SVG_ICONS.arrowRight}
              </button>
            </div>
          </div>
        </section>

        {/* 7. GUIDANCE DARK SECTION */}
        <section className="guidance-dark-section" id="panduan">
          <div className="guidance-grid">
            <div className="guidance-left">
              <span className="section-tag-kicker">PANDUAN SIAGA</span>
              <h2>
                Tahu harus berbuat<br />
                apa,<br />
                di setiap level kondisi.
              </h2>
              <p>
                Instruksi ringkas dan praktis agar seluruh keluarga tetap tenang dan bergerak pada waktu yang tepat.
              </p>
              <button 
                type="button" 
                className="btn-guidance-download"
                onClick={() => setShowGuideModal(true)}
              >
                Unduh panduan keluarga {SVG_ICONS.arrowRight}
              </button>
            </div>

            <div className="guidance-right">
              <div className="guidance-levels-list">
                {/* 01 Aman - Green */}
                <div className="guidance-level-row" onClick={() => setShowGuideModal(true)}>
                  <div className="level-row-left">
                    <div className="level-indicator-ring ring-green">01</div>
                    <div className="level-row-text">
                      <h3>Aman</h3>
                      <p>Siapkan tas siaga dan simpan nomor darurat.</p>
                    </div>
                  </div>
                  <span className="level-row-chevron">{SVG_ICONS.chevronRight}</span>
                </div>

                {/* 02 Waspada - Yellow */}
                <div className="guidance-level-row" onClick={() => setShowGuideModal(true)}>
                  <div className="level-row-left">
                    <div className="level-indicator-ring ring-yellow">02</div>
                    <div className="level-row-text">
                      <h3>Waspada</h3>
                      <p>Pantau informasi dan pindahkan dokumen penting.</p>
                    </div>
                  </div>
                  <span className="level-row-chevron">{SVG_ICONS.chevronRight}</span>
                </div>

                {/* 03 Siaga - Orange */}
                <div className="guidance-level-row" onClick={() => setShowGuideModal(true)}>
                  <div className="level-row-left">
                    <div className="level-indicator-ring ring-orange">03</div>
                    <div className="level-row-text">
                      <h3>Siaga</h3>
                      <p>Bersiap menuju titik kumpul terdekat.</p>
                    </div>
                  </div>
                  <span className="level-row-chevron">{SVG_ICONS.chevronRight}</span>
                </div>

                {/* 04 Awas - Red */}
                <div className="guidance-level-row" onClick={() => setShowGuideModal(true)}>
                  <div className="level-row-left">
                    <div className="level-indicator-ring ring-red">04</div>
                    <div className="level-row-text">
                      <h3>Awas</h3>
                      <p>Evakuasi segera sesuai arahan petugas.</p>
                    </div>
                  </div>
                  <span className="level-row-chevron">{SVG_ICONS.chevronRight}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. PRE-FOOTER CTA SECTION (1000% EXACT TO FIGMA SCREENSHOT) */}
        <section className="pre-footer-cta-section" id="daftar">
          <div className="cta-inner-grid">
            <div className="cta-box-left">
              <span className="section-tag-kicker">MULAI SEKARANG</span>
              <h2>
                Siaga hari ini.<br />
                Lebih aman esok hari.
              </h2>
              <p>
                Daftarkan keluarga Anda untuk menerima peringatan dan bantuan evakuasi yang lebih tepat sasaran.
              </p>
            </div>
            <div className="cta-actions-stack">
              <a href="#daftar-warga" className="btn-cta-citizen">
                Daftar sebagai warga {SVG_ICONS.arrowRight}
              </a>
              <button 
                type="button" 
                className="btn-cta-phone-card"
                onClick={() => setShowCallCenterModal(true)}
              >
                <div className="phone-icon-wrap">
                  {SVG_ICONS.phone}
                </div>
                <div className="phone-text-col">
                  <span className="phone-label">Darurat 24 jam</span>
                  <strong className="phone-number">(0353) 881-234</strong>
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 9. FOOTER (1000% EXACT TO FIGMA SCREENSHOT) */}
      <footer className="landing-footer-new" id="kontak">
        <div className="footer-inner-row">
          <div className="footer-brand">
            <div className="footer-brand-icon">
              {SVG_ICONS.brandWave}
            </div>
            <div>
              <div className="footer-brand-title">SIGAB</div>
              <div className="footer-brand-sub">Siaga Banjir Baureno</div>
            </div>
          </div>

          <div className="footer-agency">
            Platform kesiapsiagaan banjir untuk masyarakat Baureno.
          </div>

          <div className="footer-copyright">
            © 2026 SIGAB Baureno
          </div>
        </div>
      </footer>

      {/* INTEGRATED FEATURE: MODAL RUTE POSKO TERDEKAT */}
      {selectedVillageForRoute && (
        <div className="sigab-modal-overlay" onClick={() => setSelectedVillageForRoute(null)}>
          <div className="sigab-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sigab-modal-header">
              <h3>Rute Evakuasi & Posko Terdekat — {selectedVillageForRoute.name}</h3>
              <button 
                type="button" 
                className="sigab-modal-close" 
                onClick={() => setSelectedVillageForRoute(null)}
              >
                ✕
              </button>
            </div>
            <div className="sigab-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span className={`badge-status ${selectedVillageForRoute.status}`}>
                  {selectedVillageForRoute.level}
                </span>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                  Probabilitas Risiko: <strong>{Number(selectedVillageForRoute.prob).toFixed(1)}%</strong> • {selectedVillageForRoute.char}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1a24' }}>
                    {selectedVillageForRoute.nearestShelter}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedVillageForRoute.jalur}
                  </div>
                </div>
                <div style={{ background: '#e0f2f1', color: '#00838f', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem' }}>
                  {selectedVillageForRoute.dist} • ~{selectedVillageForRoute.time}
                </div>
              </div>

              <div className="shelter-detail-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  <span>Kapasitas Tersedia</span>
                  <strong>{selectedVillageForRoute.capacity}</strong>
                </div>
                <div className="shelter-progress-bar">
                  <div className="fill" style={{ width: '60%' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#334155' }}>
                  <span style={{ background: '#ffffff', padding: '3px 8px', borderRadius: '4px' }}>✓ Dapur Umum Siaga</span>
                  <span style={{ background: '#ffffff', padding: '3px 8px', borderRadius: '4px' }}>✓ Tenaga Medis & Obat</span>
                  <span style={{ background: '#ffffff', padding: '3px 8px', borderRadius: '4px' }}>✓ Logistik Selimut & Air</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <a 
                  href="#warga" 
                  className="btn-primary-teal" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    try { sessionStorage.setItem('sigab_warga_tab', 'peta') } catch (e) {}
                    setSelectedVillageForRoute(null)
                  }}
                >
                  {SVG_ICONS.map} Buka Peta &amp; Rute Evakuasi
                </a>
                <button 
                  type="button" 
                  className="btn-secondary-white"
                  onClick={() => setSelectedVillageForRoute(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEMUA WILAYAH */}
      {showAllVillagesModal && (
        <div className="sigab-modal-overlay" onClick={() => setShowAllVillagesModal(false)}>
          <div className="sigab-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sigab-modal-header">
              <h3>Daftar Status Wilayah Kecamatan Baureno</h3>
              <button 
                type="button" 
                className="sigab-modal-close" 
                onClick={() => setShowAllVillagesModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="sigab-modal-body">
              <input 
                type="text" 
                className="village-search-bar" 
                placeholder="Cari desa..."
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                autoFocus
              />
              <div className="all-villages-grid">
                {filteredVillages.map((v) => (
                  <div 
                    key={v.id} 
                    className="village-status-item"
                    onClick={() => {
                      setSelectedVillageForRoute(v)
                      setShowAllVillagesModal(false)
                    }}
                  >
                    <div className="village-item-info">
                      <span className="village-item-name">{v.name}</span>
                      <span className="village-item-tma">
                        Probabilitas Banjir <strong>{Number(v.prob).toFixed(1)}%</strong> • {v.char}
                      </span>
                    </div>
                    <span className={`badge-status ${v.status}`}>
                      {v.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANDUAN EVAKUASI */}
      {showGuideModal && (
        <div className="sigab-modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="sigab-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sigab-modal-header">
              <h3>Panduan Siaga Bencana Baureno</h3>
              <button 
                type="button" 
                className="sigab-modal-close" 
                onClick={() => setShowGuideModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="sigab-modal-body">
              <h4 style={{ color: '#0c1a24', marginBottom: '8px' }}>Protokol Evakuasi & Tas Siaga Bencana:</h4>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#475569', fontSize: '0.88rem' }}>
                <li>Amankan dokumen berharga (KK, KTP, Ijazah, Sertifikat) ke kantong plastik kedap air.</li>
                <li>Siapkan obat-obatan darurat pribadi, lampu senter, dan baterai cadangan.</li>
                <li>Matikan sekering listrik rumah dan cabut selang tabung gas.</li>
                <li>Ikuti arahan jalur evakuasi aman bebas genangan menuju posko terdekat.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CALL CENTER */}
      {showCallCenterModal && (
        <div className="sigab-modal-overlay" onClick={() => setShowCallCenterModal(false)}>
          <div className="sigab-modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="sigab-modal-header">
              <h3>Kontak Darurat Bencana</h3>
              <button 
                type="button" 
                className="sigab-modal-close" 
                onClick={() => setShowCallCenterModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="sigab-modal-body" style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.15rem', color: '#0c1a24', marginBottom: '6px' }}>Pusdalops BPBD Baureno</h4>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px' }}>Siaga 24 jam untuk laporan genangan dan bantuan perahu darurat.</p>
              <a 
                href="tel:0353881234" 
                className="btn-primary-teal" 
                style={{ width: '100%', justifyContent: 'center', fontSize: '1rem' }}
              >
                {SVG_ICONS.phone} (0353) 881-234
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
