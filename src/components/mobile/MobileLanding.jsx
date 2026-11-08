import { useState } from 'react'
import RiskMap from '../RiskMap'
import './mobile.css'

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}

function BrandMark() {
  return (
    <span className="mobile-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M3 7c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
        <path d="M3 12c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
        <path d="M3 17c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
      </svg>
    </span>
  )
}

function FeatureIcon({ type }) {
  const paths = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10 21h4" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" /></>,
    sos: <><path d="M12 3 3 20h18L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" /></>,
  }

  return (
    <span className="mobile-feature-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[type]}</svg>
    </span>
  )
}

const FEATURES = [
  {
    type: 'bell',
    title: 'Peringatan lebih dini',
    description: 'Notifikasi otomatis berdasarkan sensor debit sungai dan prakiraan cuaca terkini.',
    link: 'Pelajari lebih lanjut',
  },
  {
    type: 'map',
    title: 'Peta risiko yang jelas',
    description: 'Lihat kondisi 25 desa, rute aman, dan posko terdekat dalam satu tampilan.',
    link: 'Pelajari lebih lanjut',
  },
  {
    type: 'sos',
    title: 'SOS satu sentuhan',
    description: 'Kirim lokasi dan kondisi keluarga langsung ke tim respons saat keadaan darurat.',
    link: 'Pelajari lebih lanjut',
  },
  {
    type: 'route',
    title: 'Evakuasi terkoordinasi',
    description: 'Prioritas bantuan untuk lansia, balita, difabel, dan kelompok rentan.',
    link: 'Pelajari lebih lanjut',
  },
]

const GUIDANCE_LEVELS = [
  ['Aman', 'Siapkan tas siaga dan simpan nomor darurat.'],
  ['Waspada', 'Pantau informasi dan pindahkan dokumen penting.'],
  ['Siaga', 'Bersiap menuju titik kumpul terdekat.'],
  ['Awas', 'Evakuasi segera sesuai arahan petugas.'],
]

