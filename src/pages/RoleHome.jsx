import { useState, useEffect } from 'react'
import { logout, getProfile } from '../services/authService'
import { apiFetch } from '../services/api'
import wsService from '../services/wsService'
import RiskMap from '../components/RiskMap'
import WargaBeranda from '../components/warga/WargaBeranda'
import WargaPetaWilayah from '../components/warga/WargaPetaWilayah'
import WargaRiwayatKejadian from '../components/warga/WargaRiwayatKejadian'
import WargaPanduan from '../components/warga/WargaPanduan'
import WargaKontakDarurat from '../components/warga/WargaKontakDarurat'
import WargaSOS from '../components/warga/WargaSOS'
import useDashboardRealtime from '../hooks/useDashboardRealtime'
import useGeolocation from '../hooks/useGeolocation'
import { getSOSTickets } from '../services/sosService'
import '../styles/role-home.css'
import '../styles/warga-portal.css'

function Brand({ admin = false, locName = '' }) {
  return (
    <div className={`role-brand ${admin ? 'role-brand-admin' : ''}`}>
      <span className="role-brand-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
          <path d="M4 12c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
          <path d="M4 16c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
        </svg>
      </span>
      <span className="role-brand-text">
        <strong>SiagaBencana</strong>
        <small>{admin ? 'Pusdalops BPBD' : (locName ? `Portal Warga • ${locName}` : 'Portal Warga')}</small>
      </span>
    </div>
  )
}

function WargaHome() {
  const [activeTab, setActiveTab] = useState('peta')
  const [userProfile, setUserProfile] = useState({ full_name: 'Ahmad Fauzi' })
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const geo = useGeolocation()

  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res && res.full_name) {
          setUserProfile(res)
          const targetVillageId = res.village_id || 1
          apiFetch(`/emergency/${targetVillageId}`)
            .then(em => setIsEmergencyActive(em.is_emergency_active))
            .catch(() => {})
        }
      })
      .catch(() => {})

    apiFetch('/emergency/1')
      .then(res => setIsEmergencyActive(res.is_emergency_active))
      .catch(() => {})
      
    wsService.connect('alerts')
    const unsub = wsService.on('emergency_status', (data) => setIsEmergencyActive(data.is_active))
    return () => unsub()
  }, [])

  return (
    <div className="warga-container">
      {/* Emergency Banner */}
      {isEmergencyActive && (
        <div style={{ background: '#dc2626', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            <span>BANJIR PARAH — EVAKUASI SEKARANG</span>
            <span style={{ fontWeight: 'normal', opacity: 0.9, fontSize: '0.85rem' }}>Baureno • Level 4 • 09:15 WIB</span>
          </div>
          <button 
            style={{ background: 'white', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveTab('sos')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            MINTA BANTUAN SOS
          </button>
        </div>
      )}

      {/* Header Sticky */}
      <header className="warga-header-wrapper">
        <div className="warga-header">
          <Brand locName={geo.address ? geo.address.split(',')[0] : 'Baureno'} />

          {/* Navigation Links */}
          <nav className="warga-nav" aria-label="Navigasi Warga">
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'beranda' ? 'active' : ''}`}
              onClick={() => setActiveTab('beranda')}
            >
              Beranda
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'peta' ? 'active' : ''}`}
              onClick={() => setActiveTab('peta')}
            >
              Peta Wilayah
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'riwayat' ? 'active' : ''}`}
              onClick={() => setActiveTab('riwayat')}
            >
              Riwayat Kejadian
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'panduan' ? 'active' : ''}`}
              onClick={() => setActiveTab('panduan')}
            >
              Panduan
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'kontak' ? 'active' : ''}`}
              onClick={() => setActiveTab('kontak')}
            >
              Kontak Darurat
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'sos' ? 'active' : ''}`}
              onClick={() => setActiveTab('sos')}
              style={{ color: '#dc2626', fontWeight: 700 }}
            >
              🚨 SOS Darurat
            </button>
          </nav>

          {/* Header Right Tools */}
          <div className="warga-tools">
            <div 
              className="warga-loc-pill"
              title={geo.fullAddress || (geo.position ? `Koordinat GPS: ${geo.latitude?.toFixed(5)}, ${geo.longitude?.toFixed(5)}` : 'Klik untuk deteksi ulang GPS')}
              onClick={geo.refresh}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={geo.isRealDevice ? '#10b981' : 'currentColor'} 
                strokeWidth="2.5"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{geo.loading ? 'Mencari GPS...' : (geo.address || 'Baureno, Bojonegoro')}</span>
              {geo.isRealDevice && (
                <span 
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 6px #10b981'
                  }} 
                  title="GPS Device Terkunci" 
                />
              )}
            </div>

            <button type="button" className="warga-bell-btn" title="Notifikasi">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            <div className="warga-user-pill" title="Profil Pengguna">
              <div className="warga-user-avatar">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt={userProfile.full_name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <span className="warga-user-name">{userProfile.full_name || 'Ahmad Fauzi'}</span>
            </div>

            <button type="button" onClick={logout} className="warga-logout-btn" title="Keluar">
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area based on Tab */}
      <main className="warga-page-body">
        {activeTab === 'beranda' && <WargaBeranda onNavigate={(tab) => setActiveTab(tab)} geo={geo} />}
        {activeTab === 'peta' && <WargaPetaWilayah geo={geo} />}
        {activeTab === 'riwayat' && <WargaRiwayatKejadian />}
        {activeTab === 'panduan' && <WargaPanduan />}
        {activeTab === 'kontak' && <WargaKontakDarurat />}
        {activeTab === 'sos' && <WargaSOS onNavigate={(tab) => setActiveTab(tab)} geo={geo} />}
      </main>

      {/* Footer */}
      <footer className="warga-footer">
        <div className="warga-footer-inner">
          <span>© 2025 SiagaBencana Portal Warga Kecamatan Baureno, Bojonegoro.</span>
          <span>Badan Penanggulangan Bencana Daerah (BPBD)</span>
        </div>
      </footer>
    </div>
  )
}

