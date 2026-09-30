import AdminLayout from '../../components/admin/AdminLayout'

export default function PoskoManager() {
  const poskoList = [
    { title: 'Posko SDN Baureno 2', desa: 'Desa Baureno', current: 75, max: 120, status: 'Hampir Penuh', pic: 'Sutrisno', pct: '63%' },
    { title: 'Balai Desa Gunungsari', desa: 'Desa Gunungsari', current: 22, max: 80, status: 'Tersedia', pic: 'Wahyudi', pct: '28%' },
    { title: 'Masjid Agung Baureno', desa: 'Desa Baureno', current: 60, max: 200, status: 'Tersedia', pic: 'H. Anwar', pct: '30%' },
    { title: 'GOR Kecamatan', desa: 'Desa Kauman', current: 290, max: 300, status: 'Hampir Penuh', pic: 'Bripka Dedi', pct: '97%' },
    { title: 'SMPN 1 Baureno', desa: 'Desa Kauman', current: 150, max: 150, status: 'Penuh', pic: 'Rahmawati', pct: '100%' },
    { title: 'Balai Desa Drajat', desa: 'Desa Drajat', current: 12, max: 90, status: 'Tersedia', pic: 'Kusnadi', pct: '13%' },
  ]

  return (
    <AdminLayout activeMenu="posko">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Posko</h2>
          <p>Atur kapasitas & kuota pengungsian tiap posko secara langsung.</p>
        </div>
        <button className="primary-btn">+ Tambah Posko</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card portal-card">
          <small>TOTAL POSKO</small>
          <strong>6 <small>lokasi</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>TERISI</small>
          <strong>609 <small>/ 940</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>SISA KUOTA</small>
          <strong>331 <small>tempat</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>OKUPANSI</small>
          <strong>65%</strong>
        </div>
      </div>

      <div className="posko-grid">
        {poskoList.map((posko, idx) => (
          <div key={idx} className="posko-card portal-card">
            <div className="posko-card-header">
              <div>
                <strong>{posko.title}</strong>
                <small>@ {posko.desa}</small>
              </div>
              <span className={`status-badge ${posko.status.toLowerCase().replace(' ', '-')}`}>{posko.status}</span>
            </div>

            <div className="posko-stats">
              <strong>{posko.current} <small>/ {posko.max}</small></strong>
              <span className="pct">{posko.pct}</span>
            </div>

            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: posko.pct, background: posko.pct === '100%' ? '#dc2626' : '#f59e0b' }}></div>
            </div>

            <div className="posko-footer">
              <span>PIC: {posko.pic}</span>
              <div className="stepper">
                <button>-</button>
                <span>±5</span>
                <button>+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
