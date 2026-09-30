import { useState, useEffect } from 'react'
import { logout, getProfile } from '../services/authService'
import RiskMap from '../components/RiskMap'
import WargaBeranda from '../components/warga/WargaBeranda'
import WargaPetaWilayah from '../components/warga/WargaPetaWilayah'
import WargaRiwayatKejadian from '../components/warga/WargaRiwayatKejadian'
import WargaPanduan from '../components/warga/WargaPanduan'
import WargaKontakDarurat from '../components/warga/WargaKontakDarurat'
import WargaSOS from '../components/warga/WargaSOS'
import '../styles/role-home.css'
import '../styles/warga-portal.css'

const wargaAssetPrefix = 'https://www.figma.com/api/mcp/asset/d84f02db-e7d0-4c80-8d2c-7b2c55160913'
const brandIcon = `${wargaAssetPrefix}/375ad.svg`

function Brand({ admin = false }) {
  return (
    <div className={`warga-brand ${admin ? 'role-brand-admin' : ''}`}>
      <span className="warga-brand-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M2 6c4-2 6 2 10 0s6 2 10 0" />
          <path d="M2 12c4-2 6 2 10 0s6 2 10 0" />
          <path d="M2 18c4-2 6 2 10 0s6 2 10 0" />
        </svg>
      </span>
      <span className="warga-brand-text">
        <strong>SiagaBencana</strong>
        <small>{admin ? 'Pusdalops BPBD' : 'Portal Warga • Baureno'}</small>
      </span>
    </div>
  )
}

function WargaHome() {
  const [activeTab, setActiveTab] = useState('peta')
  const [userProfile, setUserProfile] = useState({ full_name: 'Ahmad Fauzi' })

  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res && res.full_name) {
          setUserProfile(res)
        }
      })
      .catch(() => {
        // Fallback default
      })
  }, [])

  return (
    <div className="warga-container">
      {/* Header Sticky */}
      <header className="warga-header-wrapper">
        <div className="warga-header">
          <Brand />

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
          </nav>

          {/* Header Right Tools */}
          <div className="warga-tools">
            <div className="warga-loc-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Baureno, Bojonegoro</span>
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
        {activeTab === 'beranda' && <WargaBeranda onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'peta' && <WargaPetaWilayah />}
        {activeTab === 'riwayat' && <WargaRiwayatKejadian />}
        {activeTab === 'panduan' && <WargaPanduan />}
        {activeTab === 'kontak' && <WargaKontakDarurat />}
        {activeTab === 'sos' && <WargaSOS onNavigate={(tab) => setActiveTab(tab)} />}
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

function Metric({ icon, status, value, unit, label }) {
  return (
    <article className="metric-card portal-card">
      <div className="metric-top">
        <span>{icon}</span>
        <b>{status}</b>
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{label}</p>
    </article>
  )
}

function History({ color, title, detail, date }) {
  return (
    <div className="history-item">
      <i className={color} />
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <time>{date}</time>
    </div>
  )
}

function AdminHome() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hh = String(currentTime.getHours()).padStart(2, '0')
  const mm = String(currentTime.getMinutes()).padStart(2, '0')
  const ss = String(currentTime.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss} WIB`

  const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
  const dateStr = currentTime.toLocaleDateString('id-ID', dateOptions)

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
            <b>12</b>
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
          <div className="danger-toggle">
            <span>
              STATUS DARURAT
              <br />
              <strong>AKTIF</strong>
            </span>
            <i />
          </div>
          <div className="admin-avatar">●</div>
          <button onClick={logout} className="logout-btn" title="Keluar">
            <i>⎋</i> Keluar
          </button>
        </header>
        <div className="admin-dashboard">
          <div className="kpi-grid">
            <Kpi icon="♜" label="RERATA DEBIT SUNGAI" value="1.842" unit="m³/s" change="+8.4%" />
            <Kpi icon="☁" label="RERATA CURAH HUJAN" value="112" unit="mm" change="+21%" />
            <Kpi icon="⚠" label="TIKET SOS AKTIF" value="12" unit="tiket" change="+5 baru" danger />
            <Kpi icon="♧" label="TOTAL KAPASITAS POSKO" value="640" unit="/1.2k" change="53% terisi" />
          </div>
          <div className="admin-main-grid">
            <article className="risk-map portal-card">
              <div className="admin-section-head">
                <div>
                  <h2>
                    Peta Risiko 25 Desa <b>● Live Radar (60d)</b>
                  </h2>
                  <p>Kecamatan Baureno — Visualisasi Spasial &amp; Sebaran Genangan Bengawan Solo</p>
                </div>
              </div>
              <div className="map-legend">
                <span className="red-dot" /> Tinggi (Awas) <span className="orange-dot" /> Sedang (Siaga){' '}
                <span className="green-dot" /> Aman{' '}
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
                <b>12 masuk</b>
              </div>
              {[
                'EVAC-BRN-001|Dsn. Krajan RT03|4 orang • Lansia|2 mnt lalu',
                'EVAC-BRN-002|Jl. Bengawan 12|7 orang • Balita, Hamil|5 mnt lalu',
                'EVAC-BRN-003|Dsn. Sawah RT01|2 orang • Difabel|8 mnt lalu',
                'EVAC-BRN-004|Ps. Baureno blok C|11 orang|11 mnt lalu',
              ].map((ticket) => {
                const [id, location, people, time] = ticket.split('|')
                return (
                  <div className="sos-ticket" key={id}>
                    <div>
                      <strong>{id}</strong>
                      <time>{time}</time>
                    </div>
                    <b>{location}</b>
                    <small>♙ {people}</small>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash = '#sos'
                      }}
                    >
                      ♟ &nbsp; Kerahkan Perahu
                    </button>
                  </div>
                )
              })}
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