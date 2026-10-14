import { useState, useEffect, useMemo } from 'react'
import { getVillages } from '../../services/floodService'

export default function VillageStatsTable({ onSelectVillage }) {
  const [villages, setVillages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('all')
  const [sortBy, setSortBy] = useState('prob_desc')

  const fetchVillagesData = () => {
    setLoading(true)
    getVillages()
      .then((data) => {
        if (Array.isArray(data)) {
          setVillages(data)
        }
      })
      .catch((err) => {
        console.error('Error fetching villages stats:', err)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchVillagesData()
  }, [])

  // Risk counts summary
  const counts = useMemo(() => {
    const res = { all: villages.length, awas: 0, siaga: 0, waspada: 0, aman: 0 }
    villages.forEach((v) => {
      const r = (v.current_risk_level || 'aman').toLowerCase()
      if (r === 'awas' || r === 'sangat tinggi') res.awas++
      else if (r === 'siaga' || r === 'tinggi') res.siaga++
      else if (r === 'waspada' || r === 'sedang') res.waspada++
      else res.aman++
    })
    return res
  }, [villages])

  // Filter & sort
  const filteredVillages = useMemo(() => {
    return villages
      .filter((v) => {
        const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase())
        if (!matchesSearch) return false

        const r = (v.current_risk_level || 'aman').toLowerCase()
        if (filterRisk === 'all') return true
        if (filterRisk === 'awas') return r === 'awas' || r === 'sangat tinggi'
        if (filterRisk === 'siaga') return r === 'siaga' || r === 'tinggi'
        if (filterRisk === 'waspada') return r === 'waspada' || r === 'sedang'
        if (filterRisk === 'aman') return r === 'aman' || r === 'rendah'
        return true
      })
      .sort((a, b) => {
        const probA = Number(a.current_probability || 0)
        const probB = Number(b.current_probability || 0)
        if (sortBy === 'prob_desc') return probB - probA
        if (sortBy === 'prob_asc') return probA - probB
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'elevation_asc') return Number(a.elevation_index || 0) - Number(b.elevation_index || 0)
        return 0
      })
  }, [villages, search, filterRisk, sortBy])

  const getRiskPillClass = (level) => {
    const l = (level || 'aman').toLowerCase()
    if (l === 'awas' || l === 'sangat tinggi') return 'risk-pill awas'
    if (l === 'siaga' || l === 'tinggi') return 'risk-pill tinggi'
    if (l === 'waspada' || l === 'sedang') return 'risk-pill sedang'
    return 'risk-pill aman'
  }

  const getProbColor = (prob) => {
    if (prob >= 75) return '#ef4444'
    if (prob >= 50) return '#f97316'
    if (prob >= 25) return '#eab308'
    return '#10b981'
  }

  const formatProb = (prob) => {
    const val = Number(prob || 0)
    // If value is between 0 and 1, convert to percentage
    return val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val)
  }

  return (
    <article className="village-stats-table-card portal-card" style={{ marginTop: '24px' }}>
      <div className="village-stats-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span>
            <span>Statistik Risiko &amp; Banjir 25 Desa</span>
            <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {villages.length} Desa Terdaftar
            </span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Kecamatan Baureno — Monitoring komputasi probabilitas genangan dan elevasi spasial
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            onClick={fetchVillagesData}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Muat ulang data desa"
          >
            <span>↻</span> Segarkan
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '360px' }}>
          <input
            type="text"
            placeholder="Cari nama desa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              background: '#ffffff'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.9rem' }}>
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setFilterRisk('all')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterRisk === 'all' ? '#0f172a' : '#e2e8f0',
              color: filterRisk === 'all' ? '#ffffff' : '#475569'
            }}
          >
            Semua ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('awas')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterRisk === 'awas' ? '#dc2626' : '#fee2e2',
              color: filterRisk === 'awas' ? '#ffffff' : '#991b1b'
            }}
          >
            Awas ({counts.awas})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('siaga')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterRisk === 'siaga' ? '#ea580c' : '#ffedd5',
              color: filterRisk === 'siaga' ? '#ffffff' : '#9a3412'
            }}
          >
            Siaga ({counts.siaga})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('waspada')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterRisk === 'waspada' ? '#ca8a04' : '#fef3c7',
              color: filterRisk === 'waspada' ? '#ffffff' : '#92400e'
            }}
          >
            Waspada ({counts.waspada})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('aman')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterRisk === 'aman' ? '#16a34a' : '#dcfce7',
              color: filterRisk === 'aman' ? '#ffffff' : '#166534'
            }}
          >
            Aman ({counts.aman})
          </button>
        </div>

        {/* Sort Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.78rem',
              background: '#ffffff',
              color: '#334155',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="prob_desc">Risiko Tertinggi</option>
            <option value="prob_asc">Risiko Terendah</option>
            <option value="name_asc">Nama Desa (A-Z)</option>
            <option value="elevation_asc">Elevasi Terendah</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table className="village-stats-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
              <th>Nama Desa</th>
              <th>Tingkat Risiko</th>
              <th>Probabilitas Banjir</th>
              <th>Elevasi</th>
              <th>Skor Historis</th>
              <th>Kalkulasi Terakhir</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>⏳</div>
                  Memuat data statistik 25 desa...
                </td>
              </tr>
            ) : filteredVillages.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>🔍</div>
                  Tidak ada desa yang cocok dengan pencarian atau filter "{filterRisk}".
                </td>
              </tr>
            ) : (
              filteredVillages.map((village, idx) => {
                const prob = formatProb(village.current_probability)
                const probColor = getProbColor(prob)
                const lastCalc = village.last_calculated_at
                  ? new Date(village.last_calculated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                  : 'Realtime'

                return (
                  <tr key={village.id || idx}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#94a3b8' }}>
                      {idx + 1}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                        Desa {village.name.replace(/^Desa\s+/i, '')}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {Number(village.latitude).toFixed(4)}, {Number(village.longitude).toFixed(4)}
                      </div>
                    </td>
                    <td>
                      <span className={getRiskPillClass(village.current_risk_level)}>
                        ● {village.current_risk_level || 'Aman'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ minWidth: '38px', color: probColor }}>
                          {prob}%
                        </strong>
                        <div className="prob-bar-track" style={{ width: '90px' }}>
                          <div 
                            className="prob-bar-fill" 
                            style={{ 
                              width: `${Math.min(100, Math.max(5, prob))}%`, 
                              background: probColor 
                            }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {village.elevation_index ? Number(village.elevation_index).toFixed(1) : '18.0'}
                      </span>{' '}
                      <small style={{ color: '#64748b' }}>mdpl</small>
                    </td>
                    <td>
                      <span style={{ color: '#475569', fontWeight: 500 }}>
                        {village.history_score ? Number(village.history_score).toFixed(2) : '0.50'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {lastCalc}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectVillage) {
                            onSelectVillage(village)
                          } else {
                            window.location.hash = '#radar'
                          }
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2563eb'
                          e.currentTarget.style.color = '#ffffff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#eff6ff'
                          e.currentTarget.style.color = '#1d4ed8'
                        }}
                      >
                        Buka Radar ↗
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