export default function MobileLanding({
  averageProbability,
  discharge,
  rainfall,
  overallRisk,
  isKecamatanSafe,
  villages,
  displayedVillages,
  selectedVillage,
  onSelectVillage,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAllVillages, setShowAllVillages] = useState(false)
  const villagesToShow = showAllVillages ? villages : displayedVillages
  const isSignedIn = Boolean(localStorage.getItem('access_token'))
  const dashboardHash = localStorage.getItem('sigab_user_role') === 'petugas' ? '#petugas' : '#warga'

  function selectVillage(village) {
    onSelectVillage(village.cleanName)
  }

  return (
    <div className="mobile-landing">
      <aside className="mobile-alert-bar" aria-label="Status siaga kebencanaan">
        <span className="mobile-live-dot" />
        <div>
          <strong>STATUS {overallRisk.level.toUpperCase()}</strong>
          <p>
            {isKecamatanSafe
              ? `Bengawan Solo terpantau aman, debit ${discharge} m³/s.`
              : `Debit Bengawan Solo ${discharge} m³/s — tetap waspada.`}
          </p>
        </div>
        <a href="#status-wilayah" aria-label="Lihat status wilayah"><ArrowIcon /></a>
      </aside>

      <header className="mobile-header">
        <a className="mobile-brand" href="#" aria-label="SIGAB, beranda">
          <BrandMark />
          <span>
            <strong>SIGAB</strong>
            <small>Siaga Banjir Baureno</small>
          </span>
        </a>
        <a className="mobile-header-login" href={isSignedIn ? dashboardHash : '#masuk'}>
          {isSignedIn ? 'Buka dashboard' : 'Masuk'}
        </a>
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
        >
          <span /><span /><span />
        </button>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="Navigasi utama">
            <a href="#status-wilayah" onClick={() => setMenuOpen(false)}>Status wilayah</a>
            <a href="#layanan" onClick={() => setMenuOpen(false)}>Layanan</a>
            <a href="#panduan" onClick={() => setMenuOpen(false)}>Panduan</a>
            <a href="#kontak" onClick={() => setMenuOpen(false)}>Kontak darurat</a>
          </nav>
        )}
      </header>

      <main>
        <section className="mobile-hero">
          <span className="mobile-eyebrow">SISTEM PERINGATAN DINI</span>
          <h1>
            Lebih siap sebelum<br />
            <span>air naik.</span>
          </h1>
          <p>
            Sistem peringatan dini dan respons banjir yang membantu warga Baureno
            mengambil keputusan tepat—sebelum kondisi menjadi darurat.
          </p>
          <div className="mobile-hero-actions">
            <a className="mobile-button mobile-button-primary" href="#status-wilayah">
              Pantau wilayah saya <ArrowIcon />
            </a>
            <a className="mobile-button mobile-button-light" href="#panduan">
              Lihat panduan siaga <span aria-hidden="true">▷</span>
            </a>
          </div>
          <div className="mobile-hero-image">
            <img src="/hero-river.jpg" alt="Bengawan Solo di wilayah Baureno" />
            <span className="mobile-location-tag">● Kecamatan Baureno</span>
          </div>
          <article className="mobile-risk-card">
            <div className="mobile-risk-card-heading">
              <span><i /> PEMANTAUAN LANGSUNG</span>
              <small>2 menit lalu</small>
            </div>
            <span className="mobile-risk-label">STATUS WILAYAH</span>
            <div className="mobile-risk-summary">
              <div>
                <strong className={`mobile-risk-${overallRisk.status}`}>{overallRisk.level}</strong>
                <small>Level {overallRisk.levelNum} dari 4</small>
              </div>
              <b>{Math.round(averageProbability)}<small>%</small></b>
            </div>
            <div className="mobile-risk-details">
              <span>Debit air <b>{discharge} m³/s</b></span>
              <span>Curah hujan <b>{rainfall} mm/jam</b></span>
            </div>
            <p>{isKecamatanSafe ? 'Tidak ada perintah evakuasi' : 'Pantau kesiapsiagaan desa'}</p>
          </article>
        </section>

        <section className="mobile-stats" aria-label="Statistik utama">
          <article><span>Desa dipantau real-time</span><strong>25</strong></article>
          <article><span>Interval data sensor</span><strong>60 <small>dtk</small></strong></article>
          <article><span>Posko siap beroperasi</span><strong>8</strong></article>
          <article><span>Pusdalops BPBD siaga</span><strong>24/7</strong></article>
        </section>

        <section className="mobile-features" id="layanan">
          <span className="mobile-eyebrow">PERLINDUNGAN TERINTEGRASI</span>
          <h2>Satu sistem untuk setiap tahap kesiapsiagaan.</h2>
          <p className="mobile-section-intro">
            Informasi risiko hingga koordinasi evakuasi disajikan dengan langkah yang mudah dipahami warga.
          </p>
          <div className="mobile-feature-list">
            {FEATURES.map((feature) => (
              <article className="mobile-feature-card" key={feature.title}>
                <FeatureIcon type={feature.type} />
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <a href="#status-wilayah">{feature.link} <ArrowIcon /></a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mobile-region" id="status-wilayah">
          <span className="mobile-eyebrow">STATUS WILAYAH</span>
          <h2>Kenali kondisi sekitar Anda dalam sekejap.</h2>
          <p className="mobile-section-intro">
            Data sensor, cuaca, dan laporan lapangan diterjemahkan menjadi status sederhana dan rekomendasi tindakan yang jelas.
          </p>
          <div className="mobile-map">
            <RiskMap
              height="190px"
              selectedVillageName={selectedVillage}
              onSelectVillage={(village) => {
                if (village?.name) {
                  const cleanName = village.name.replace(/^Desa\s+/i, '')
                  onSelectVillage(cleanName)
                }
              }}
            />
          </div>
          <div className="mobile-village-list">
            {villagesToShow.map((village) => (
              <button
                type="button"
                key={village.id}
                className="mobile-village-row"
                onClick={() => selectVillage(village)}
              >
                <span>
                  <strong>{village.cleanName}</strong>
                  <small>Tinggi muka air {village.tma}</small>
                </span>
                <span className={`mobile-status-pill ${village.status}`}>{village.level}</span>
              </button>
            ))}
          </div>
          {villages.length > displayedVillages.length && (
            <button
              type="button"
              className="mobile-button mobile-button-dark"
              onClick={() => setShowAllVillages((showing) => !showing)}
            >
              {showAllVillages ? 'Tampilkan ringkasan' : 'Lihat semua wilayah'}
              <ArrowIcon />
            </button>
          )}
        </section>

        <section className="mobile-guidance" id="panduan">
          <span className="mobile-eyebrow">PANDUAN SIAGA</span>
          <h2>Tahu harus berbuat apa, di setiap level kondisi.</h2>
          <p>Instruksi ringkas dan praktis agar seluruh keluarga tetap tenang dan bergerak pada waktu yang tepat.</p>
          <div className="mobile-guidance-list">
            {GUIDANCE_LEVELS.map(([level, description]) => (
              <article key={level}>
                <strong className={`mobile-guidance-${level.toLowerCase()}`}>{level}</strong>
                <span>{description}</span>
              </article>
            ))}
          </div>
          <a className="mobile-button mobile-button-light" href="#daftar-warga">
            Unduh panduan keluarga <ArrowIcon />
          </a>
        </section>

        <section className="mobile-cta" id="daftar">
          <span className="mobile-eyebrow">MULAI SEKARANG</span>
          <h2>Siaga hari ini. Lebih aman esok hari.</h2>
          <p>Daftarkan keluarga Anda untuk menerima peringatan dan bantuan evakuasi yang lebih tepat sasaran.</p>
          <a className="mobile-button mobile-button-primary" href="#daftar-warga">
            Daftar sebagai warga <ArrowIcon />
          </a>
          <a className="mobile-button mobile-button-light" href="tel:0353881234">
            (0353) 881-234 · Siaga 24 jam
          </a>
        </section>
      </main>

      <footer className="mobile-footer" id="kontak">
        <a className="mobile-brand" href="#">
          <BrandMark />
          <span><strong>SIGAB</strong><small>Siaga Banjir Baureno</small></span>
        </a>
        <p>Platform kesiapsiagaan banjir untuk masyarakat Baureno.</p>
        <small>© 2026 SIGAB Baureno</small>
      </footer>
    </div>
  )
}
