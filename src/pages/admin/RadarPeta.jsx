import { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import RiskMap from '../../components/RiskMap'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'

export default function RadarPeta() {
  const { data } = useDashboardRealtime()
  const [selectedVillageName, setSelectedVillageName] = useState('Pucangarum')
  const [selectedVillageObj, setSelectedVillageObj] = useState(null)

  const rawVillages = data?.villages || []

  // Normalisasi dan pastikan 25 desa unik tanpa duplikasi
  const villagesMap = new Map()
  rawVillages.forEach(v => {
    const clean = (v.name || '').replace(/^Desa\s+/i, '').trim().toLowerCase()
    if (!villagesMap.has(clean)) {
      const prob = v.current_probability != null ? Number(v.current_probability) : Number(v.probability || 0)
      const risk = (v.current_risk_level || v.risk_level || (prob >= 76 ? 'awas' : (prob >= 51 ? 'tinggi' : (prob >= 25 ? 'sedang' : 'rendah')))).toLowerCase()
      villagesMap.set(clean, {
        ...v,
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        cleanName: clean,
        probability: prob,
        risk_level: risk
      })
    }
  })
  const villages = Array.from(villagesMap.values())
  const sortedPriority = [...villages].sort((a, b) => b.probability - a.probability).slice(0, 6)

  const cleanSelected = (selectedVillageName || '').replace(/^Desa\s+/i, '').trim().toLowerCase()
  const currentVillage = selectedVillageObj || villages.find(v => {
    const cName = (v.cleanName || v.name || '').replace(/^Desa\s+/i, '').trim().toLowerCase()
    return cName === cleanSelected || cName.includes(cleanSelected) || cleanSelected.includes(cName)
  }) || villages[0] || {
    name: 'Pucangarum',
    risk_level: 'sedang',
    probability: 32,
    elevation_index: 9
  }

  const dischargeVal = data?.discharge?.discharge_m3s 
    ? Math.round(data.discharge.discharge_m3s).toLocaleString('id-ID')
    : '1'

  const rainVal = data?.weather?.precipitation_mm ?? 0

  const handleSelectVillage = (villageObj) => {
    if (villageObj && villageObj.name) {
      const cName = villageObj.name.replace(/^Desa\s+/i, '').trim()
      setSelectedVillageName(cName)
      
      const foundInApi = villages.find(v => 
        (v.cleanName || v.name || '').toLowerCase() === cName.toLowerCase()
      )
      if (foundInApi) {
        setSelectedVillageObj(foundInApi)
      } else {
        setSelectedVillageObj({
          name: cName,
          probability: villageObj.prob ?? villageObj.probability ?? 0,
          risk_level: villageObj.status ?? villageObj.risk_level ?? 'rendah',
          elevation_index: villageObj.elevation_index ?? 18
        })
      }
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
        <div className="portal-card" style={{ 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          height: '620px'
        }}>
          {/* Framed Map Container */}
          <div style={{ 
            flex: 1, 
            width: '100%', 
            minHeight: '480px', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            border: '1.5px solid #cbd5e1',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.02)',
            position: 'relative' 
          }}>
            <RiskMap 
              onSelectVillage={handleSelectVillage} 
              selectedVillageName={selectedVillageName} 
              shelters={data?.shelters || []}
              villagesData={data?.villages || []}
              height="100%"
            />
          </div>

          {/* Separated Legend Bar below the map frame */}
          <div className="map-legend-bottom" style={{
            position: 'static',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '10px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '0.72rem',
            color: '#475569',
            margin: '0',
            boxShadow: 'none',
            flexShrink: 0
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="red-dot" /> Sangat Tinggi / Awas
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="orange-dot" /> Tinggi / Siaga
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="yellow-dot" /> Sedang / Waspada
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="green-dot" /> Rendah / Aman
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                {sortedPriority.map((v) => {
                  const isItemActive = cleanSelected === (v.cleanName || v.name || '').toLowerCase()
                  const itemRiskColor = v.risk_level === 'awas' 
                    ? '#dc2626' 
                    : (v.risk_level === 'tinggi' || v.risk_level === 'siaga' 
                        ? '#ea580c' 
                        : (v.risk_level === 'sedang' || v.risk_level === 'waspada' 
                            ? '#ca8a04' 
                            : '#059669'))
                  return (
                    <li 
                      key={v.id || v.cleanName} 
                      onClick={() => {
                        const c = v.name.replace(/^Desa\s+/i, '')
                        setSelectedVillageName(c)
                        setSelectedVillageObj(v)
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        background: isItemActive ? '#eff6ff' : 'transparent',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s'
                      }}
                    >
                      <span style={{ fontWeight: isItemActive ? 700 : 500 }}>
                        {v.name.replace(/^Desa\s+/i, '')}
                      </span> 
                      <strong style={{ color: itemRiskColor }}>
                        {Math.round(v.probability)}% ({v.risk_level.toUpperCase()})
                      </strong>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
