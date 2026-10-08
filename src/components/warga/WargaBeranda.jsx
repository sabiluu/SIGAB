import useDashboardRealtime from '../../hooks/useDashboardRealtime';

// Hitung jarak Haversine (km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function WargaBeranda({ onNavigate, geo }) {
  const { data, loading, error } = useDashboardRealtime();

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Memuat data realtime...</div>;
  if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>Error: {error}</div>;

  const { weather, discharge, kecamatan_summary } = data || {};
  const prob = kecamatan_summary?.average_probability || 0;
  const isAman = kecamatan_summary?.overall_status === 'rendah';
  
  // Format waktu
  const lastUpdated = weather?.recorded_at ? new Date(weather.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  
  // Hitung properti SVG Gauge
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(prob, 100) / 100) * circumference;

  // Temukan Posko Terdekat dari Koordinat GPS Nyata Pengguna
  const shelters = data?.shelters || [];
  let nearestShelter = shelters[0];
  let nearestDistance = null;

  if (geo?.latitude && geo?.longitude && shelters.length > 0) {
    let minD = Infinity;
    shelters.forEach(s => {
      if (s.latitude && s.longitude) {
        const d = getDistanceKm(geo.latitude, geo.longitude, parseFloat(s.latitude), parseFloat(s.longitude));
        if (d !== null && d < minD) {
          minD = d;
          nearestShelter = s;
        }
      }
    });
    if (minD !== Infinity) {
      nearestDistance = minD.toFixed(1);
    }
  }

  const shelter = nearestShelter;
  const shelterName = shelter?.name || 'Posko SDN Baureno 2';
  const shelterAddress = shelter?.address || 'Jl. Raya Baureno No.14';
  const shelterCapTotal = shelter?.capacity_total || 120;
  const shelterCapOcc = shelter?.capacity_occupied || 30;
  const shelterOccPerc = shelterCapTotal > 0 ? (shelterCapOcc / shelterCapTotal) * 100 : 0;

  return (
    <div className="portal-body warga-body" style={{ maxWidth: '1400px', padding: 0 }}>
      <section className="warga-main">
        {/* Overview Gauge Card */}
        <article className={`warga-overview portal-card ${!isAman ? 'status-danger' : ''}`}>
          <div className="gauge" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px' }}>
            <svg viewBox="0 0 140 85" style={{ width: '100%', maxWidth: '220px', dropShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              {/* Background Arc */}
              <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
              {/* Animated Foreground Arc */}
              <path 
                d="M 10 70 A 60 60 0 0 1 130 70" 
                fill="none" 
                stroke={isAman ? "#10b981" : "#ef4444"} 
                strokeWidth="12" 
                strokeLinecap="round" 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease-out' }}
              />
              <text x="70" y="55" textAnchor="middle" fontSize="26" fontWeight="bold" fill={isAman ? "#10b981" : "#ef4444"}>
                {Math.round(prob)}%
              </text>
              <text x="70" y="75" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b" style={{ letterSpacing: '1px' }}>
                PROBABILITAS
              </text>
            </svg>
          </div>
          <div className="overview-copy">
            <div className="fresh-badge">
              Real-time <span>◷ Diperbarui {lastUpdated} WIB</span>
            </div>
            <h1>
              {isAman 
                ? 'Kondisi hidrologi wilayah Anda dalam batas normal (AMAN).'
                : `Peringatan: Status Siaga/Awas. Probabilitas banjir rata-rata kecamatan mencapai ${Math.round(prob)}%.`}
            </h1>
            <p>
              Sistem memantau debit Sungai Bengawan Solo dan curah hujan BMKG setiap 30 menit. Fitur rute evakuasi &amp;
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
              <b>{weather?.precipitation_mm > 0 ? 'Hujan' : 'Cerah'}</b>
            </div>
            <strong>
              {weather?.precipitation_mm || 0}<small>mm/j</small>
            </strong>
            <p>Curah Hujan</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>♜</span>
              <b>{discharge?.discharge_m3s > 2000 ? 'Tinggi' : 'Normal'}</b>
            </div>
            <strong>
              {discharge?.discharge_m3s || 0}<small>m³/s</small>
            </strong>
            <p>Debit Sungai</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>▥</span>
              <b>Hangat</b>
            </div>
            <strong>
              {weather?.temperature_c || 0}<small>°C</small>
            </strong>
            <p>Suhu Udara</p>
          </article>

          <article className="metric-card portal-card">
            <div className="metric-top">
              <span>→</span>
              <b>Tenang</b>
            </div>
            <strong>
              {weather?.wind_speed_kmh || 0}<small>km/j</small>
            </strong>
            <p>Kecepatan Angin</p>
          </article>
        </div>

        <article className={`emergency-disabled portal-card ${!isAman ? 'emergency-active' : ''}`}>
          <div className="section-title-row">
            <div>
              <h2>Fitur Darurat &amp; Evakuasi</h2>
              <p>
                {isAman 
                  ? 'Kondisi umum normal. Tombol evakuasi darurat tetap disiagakan 24/7 jika Anda mengalami ancaman lokal.'
                  : 'Sistem Darurat AKTIF. Segera amankan diri dan kirimkan permohonan evakuasi jika membutuhkan pertolongan.'}
              </p>
            </div>
            <b>{isAman ? '● Siaga 24 Jam' : '🚨 AKTIF (Darurat)'}</b>
          </div>
          <div className="disabled-actions">
            <button 
              type="button" 
              onClick={() => onNavigate('sos')}
              style={{ background: '#dc2626', color: 'white', fontWeight: 'bold' }}
            >
              🚨 &nbsp; MINTA EVAKUASI (SOS)
            </button>
            <button type="button" onClick={() => onNavigate('peta')}>
              ▧ &nbsp; Peta Risiko &amp; Rute Evakuasi
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
          <strong>{shelterName}</strong>
          <p>
            ⌖ {nearestDistance ? `${nearestDistance} km dari lokasi Anda` : (shelter?.address ? 'Sesuai Peta' : '1.2 km')} · {shelterAddress}
          </p>
          <div className="capacity-label">
            <span>Kapasitas (Terisi {shelterCapOcc})</span>
            <strong>{shelterCapTotal} orang</strong>
          </div>
          <div className="capacity-track">
            <i style={{ width: `${Math.min(shelterOccPerc, 100)}%`, background: shelterOccPerc > 80 ? '#ef4444' : '#3b82f6', transition: 'width 1s ease-in-out' }} />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('peta')}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '8px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🗺️ Lihat Rute ke Posko Ini
          </button>
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
  );
}
