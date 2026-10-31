import { useState, useEffect, useMemo } from 'react'
import { getVillages } from '../../services/floodService'

export default function VillageStatsTable({ onSelectVillage }) {
  const [villages, setVillages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('all')
  const [sortBy, setSortBy] = useState('prob_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchVillagesData = () => {
    setLoading(true)
    getVillages()
      .then((data) => {
        if (Array.isArray(data)) {
          // Pastikan deduplikasi nama desa (tepat 25 desa unik Kecamatan Baureno)
          const unique = []
          const seen = new Set()
          for (const item of data) {
            const clean = (item.name || '').replace(/^Desa\s+/i, '').trim().toLowerCase()
            if (!seen.has(clean)) {
              seen.add(clean)
              unique.push({
                ...item,
                displayName: (item.name || '').replace(/^Desa\s+/i, '').trim()
              })
            }
          }
          setVillages(unique)
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

  // Reset page when filtering or searching
  useEffect(() => {
    setPage(1)
  }, [search, filterRisk, sortBy, pageSize])

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
        const matchesSearch = (v.displayName || v.name).toLowerCase().includes(search.toLowerCase())
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
        if (sortBy === 'name_asc') return (a.displayName || a.name).localeCompare(b.displayName || b.name)
        if (sortBy === 'elevation_asc') return Number(a.elevation_index || 0) - Number(b.elevation_index || 0)
        return 0
      })
  }, [villages, search, filterRisk, sortBy])

  // Pagination calculation
  const totalItems = filteredVillages.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedVillages = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredVillages.slice(start, start + pageSize)
  }, [filteredVillages, page, pageSize])

  const getRiskBadge = (level) => {
    const l = (level || 'aman').toLowerCase()
    if (l === 'awas' || l === 'sangat tinggi') {
      return <span className="risk-badge awas">● Awas</span>
    }
    if (l === 'siaga' || l === 'tinggi') {
      return <span className="risk-badge siaga">● Siaga</span>
    }
    if (l === 'waspada' || l === 'sedang') {
      return <span className="risk-badge waspada">● Waspada</span>
    }
    return <span className="risk-badge aman">● Aman</span>
  }

  const getProbColor = (prob) => {
    if (prob >= 75) return '#dc2626'
    if (prob >= 50) return '#ea580c'
    if (prob >= 25) return '#d97706'
    return '#059669'
  }

  const formatProb = (prob) => {
    const val = Number(prob || 0)
    return val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val)
  }

  return (
    <article className="village-stats-table-card">
      <style>{`
        .village-stats-table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
          overflow: hidden;
          margin-top: 24px;
          max-width: 100%;
        }
        .village-stats-header {
          padding: 18px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .village-filters-bar {
          padding: 12px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .village-table-container {
          width: 100%;
          overflow-x: auto;
          background: #ffffff;
        }
        .village-stats-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
          text-align: left;
          min-width: 820px;
        }
        .village-stats-table th {
          background: #f8fafc;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 16px;
          border-bottom: 1.5px solid #e2e8f0;
          white-space: nowrap;
        }
        .village-stats-table td {
          padding: 13px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: middle;
        }
        .village-stats-table tr:hover td {
          background-color: #f8fafc;
        }
        .risk-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 0.74rem;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }
        .risk-badge.awas {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .risk-badge.siaga {
          background: #fff7ed;
          color: #ea580c;
          border: 1px solid #ffedd5;
        }
        .risk-badge.waspada {
          background: #fefce8;
          color: #ca8a04;
          border: 1px solid #fef08a;
        }
        .risk-badge.aman {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }
        .prob-bar-track {
          background: #e2e8f0;
          height: 6px;
          border-radius: 99px;
          overflow: hidden;
          width: 85px;
        }
        .prob-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.3s ease;
        }
        .village-pagination-row {
          padding: 12px 20px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 0.8rem;
          color: #64748b;
        }
        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pagination-btn {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pagination-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        .pagination-btn.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }
        .pagination-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .radar-action-btn {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .radar-action-btn:hover {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
      `}</style>

      {/* Header */}
      <div className="village-stats-header">
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#0f172a' }}>
            <span>📊</span>
            <span>Statistik Risiko &amp; Banjir 25 Desa</span>
            <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid #dbeafe' }}>
              {villages.length} Desa Terdaftar
            </span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Kecamatan Baureno — Monitoring komputasi probabilitas genangan dan elevasi spasial
          </p>
        </div>

        <button 
          type="button" 
          onClick={fetchVillagesData}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Muat ulang data desa"
        >
          <span>↻</span> Segarkan
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="village-filters-bar">
        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '340px' }}>
          <input
            type="text"
            placeholder="Cari nama desa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              outline: 'none',
              background: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }}>
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
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
              padding: '4px 11px',
              borderRadius: '20px',
              fontSize: '0.74rem',
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
              padding: '4px 11px',
              borderRadius: '20px',
              fontSize: '0.74rem',
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
              padding: '4px 11px',
              borderRadius: '20px',
              fontSize: '0.74rem',
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
              padding: '4px 11px',
              borderRadius: '20px',
              fontSize: '0.74rem',
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
              padding: '4px 11px',
              borderRadius: '20px',
              fontSize: '0.74rem',
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
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.76rem',
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
      <div className="village-table-container">
        <table className="village-stats-table">
          <thead>
            <tr>
              <th style={{ width: '44px', textAlign: 'center' }}>#</th>
              <th style={{ minWidth: '160px' }}>Nama Desa</th>
              <th style={{ minWidth: '120px' }}>Tingkat Risiko</th>
              <th style={{ minWidth: '160px' }}>Probabilitas Banjir</th>
              <th style={{ minWidth: '95px' }}>Elevasi</th>
              <th style={{ minWidth: '100px' }}>Skor Historis</th>
              <th style={{ minWidth: '120px' }}>Kalkulasi Terakhir</th>
              <th style={{ minWidth: '100px', textAlign: 'right' }}>Aksi</th>
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
              paginatedVillages.map((village, idx) => {
                const rowIndex = (page - 1) * pageSize + idx + 1
                const prob = formatProb(village.current_probability)
                const probColor = getProbColor(prob)
                const lastCalc = village.last_calculated_at
                  ? new Date(village.last_calculated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                  : 'Realtime'

                return (
                  <tr key={village.id || village.displayName || idx}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#94a3b8' }}>
                      {rowIndex}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                        Desa {village.displayName || village.name.replace(/^Desa\s+/i, '')}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        {Number(village.latitude).toFixed(4)}, {Number(village.longitude).toFixed(4)}
                      </div>
                    </td>
                    <td>
                      {getRiskBadge(village.current_risk_level)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ minWidth: '36px', color: probColor, fontSize: '0.86rem' }}>
                          {prob}%
                        </strong>
                        <div className="prob-bar-track">
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
                      <span style={{ color: '#475569', fontWeight: 600 }}>
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
                        className="radar-action-btn"
                        onClick={() => {
                          if (onSelectVillage) {
                            onSelectVillage(village)
                          } else {
                            window.location.hash = '#radar'
                          }
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

      {/* Pagination Footer */}
      {!loading && totalItems > 0 && (
        <div className="village-pagination-row">
          <div>
            Menampilkan <strong>{Math.min(totalItems, (page - 1) * pageSize + 1)}</strong> - <strong>{Math.min(totalItems, page * pageSize)}</strong> dari <strong>{totalItems}</strong> desa
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem' }}>Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.75rem',
                  background: '#ffffff',
                  color: '#334155',
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Sebelumnya
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  className={`pagination-btn ${page === pNum ? 'active' : ''}`}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              ))}

              <button
                type="button"
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Selanjutnya ›
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
