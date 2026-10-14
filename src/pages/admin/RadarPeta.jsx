import { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import RiskMap from '../../components/RiskMap'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'

export default function RadarPeta() {
  const { data } = useDashboardRealtime()
  const [selectedVillageName, setSelectedVillageName] = useState('Baureno')

  const villages = data?.villages || []
  const sortedPriority = [...villages].sort((a, b) => b.probability - a.probability).slice(0, 6)

  const currentVillage = villages.find(v => 
    v.name.toLowerCase().includes(selectedVillageName.toLowerCase()) || 
    selectedVillageName.toLowerCase().includes(v.name.toLowerCase())
  ) || villages[0] || {
    name: 'Baureno',
    risk_level: 'awas',
    probability: 82,
    elevation_index: 18.5
  }

  const dischargeVal = data?.discharge?.discharge_m3s 
    ? Math.round(data.discharge.discharge_m3s).toLocaleString('id-ID')
    : '1.200'

  const rainVal = data?.weather?.precipitation_mm ?? 0

  const handleSelectVillage = (villageObj) => {
    if (villageObj && villageObj.name) {
      setSelectedVillageName(villageObj.name.replace(/^Desa\s+/i, ''))
    }
  }

  const riskBadgeClass = {
    awas: 'badge-awas',
    tinggi: 'badge-siaga',
    siaga: 'badge-siaga',
    sedang: 'badge-waspada',
    waspada: 'badge-waspada',
    rendah: 'badge-aman',
    aman: 'badge-aman'
  }[currentVillage.risk_level] || 'badge-aman'

  return (
    <AdminLayout activeMenu="radar">
      <div className="admin-section-head">
        <div>
          <h2>Radar Peta Wilayah & Geospasial</h2>
          <p>Pemantauan debit Sungai Bengawan Solo & risiko banjir 25 desa di Kecamatan Baureno.</p>
        </div>
        <div className="layer-pills">
          <button className="active">Risiko Banjir</button>
          <button onClick={() => window.location.hash = '#posko'}>Posko Evakuasi</button>
          <button onClick={() => window.location.hash = '#sos'}>Antrian SOS</button>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="portal-card" style={{ padding: '16px', position: 'relative', height: '620px' }}>
          <RiskMap 
            onSelectVillage={handleSelectVillage} 
            selectedVillageName={selectedVillageName} 
            shelters={data?.shelters || []}
            height="550px"
          />
          <div className="map-legend-bottom">
            <span><i className="red-dot" /> Sangat Tinggi / Awas</span>
            <span><i className="orange-dot" /> Tinggi / Siaga</span>
            <span><i className="yellow-dot" /> Sedang / Waspada</span>
            <span><i className="green-dot" /> Rendah / Aman</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px' }}>🏠</span> Posko Evakuasi
            </span>
          </div>
        </div>
        <aside className="radar-detail-panel">
          <div className="portal-card danger-card">
            <small>DESA TERPILIH (KLIK PETA / DAFTAR)</small>
            <h2>Desa {currentVillage.name.replace(/^Desa\s+/i, '')}</h2>
            <span className={riskBadgeClass}>{currentVillage.risk_level.toUpperCase()}</span>
          </div>

          <div className="metrics-2x2">
            <div className="portal-card metric-box">
              <small>PROBABILITAS</small>
              <strong>{Math.round(currentVillage.probability)} <small>%</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>DEBIT SUNGAI</small>
              <strong>{dischargeVal} <small>m³/s</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>CURAH HUJAN</small>
              <strong>{rainVal} <small>mm</small></strong>
            </div>
            <div className="portal-card metric-box">
              <small>ELEVASI TANAH</small>
              <strong>{currentVillage.elevation_index ? Number(currentVillage.elevation_index).toFixed(1) : '18'} <small>mdpl</small></strong>
            </div>
          </div>

          <div className="portal-card priority-list">
            <h4>Prioritas Risiko Tertinggi</h4>
            {sortedPriority.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#64748b', padding: '10px' }}>Memuat daftar risiko desa...</p>
            ) : (
              <ul>
                {sortedPriority.map((v) => (
                  <li 
                    key={v.id} 
                    onClick={() => setSelectedVillageName(v.name.replace(/^Desa\s+/i, ''))}
                    style={{ 
                      cursor: 'pointer', 
                      background: v.name.toLowerCase().includes(selectedVillageName.toLowerCase()) ? '#eff6ff' : 'transparent',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    <span>{v.name.replace(/^Desa\s+/i, '')}</span> 
                    <strong>{Math.round(v.probability)}% ({v.risk_level.toUpperCase()})</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
