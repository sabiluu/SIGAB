import AdminLayout from '../../components/admin/AdminLayout'
import RiskMap from '../../components/RiskMap'

export default function RadarPeta() {
  return (
    <AdminLayout activeMenu="radar">
      <div className="admin-section-head">
        <div>
          <h2>Radar Peta Wilayah</h2>
          <p>Pemantauan real-time debit Bengawan Solo & risiko banjir 23 desa.</p>
        </div>
        <div className="layer-pills">
          <button className="active">Risiko Banjir</button>
          <button>Debit Sungai</button>
          <button>Kepadatan Warga</button>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="portal-card" style={{ padding: '16px', position: 'relative', height: '600px' }}>
          <RiskMap />
          <div className="map-legend-bottom">
            <span><i className="red-dot" /> Tinggi / Awas (6)</span>
            <span><i className="orange-dot" /> Sedang / Siaga (8)</span>
            <span><i className="green-dot" /> Rendah / Aman (9)</span>
          </div>
        </div>

        <aside className="radar-detail-panel">
          <div className="portal-card danger-card">
            <small>DESA TERPILIH</small>
            <h2>Baureno</h2>
            <span className="badge-awas">AWAS</span>
          </div>

          <div className="metrics-2x2">
            <div className="portal-card metric-box">
              <small>TMA</small>
              <strong>4.8 <small>mdpl</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>DEBIT</small>
              <strong>3.900 <small>m³/s</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>POPULASI</small>
              <strong>6.800 <small>jiwa</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>SKOR RISIKO</small>
              <strong>82%</strong>
            </div>
          </div>

          <div className="portal-card priority-list">
            <h4>Prioritas Tertinggi</h4>
            <ul>
              <li><span>Baureno</span> <strong>TMA 4.8</strong></li>
              <li><span>Trojalu</span> <strong>TMA 4.5</strong></li>
              <li><span>Gajah</span> <strong>TMA 4.6</strong></li>
              <li><span>Kalisari</span> <strong>TMA 4.4</strong></li>
              <li><span>Sraturejo</span> <strong>TMA 4.3</strong></li>
              <li><span>Tulungrejo</span> <strong>TMA 4.2</strong></li>
            </ul>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
