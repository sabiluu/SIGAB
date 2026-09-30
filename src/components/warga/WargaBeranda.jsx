export default function WargaBeranda({ onNavigate }) {
  return (
    <div className="portal-body warga-body" style={{ maxWidth: '1400px', padding: 0 }}>
      <section className="warga-main">
        {/* Overview Gauge Card */}
        <article className="warga-overview portal-card">
          <div className="gauge">
            <div>
              <strong>
                25<small>%</small>
              </strong>
              <span>PROBABILITAS BANJIR</span>
            </div>
          </div>
          <div className="overview-copy">
            <div className="fresh-badge">
              Real-time <span>◷ Diperbarui 08:42 WIB</span>
            </div>
            <h1>Kondisi hidrologi wilayah Anda dalam batas normal (AMAN).</h1>
            <p>
              Sistem memantau debit Sungai Bengawan Solo dan curah hujan BMKG setiap 60 detik. Fitur rute evakuasi &amp;
              tombol SOS disiagakan dan akan aktif otomatis saat status naik ke Siaga atau Awas.
            </p>
            <div className="trend">
              <div>
                <small>TREN RISIKO 12 JAM</small>
                <strong>stabil</strong>
              </div>
              <div className="trend-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </article>

        {/* Weather & River Metrics */}
        <h2 className="subsection-title" style={{ marginTop: '28px' }}>
          Kondisi Cuaca &amp; Sungai Terkini
        </h2>
        <div className="weather-grid">
          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>☁</span>
              <b>Cerah</b>
            </div>
            <strong>
              0<small>mm/jam</small>
            </strong>
            <p>Curah Hujan</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>♜</span>
              <b>Normal</b>
            </div>
            <strong>
              1.2<small>mdpl</small>
            </strong>
            <p>Tinggi Muka Air</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>▥</span>
              <b>Hangat</b>
            </div>
            <strong>
              29<small>°C</small>
            </strong>
            <p>Suhu Udara</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>→</span>
              <b>Tenang</b>
            </div>
            <strong>
              8<small>km/j</small>
            </strong>
            <p>Kecepatan Angin</p>
          </article>
        </div>

        {/* Emergency Features Disabled during AMAN */}
        <article className="emergency-disabled portal-card">
          <div className="section-title-row">
            <div>
              <h2>Fitur Darurat &amp; Evakuasi</h2>
              <p>Nonaktif selama kondisi AMAN untuk menghindari kepanikan dan pemanggilan palsu.</p>
            </div>
            <b>Nonaktif (Aman)</b>
          </div>
          <div className="disabled-actions">
            <button type="button" onClick={() => onNavigate('peta')}>
              ▧ &nbsp; Buka Peta Risiko 23 Desa
            </button>
            <button type="button" onClick={() => onNavigate('panduan')}>
              📖 &nbsp; Pelajari Panduan Siaga Bencana
            </button>
          </div>
        </article>
      </section>

      {/* Aside Right */}
      <aside className="warga-side">
        <article className="hotline-card">
          <h3>♧ &nbsp; Kontak Cepat</h3>
          <div>
            <span>Pusdalops BPBD</span>
            <strong>0353-881234</strong>
          </div>
          <div>
            <span>Call Center</span>
            <strong>112</strong>
          </div>
          <div>
            <span>Posko Kecamatan</span>
            <strong>0353-887788</strong>
          </div>
        </article>

        <article className="portal-card nearest-card">
          <div className="side-heading">
            <h3>Posko Terdekat</h3>
            <b>Standby</b>
          </div>
          <strong>Posko SDN Baureno 2</strong>
          <p>⌖ 1.2 km · Jl. Raya Baureno No.14</p>
          <div className="capacity-label">
            <span>Kapasitas</span>
            <strong>120 orang</strong>
          </div>
          <div className="capacity-track">
            <i style={{ width: '25%' }} />
          </div>
        </article>

        <article className="portal-card history-card">
          <div className="side-heading">
            <h3>Riwayat Kejadian</h3>
            <button
              type="button"
              onClick={() => onNavigate('riwayat')}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.7rem' }}
            >
              Lihat semua ›
            </button>
          </div>
          <div className="history-item">
            <i className="red" />
            <div>
              <strong>Banjir Bandang</strong>
              <small>Debit 3.900 m³/s</small>
            </div>
            <time>12 Feb 2026</time>
          </div>
          <div className="history-item">
            <i className="yellow" />
            <div>
              <strong>Siaga Hujan Ekstrem</strong>
              <small>112 mm/jam</small>
            </div>
            <time>28 Jan 2026</time>
          </div>
          <div className="history-item">
            <i className="green" />
            <div>
              <strong>Kondisi Normal (Aman)</strong>
              <small>Pemulihan tuntas</small>
            </div>
            <time>19 Des 2025</time>
          </div>
        </article>
      </aside>
    </div>
  )
}