function AdminHome() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isEmergency, setIsEmergency] = useState(false)
  const [tickets, setTickets] = useState([])
  const { data: realtimeData } = useDashboardRealtime()

  const fetchTickets = () => {
    getSOSTickets()
      .then(res => {
        if (Array.isArray(res)) setTickets(res)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    apiFetch('/emergency/1').then(res => setIsEmergency(res.is_emergency_active)).catch(() => {})
    fetchTickets()

    wsService.connect('alerts')
    wsService.connect('sos')
    const unsubAlerts = wsService.on('emergency_status', (data) => setIsEmergency(data.is_active))
    const unsubSosNew = wsService.on('sos_new', (newTicket) => {
      fetchTickets()
    })
    const unsubSosUpd = wsService.on('sos_updated', () => {
      fetchTickets()
    })

    return () => {
      clearInterval(timer)
      unsubAlerts()
      unsubSosNew()
      unsubSosUpd()
    }
  }, [])

  const toggleEmergency = async () => {
    const nextState = !isEmergency
    setIsEmergency(nextState)

    try {
      if (isEmergency) {
        await apiFetch('/emergency/1/deactivate', { method: 'POST', body: JSON.stringify({}) })
      } else {
        await apiFetch('/emergency/1/activate', { method: 'POST', body: JSON.stringify({}) })
      }
    } catch(e) { 
      console.error(e)
      alert("Gagal menghubungi server: " + e.message)
      setIsEmergency(isEmergency)
    }
  }

  const hh = String(currentTime.getHours()).padStart(2, '0')
  const mm = String(currentTime.getMinutes()).padStart(2, '0')
  const ss = String(currentTime.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss} WIB`

  const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
  const dateStr = currentTime.toLocaleDateString('id-ID', dateOptions)

  const activeTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected')
  const shelters = realtimeData?.shelters || []
  const totalShelterCap = shelters.reduce((s, sh) => s + (sh.capacity_total || 0), 0)
  const occupiedShelterCap = shelters.reduce((s, sh) => s + (sh.capacity_occupied || 0), 0)
  const shelterOccPct = totalShelterCap ? Math.round((occupiedShelterCap / totalShelterCap) * 100) : 0

  const dischargeVal = realtimeData?.discharge?.discharge_m3s 
    ? Math.round(realtimeData.discharge.discharge_m3s).toLocaleString('id-ID')
    : '1.200'

  const rainVal = realtimeData?.weather?.precipitation_mm ?? 0

  const getVulnerableSummary = (t) => {
    const v = []
    if (t.has_elderly) v.push('Lansia')
    if (t.has_toddler) v.push('Balita')
    if (t.has_pregnant) v.push('Ibu Hamil')
    if (t.has_disability) v.push('Difabel')
    return v.length > 0 ? ` • ${v.join(', ')}` : ''
  }

  return (
    <main className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
            ☰
          </button>
          <Brand admin />
        </div>
        <nav>
          <a className="active" href="#petugas">
            <i>▦</i> <span>Dashboard</span>
          </a>
          <a href="#radar">
            <i>◉</i> <span>Radar Peta</span>
          </a>
          <a href="#sos">
            <i>▣</i> <span>Tiket SOS</span>
            {activeTickets.length > 0 && <b>{activeTickets.length}</b>}
          </a>
          <a href="#posko">
            <i>♙</i> <span>Manajemen Posko</span>
          </a>
        </nav>
        <div className="operator">
          <span className="op-status">●</span>
          <div className="op-text">
            <small>Petugas Jaga</small>
            <strong>Kec. Baureno</strong>
            <span>Online · Shift Pagi</span>
          </div>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <div className="search-box">⌕ &nbsp; Cari desa, tiket, atau petugas...</div>
          <div className="admin-time">
            <strong>{timeStr}</strong>
            <small>{dateStr}</small>
          </div>
          <div 
            className={`danger-toggle ${isEmergency ? 'active' : ''}`} 
            onClick={toggleEmergency}
            style={{ cursor: 'pointer', background: isEmergency ? '#fff1f2' : '#f1f5f9', borderColor: isEmergency ? '#fecdd3' : '#e2e8f0' }}
          >
            <span>
              STATUS DARURAT
              <br />
              <strong style={{ color: isEmergency ? '#e11d48' : '#64748b' }}>{isEmergency ? 'AKTIF' : 'NONAKTIF'}</strong>
            </span>
            <i className="toggle-indicator" />
            <style>{`
              .danger-toggle i.toggle-indicator { background: ${isEmergency ? '#e11d48' : '#cbd5e1'}; transition: all 0.3s; }
              .danger-toggle i.toggle-indicator::after { right: ${isEmergency ? '2px' : '22px'}; transition: all 0.3s; }
            `}</style>
          </div>
          <div className="admin-avatar">●</div>
          <button onClick={logout} className="logout-btn" title="Keluar">
            <i>⎋</i> Keluar
          </button>
        </header>
        <div className="admin-dashboard">
          <div className="kpi-grid">
            <Kpi icon="♜" label="RERATA DEBIT SUNGAI" value={dischargeVal} unit="m³/s" change="Live GloFAS" />
            <Kpi icon="☁" label="RERATA CURAH HUJAN" value={rainVal} unit="mm" change="Open-Meteo" />
            <Kpi icon="⚠" label="TIKET SOS AKTIF" value={activeTickets.length} unit="tiket" change={`${activeTickets.length} butuh evakuasi`} danger={activeTickets.length > 0} />
            <Kpi icon="♧" label="TOTAL KAPASITAS POSKO" value={occupiedShelterCap} unit={`/${totalShelterCap || 1200}`} change={`${shelterOccPct}% terisi`} />
          </div>
          <div className="admin-main-grid">
            <article className="risk-map portal-card">
              <div className="admin-section-head">
                <div>
                  <h2>
                    Peta Risiko 25 Desa <b>● Live Radar</b>
                  </h2>
                  <p>Kecamatan Baureno — Visualisasi Spasial &amp; Sebaran Genangan Bengawan Solo</p>
                </div>
              </div>
              <div className="map-legend">
                <span className="red-dot" /> Sangat Tinggi (Awas){' '}
                <span className="orange-dot" /> Tinggi (Siaga){' '}
                <span className="yellow-dot" /> Sedang (Waspada){' '}
                <span className="green-dot" /> Rendah (Aman){' '}
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#radar'
                  }}
                >
                  ▧ Buka Radar ↗
                </button>
              </div>
              <RiskMap />
            </article>
            <article className="sos-queue portal-card">
              <div className="admin-section-head">
                <h2>🔴 Antrian SOS Live</h2>
                <b>{activeTickets.length} antrean</b>
              </div>
              {activeTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
                  <strong>Tidak ada tiket darurat aktif</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>Situasi warga dalam pantauan aman.</p>
                </div>
              ) : (
                activeTickets.slice(0, 5).map((ticket) => {
                  const location = ticket.gps_address || (ticket.village_name ? `Desa ${ticket.village_name}` : `Desa ID ${ticket.village_id}`)
                  const time = ticket.submitted_at ? new Date(ticket.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'
                  return (
                    <div className="sos-ticket" key={ticket.id}>
                      <div>
                        <strong>{ticket.ticket_number}</strong>
                        <time>{time} WIB</time>
                      </div>
                      <b>📍 {location}</b>
                      <small>👥 {ticket.family_count} jiwa{getVulnerableSummary(ticket)}</small>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = '#sos'
                        }}
                      >
                        ♟ &nbsp; Tindak Lanjuti di Panel SOS ↗
                      </button>
                    </div>
                  )
                })
              )}
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}

function Kpi({ icon, label, value, unit, change, danger }) {
  return (
    <article className="kpi-card portal-card">
      <div>
        <span>{icon}</span>
        <b className={danger ? 'danger-text' : ''}>{change}</b>
      </div>
      <small>{label}</small>
      <strong>
        {value}
        <em>{unit}</em>
      </strong>
    </article>
  )
}

function RoleHome({ role }) {
  return role === 'petugas' ? <AdminHome /> : <WargaHome />
}

export default RoleHome