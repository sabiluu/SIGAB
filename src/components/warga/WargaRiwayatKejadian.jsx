import { useState } from 'react'

const allEvents = [
  {
    id: 1,
    title: 'Banjir Bandang Bengawan Solo',
    date: '12 Feb 2026 • 03:20',
    desc: 'Luapan sungai merendam 6 desa. Evakuasi massal ke 3 posko.',
    category: 'awas',
    color: 'red',
    tma: '5.2 mdpl',
    rainfall: '146 mm',
    evacuation: '312 org',
  },
  {
    id: 2,
    title: 'Siaga Hujan Ekstrem',
    date: '28 Jan 2026 • 18:45',
    desc: 'Curah hujan tinggi 4 jam berturut. Status naik ke Siaga.',
    category: 'siaga',
    color: 'yellow',
    tma: '3.6 mdpl',
    rainfall: '112 mm',
    evacuation: '48 org',
  },
  {
    id: 3,
    title: 'Muka Air Naik Signifikan',
    date: '05 Jan 2026 • 22:10',
    desc: 'Pemantauan intensif TMA. Warga bantaran diimbau waspada.',
    category: 'siaga',
    color: 'yellow',
    tma: '3.4 mdpl',
    rainfall: '88 mm',
    evacuation: '12 org',
  },
  {
    id: 4,
    title: 'Pemulihan Pasca-Banjir',
    date: '19 Des 2025 • 09:00',
    desc: 'Kondisi normal kembali. Posko ditutup, warga kembali ke rumah.',
    category: 'aman',
    color: 'green',
    tma: '1.4 mdpl',
    rainfall: '6 mm',
    evacuation: '0 org',
  },
  {
    id: 5,
    title: 'Banjir Rob Musiman',
    date: '02 Des 2025 • 14:30',
    desc: 'Genangan hingga 80 cm di area rendah. Bantuan perahu dikerahkan.',
    category: 'awas',
    color: 'red',
    tma: '4.9 mdpl',
    rainfall: '121 mm',
    evacuation: '205 org',
  },
]

export default function WargaRiwayatKejadian() {
  const [filter, setFilter] = useState('semua')

  const filteredEvents =
    filter === 'semua' ? allEvents : allEvents.filter((item) => item.category === filter)

  return (
    <section className="warga-section">
      <div className="warga-section-header">
        <span className="warga-tag-pill blue">Riwayat Kejadian</span>
        <div className="warga-title-row">
          <div className="warga-title-col">
            <h1>Arsip Kejadian Hidrometeorologi</h1>
            <p>Rekam jejak status siaga, data hidrologi, dan jumlah evakuasi di wilayah Baureno.</p>
          </div>

          {/* Filter Pills */}
          <div className="riwayat-filter-bar">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              style={{ marginLeft: 8 }}
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <button
              type="button"
              className={`riwayat-filter-btn ${filter === 'semua' ? 'active' : ''}`}
              onClick={() => setFilter('semua')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`riwayat-filter-btn ${filter === 'awas' ? 'active' : ''}`}
              onClick={() => setFilter('awas')}
            >
              Awas
            </button>
            <button
              type="button"
              className={`riwayat-filter-btn ${filter === 'siaga' ? 'active' : ''}`}
              onClick={() => setFilter('siaga')}
            >
              Siaga
            </button>
            <button
              type="button"
              className={`riwayat-filter-btn ${filter === 'aman' ? 'active' : ''}`}
              onClick={() => setFilter('aman')}
            >
              Aman
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards in a row */}
      <div className="riwayat-stats-grid">
        <div className="riwayat-stat-card">
          <div className="riwayat-stat-label">TOTAL KEJADIAN</div>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num">27</span>
            <span className="riwayat-stat-unit">tahun ini</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <div className="riwayat-stat-label">STATUS AWAS</div>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#ef4444' }}>
              8
            </span>
            <span className="riwayat-stat-unit">kali</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <div className="riwayat-stat-label">TOTAL DIEVAKUASI</div>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#2563eb' }}>
              1.284
            </span>
            <span className="riwayat-stat-unit">orang</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <div className="riwayat-stat-label">TMA TERTINGGI</div>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#f59e0b' }}>
              5.2
            </span>
            <span className="riwayat-stat-unit">mdpl</span>
          </div>
        </div>
      </div>

      {/* Vertical Timeline Card Wrap */}
      <div className="riwayat-timeline-wrap">
        <div className="riwayat-timeline-list">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="riwayat-timeline-item">
              <span className={`riwayat-tl-dot ${evt.color}`} />
              <div className="riwayat-tl-card">
                <div className="riwayat-tl-header">
                  <span className="riwayat-tl-title">{evt.title}</span>
                  <span className="riwayat-tl-time">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {evt.date}
                  </span>
                </div>
                <p className="riwayat-tl-desc">{evt.desc}</p>
                <div className="riwayat-tl-badges">
                  <span className="riwayat-tl-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    TMA {evt.tma}
                  </span>
                  <span className="riwayat-tl-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5">
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    </svg>
                    Hujan {evt.rainfall}
                  </span>
                  <span className="riwayat-tl-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Evakuasi {evt.evacuation}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
