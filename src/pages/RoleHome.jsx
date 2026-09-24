import { useState, useEffect } from 'react'
import { logout } from '../services/authService'
import RiskMap from '../components/RiskMap'

const wargaAssetPrefix = 'https://www.figma.com/api/mcp/asset/d84f02db-e7d0-4c80-8d2c-7b2c55160913'
const brandIcon = `${wargaAssetPrefix}/375ad.svg`

function Brand({ admin = false }) {
  return <div className={`role-brand ${admin ? 'role-brand-admin' : ''}`}><span className="role-brand-icon"><img src={brandIcon} alt="" /></span><span className="brand-text"><strong>SiagaBencana</strong><small>{admin ? 'Pusdalops BPBD' : 'Portal Warga · Baureno'}</small></span></div>
}

function WargaHome() {
  return <main className="portal warga-portal"><header className="portal-header"><Brand /><nav><a className="active" href="#warga">Beranda</a><a href="#wilayah">Peta Wilayah</a><a href="#riwayat">Riwayat Kejadian</a><a href="#panduan">Panduan</a><a href="#kontak">Kontak Darurat</a></nav><div className="portal-tools"><span>⌖ &nbsp; Baureno, Bojonegoro</span><button type="button">♧</button><i>AF</i><button type="button" onClick={logout} className="logout-btn" title="Keluar"><i>⎋</i> Keluar</button></div></header><div className="portal-body warga-body"><section className="warga-main"><article className="warga-overview portal-card"><div className="gauge"><div><strong>25<small>%</small></strong><span>PROBABILITAS BANJIR</span></div></div><div className="overview-copy"><div className="fresh-badge">Real-time <span>◷ Diperbarui 08:42 WIB</span></div><h1>Kondisi hidrologi wilayah Anda dalam batas normal.</h1><p>Sistem memantau debit Sungai Bengawan Solo dan curah hujan BMKG setiap 60 detik. Fitur rute evakuasi & SOS akan aktif otomatis saat status naik ke Siaga.</p><div className="trend"><div><small>TREN RISIKO 12 JAM</small><strong>stabil</strong></div><div className="trend-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div></div></article><h2 className="subsection-title">Kondisi Cuaca & Sungai</h2><div className="weather-grid"><Metric icon="☁" status="Cerah" value="0" unit="mm/jam" label="Curah Hujan" /><Metric icon="♜" status="Normal" value="1.2" unit="mdpl" label="Tinggi Muka Air" /><Metric icon="▥" status="Hangat" value="29" unit="°C" label="Suhu Udara" /><Metric icon="→" status="Tenang" value="8" unit="km/j" label="Kecepatan Angin" /></div><article className="emergency-disabled portal-card"><div className="section-title-row"><div><h2>Fitur Darurat</h2><p>Nonaktif selama kondisi aman untuk menghindari kepanikan.</p></div><b>Nonaktif</b></div><div className="disabled-actions"><button type="button">▧ &nbsp; Rute Evakuasi ke Posko</button><button type="button">⚠ &nbsp; Tombol SOS Bantuan</button></div></article></section><aside className="warga-side"><article className="hotline-card"><h3>♧ &nbsp; Kontak Darurat</h3><div><span>Pusdalops BPBD</span><strong>0353-881234</strong></div><div><span>Call Center</span><strong>112</strong></div><div><span>Posko Kecamatan</span><strong>0353-887788</strong></div></article><article className="portal-card nearest-card"><div className="side-heading"><h3>Posko Terdekat</h3><b>Standby</b></div><strong>Posko SDN Baureno 2</strong><p>⌖ 1.2 km · Jl. Raya Baureno No.14</p><div className="capacity-label"><span>Kapasitas</span><strong>120 orang</strong></div><div className="capacity-track"><i /></div></article><article className="portal-card history-card"><div className="side-heading"><h3>Riwayat Kejadian</h3><a href="#riwayat">Lihat semua ›</a></div><History color="red" title="Banjir Bandang" detail="Debit 3.900 m³/s" date="12 Feb 2026" /><History color="yellow" title="Siaga Hujan Ekstrem" detail="112 mm/jam" date="28 Jan 2026" /><History color="yellow" title="Muka Air Naik" detail="TMA 3.4 mdpl" date="05 Jan 2026" /><History color="green" title="Kondisi Normal" detail="Pemulihan" date="19 Des 2025" /></article></aside></div></main>
}

