import { useEffect, useState } from 'react'
import AuthPage from './pages/AuthPage'
import RoleHome from './pages/RoleHome'
import { LoadingState, ErrorState, EmptyState } from './components/common/AsyncState'

const assetPathPrefix = 'https://www.figma.com/api/mcp/asset/187de7f3-3e0e-42e4-9bfe-938d4a46eeaf'

const icons = {
  bell: `${assetPathPrefix}/be811.svg`, map: `${assetPathPrefix}/80da8.svg`, sos: `${assetPathPrefix}/420fc.svg`, signal: `${assetPathPrefix}/c9188.svg`, check: `${assetPathPrefix}/623c0.svg`, brand: `https://www.figma.com/api/mcp/asset/d84f02db-e7d0-4c80-8d2c-7b2c55160913/375ad.svg`, warga: `${assetPathPrefix}/f7d97.svg`, petugas: `${assetPathPrefix}/a12f6.svg`, phone: `${assetPathPrefix}/72ea2.svg`,
}

const features = [
  { icon: icons.bell, tone: 'yellow', title: 'Peringatan Dini', text: 'Notifikasi Siaga & Awas otomatis berbasis debit sungai dan prakiraan BMKG, langsung ke perangkat Anda.' },
  { icon: icons.map, tone: 'blue', title: 'Peta Risiko Wilayah', text: 'Pantau status risiko banjir tiap dusun, tinggi muka air, dan rute evakuasi terdekat secara langsung.' },
  { icon: icons.sos, tone: 'rose', title: 'Tombol SOS Evakuasi', text: 'Minta bantuan evakuasi satu ketuk. Lokasi GPS & data rumah tangga langsung diterima tim perahu BPBD.' },
  { icon: icons.signal, tone: 'green', title: 'Terhubung Pusdalops', text: 'Command center BPBD memantau seluruh tiket SOS, kuota posko, dan status desa dalam satu radar.' },
]

const steps = [
  ['01', 'Daftar & verifikasi', 'Buat akun warga dengan NIK dan data rumah tangga untuk prioritas evakuasi.'],
  ['02', 'Pantau & terima peringatan', 'Lihat status wilayah Anda dan terima peringatan dini saat air Bengawan Solo naik.'],
  ['03', 'Minta bantuan saat darurat', 'Tekan SOS — tim perahu BPBD dikerahkan ke titik Anda dengan prioritas kelompok rentan.'],
]

function Brand({ footer = false }) {
  return <div className={`landing-brand ${footer ? 'landing-brand-footer' : ''}`}><span className="brand-icon"><img src={icons.brand} alt="" /></span><span><strong>SiagaBencana</strong>{!footer && <small>BOJONEGORO</small>}</span></div>
}