function Metric({ icon, status, value, unit, label }) { return <article className="metric-card portal-card"><div className="metric-top"><span>{icon}</span><b>{status}</b></div><strong>{value}<small>{unit}</small></strong><p>{label}</p></article> }
function History({ color, title, detail, date }) { return <div className="history-item"><i className={color} /><div><strong>{title}</strong><small>{detail}</small></div><time>{date}</time></div> }

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

  return <main className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`}><aside className="admin-sidebar"><div className="sidebar-header"><button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">☰</button><Brand admin /></div><nav><a className="active" href="#petugas"><i>▦</i> <span>Dashboard</span></a><a href="#radar"><i>◉</i> <span>Radar Peta</span></a><a href="#sos"><i>▣</i> <span>Tiket SOS</span><b>12</b></a><a href="#posko"><i>♙</i> <span>Manajemen Posko</span></a></nav><div className="operator"><span className="op-status">●</span><div className="op-text"><small>Petugas Jaga</small><strong>Kec. Baureno</strong><span>Online · Shift Pagi</span></div></div></aside><section className="admin-content"><header className="admin-header"><div className="search-box">⌕ &nbsp; Cari desa, tiket, atau petugas...</div><div className="admin-time"><strong>{timeStr}</strong><small>{dateStr}</small></div><div className="danger-toggle"><span>STATUS DARURAT<br /><strong>AKTIF</strong></span><i /></div><div className="admin-avatar">●</div><button onClick={logout} className="logout-btn" title="Keluar"><i>⎋</i> Keluar</button></header><div className="admin-dashboard"><div className="kpi-grid"><Kpi icon="♜" label="RERATA DEBIT SUNGAI" value="1.842" unit="m³/s" change="+8.4%" /><Kpi icon="☁" label="RERATA CURAH HUJAN" value="112" unit="mm" change="+21%" /><Kpi icon="⚠" label="TIKET SOS AKTIF" value="12" unit="tiket" change="+5 baru" danger /><Kpi icon="♧" label="TOTAL KAPASITAS POSKO" value="640" unit="/1.2k" change="53% terisi" /></div><div className="admin-main-grid"><article className="risk-map portal-card"><div className="admin-section-head"><div><h2>Peta Risiko 25 Desa <b>● Live Radar (60d)</b></h2><p>Kecamatan Baureno — Visualisasi Spasial & Sebaran Genangan Bengawan Solo</p></div></div><div className="map-legend"><span className="red-dot" /> Tinggi (Awas) <span className="orange-dot" /> Sedang (Siaga) <span className="green-dot" /> Aman <button type="button">▧ Buka Radar ↗</button></div><RiskMap /></article><article className="sos-queue portal-card"><div className="admin-section-head"><h2>🔴 Antrian SOS Live</h2><b>12 masuk</b></div>{['EVAC-BRN-001|Dsn. Krajan RT03|4 orang • Lansia|2 mnt lalu','EVAC-BRN-002|Jl. Bengawan 12|7 orang • Balita, Hamil|5 mnt lalu','EVAC-BRN-003|Dsn. Sawah RT01|2 orang • Difabel|8 mnt lalu','EVAC-BRN-004|Ps. Baureno blok C|11 orang|11 mnt lalu'].map((ticket) => { const [id, location, people, time] = ticket.split('|'); return <div className="sos-ticket" key={id}><div><strong>{id}</strong><time>{time}</time></div><b>{location}</b><small>♙ {people}</small><button type="button">♟ &nbsp; Kerahkan Perahu</button></div> })}</article></div></div></section></main>
}

function Kpi({ icon, label, value, unit, change, danger }) { return <article className="kpi-card portal-card"><div><span>{icon}</span><b className={danger ? 'danger-text' : ''}>{change}</b></div><small>{label}</small><strong>{value}<em>{unit}</em></strong></article> }

function RoleHome({ role }) { return role === 'petugas' ? <AdminHome /> : <WargaHome /> }

export default RoleHome