function App() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const authMatch = hash.match(/^#(masuk|daftar)(?:-(warga|petugas))?$/)

  if (authMatch) {
    return <AuthPage initialMode={authMatch[1] === 'daftar' ? 'register' : 'login'} initialRole={authMatch[2] || 'warga'} />
  }

  // Route khusus untuk screenshot laporan PPT (menampilkan UI State Management)
  if (hash === '#demo') {
    return (
      <div style={{ padding: '60px', display: 'flex', gap: '30px', background: '#f5f7f6', minHeight: '100vh', alignItems: 'center' }}>
         <div style={{ flex: 1 }}><LoadingState label="Sedang memuat data dari server..." /></div>
         <div style={{ flex: 1 }}><ErrorState message="Gagal terhubung ke API Server." onRetry={() => {}} /></div>
         <div style={{ flex: 1 }}><EmptyState title="Belum ada data tiket" message="Tiket SOS warga yang masuk akan tampil di sini." /></div>
      </div>
    )
  }
  if (hash === '#warga' || hash === '#petugas') {
    const token = localStorage.getItem('access_token')
    if (!token) {
      const role = hash === '#petugas' ? 'petugas' : 'warga'
      window.history.replaceState(null, '', `#masuk-${role}`)
      return <AuthPage initialMode="login" initialRole={role} />
    }
    return <RoleHome role={hash.slice(1)} />
  }

  return (
    <div className="landing-page">
      <header className="landing-header"><Brand /><nav className="landing-nav" aria-label="Navigasi utama"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara Kerja</a><a href="#wilayah">Wilayah</a><a href="#kontak">Kontak</a></nav><div className="header-actions"><a href="#masuk">Masuk</a><a className="header-register" href="#daftar">Daftar <span>→</span></a></div></header>
      <main>
        <section className="landing-hero" id="wilayah"><div className="hero-grid"><div className="hero-copy"><div className="live-badge"><span /> SISTEM AKTIF • PEMANTAUAN LANGSUNG</div><h1>Lebih siap.<br />Lebih cepat selamat dari <em>banjir</em><br /><em>Bengawan Solo.</em></h1><p className="hero-lead">Sistem peringatan dini dan evakuasi banjir untuk 23 desa di Kecamatan Baureno, Bojonegoro. Pantau risiko real-time, terima peringatan dini, dan minta bantuan evakuasi langsung dari genggaman Anda.</p><div className="hero-actions"><a className="primary-button" href="#masuk-warga"><img src={icons.warga} alt="" /> Masuk sebagai Warga</a><a className="secondary-button" href="#masuk-petugas"><img src={icons.petugas} alt="" /> Portal Petugas BPBD</a></div><p className="hero-hotline"><img src={icons.phone} alt="" /> Darurat banjir? Hubungi call center BPBD Bojonegoro <strong>(0353) 881-234</strong></p></div><div className="status-card"><div className="status-card-header"><strong><span /> STATUS KECAMATAN BAURENO</strong><small>upd: 09:15</small></div><div className="status-level"><small>LEVEL SIAGA SAAT INI</small><strong>SIAGA II</strong><span>6 desa risiko tinggi • 8 desa risiko sedang</span></div><div className="status-metrics"><div><small>Tinggi Muka Air</small><strong>4.8 <span>mdpl</span></strong></div><div><small>Debit Sungai</small><strong>3.9k <span>m³/s</span></strong></div></div><div className="status-villages"><div><span /> Desa Baureno <b>AWAS</b></div><div><span /> Desa Trojalu <b>AWAS</b></div><div><span /> Desa Pasinan <b className="siaga">SIAGA</b></div></div><a className="status-link" href="#fitur">Lihat peta lengkap 23 desa <span>›</span></a></div></div></section>
        <section className="stat-strip"><div><strong>23 <span>desa</span></strong><small>Dipantau real-time</small></div><div><strong>60 <span>detik</span></strong><small>Interval pembaruan</small></div><div><strong>3.9k <span>m³/s</span></strong><small>Debit Bengawan Solo</small></div><div><strong>24/7</strong><small>Pusdalops BPBD siaga</small></div></section>
        <section className="feature-section" id="fitur"><div className="section-heading centered"><span className="section-kicker">KENAPA SIAGABENCANA</span><h2>Satu platform, dari peringatan hingga evakuasi</h2><p>Dirancang bersama BPBD Bojonegoro untuk mempersingkat waktu tanggap dan menyelamatkan<br className="desktop-only" /> lebih banyak jiwa saat Bengawan Solo meluap.</p></div><div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.title}><div className={`feature-icon ${feature.tone}`}><img src={feature.icon} alt="" /></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
        <section className="how-section" id="cara-kerja"><div className="how-grid"><div className="how-summary"><span className="section-kicker">CARA KERJA</span><h2>Tiga langkah menuju siaga penuh</h2><p>Warga terdaftar mendapat perlindungan berlapis — dari peringatan dini otomatis hingga respons evakuasi berprioritas. Semua terhubung ke command center BPBD.</p><ul><li><span><img src={icons.check} alt="" /></span>Gratis untuk seluruh warga Baureno</li><li><span><img src={icons.check} alt="" /></span>Data pribadi terenkripsi & terverifikasi</li><li><span><img src={icons.check} alt="" /></span>Prioritas untuk lansia, balita, & difabel</li></ul></div><div className="step-list">{steps.map(([number, title, text]) => <a className="step-card" href="#daftar" key={number}><strong>{number}</strong><div><h3>{title}</h3><p>{text}</p></div><span>›</span></a>)}</div></div></section>
        <section className="landing-cta" id="daftar"><div><h2>Daftar sekarang. Bersiap sebelum air naik.</h2><p>Butuh waktu kurang dari dua menit. Sekali daftar, wilayah Anda terpantau sepanjang musim penghujan.</p></div><div className="cta-actions"><a className="cta-light" href="#daftar-warga"><img src={icons.warga} alt="" /> Daftar sebagai Warga</a><a className="cta-dark" href="#masuk-petugas"><img src={icons.petugas} alt="" /> Masuk Petugas</a></div></section>
      </main>
      <footer className="landing-footer" id="kontak"><Brand footer /><span>© 2026 SiagaBencana</span></footer>
    </div>
  )
}

export default App
