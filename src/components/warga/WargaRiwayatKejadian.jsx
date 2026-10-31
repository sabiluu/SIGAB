import { useState, useEffect, useMemo } from 'react'
import { getFloodIncidents } from '../../services/floodService'

export default function WargaRiwayatKejadian() {
  const [filter, setFilter] = useState('semua')
  const [year, setYear] = useState('semua')
  const [search, setSearch] = useState('')
  const [allEvents, setAllEvents] = useState([])
  const [serverStats, setServerStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getFloodIncidents({ 
        category: filter !== 'semua' ? filter : undefined,
        year: year !== 'semua' ? year : undefined,
        page_size: 200
      })
      if (res) {
        setAllEvents(res.items || [])
        setServerStats(res.stats || null)
      }
    } catch (err) {
      console.warn('Gagal memuat arsip kejadian banjir:', err)
      setAllEvents([])
      setServerStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filter, year])

  // Pencarian instan: setiap huruf yang diketik langsung memfilter daftar (tanpa menunggu server)
  const events = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allEvents
    const terms = q.split(/\s+/).filter(Boolean)
    return allEvents.filter((evt) => {
      const haystack = [
        evt.title,
        evt.description,
        evt.desc,
        evt.village_name,
        evt.affected_villages,
        evt.category,
        evt.status,
        String(evt.event_date || evt.date || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [allEvents, search])

  // Kartu statistik ikut menyesuaikan hasil pencarian
  const stats = useMemo(() => {
    if (!search.trim()) return serverStats
    const tmaValues = events.map((e) => Number(e.water_level_m)).filter((n) => !isNaN(n) && n > 0)
    return {
      total_incidents: events.length,
      awas_count: events.filter((e) => (e.category || '').toLowerCase() === 'awas').length,
      total_evacuated: events.reduce((sum, e) => sum + (Number(e.evacuated_count) || 0), 0),
      max_tma_mdpl: tmaValues.length ? Math.max(...tmaValues) : null,
    }
  }, [events, search, serverStats])

  const getDotColor = (category) => {
    switch ((category || '').toLowerCase()) {
      case 'awas':
        return '#ef4444'
      case 'siaga':
        return '#ea580c'
      case 'waspada':
        return '#f59e0b'
      default:
        return '#10b981'
    }
  }

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const normalized = typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')
        ? dateStr.replace(' ', 'T')
        : dateStr
      const d = new Date(normalized)
      if (isNaN(d.getTime())) return dateStr
      const timeStr = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/\./g, ':')
      return (
        d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ' • ' +
        timeStr +
        ' WIB'
      )
    } catch {
      return dateStr
    }
  }

  return (
    <div className="warga-riwayat-page">
      <span className="riwayat-kicker-pill">RIWAYAT KEJADIAN</span>
      
      <div className="riwayat-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.85rem', fontWeight: 800, color: '#0f172a' }}>
            Arsip Kejadian Hidrometeorologi
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Rekam jejak kejadian banjir, elevasi muka air Bengawan Solo, dan data evakuasi warga di wilayah Kecamatan Baureno.
          </p>
        </div>

        {/* Filter Controls (Search, Year, Status) */}
        <div className="riwayat-filter-controls-row">
          {/* Quick Search */}
          <div className="riwayat-search-box-wrap">
            <input
              type="text"
              placeholder="Cari desa / kata kunci..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="riwayat-search-input"
            />
            <span className="riwayat-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Hapus pencarian"
                className="riwayat-search-clear"
              >
                ✕
              </button>
            )}
          </div>

          <div className="riwayat-filter-segmented-scroll">
            {/* Filter Tahun */}
            <div className="riwayat-filter-segmented">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', padding: '0 6px' }}>
                Tahun:
              </span>
              {['semua', '2026', '2025', '2024', '2023'].map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`riwayat-filter-pill-btn ${year === y ? 'active' : ''}`}
                  onClick={() => setYear(y)}
                >
                  {y === 'semua' ? 'Semua' : y}
                </button>
              ))}
            </div>

            {/* Filter Kategori */}
            <div className="riwayat-filter-segmented">
              <button
                type="button"
                className={`riwayat-filter-pill-btn ${filter === 'semua' ? 'active' : ''}`}
                onClick={() => setFilter('semua')}
              >
                Semua Status
              </button>
              <button
                type="button"
                className={`riwayat-filter-pill-btn ${filter === 'awas' ? 'active' : ''}`}
                onClick={() => setFilter('awas')}
              >
                Awas
              </button>
              <button
                type="button"
                className={`riwayat-filter-pill-btn ${filter === 'siaga' ? 'active' : ''}`}
                onClick={() => setFilter('siaga')}
              >
                Siaga
              </button>
              <button
                type="button"
                className={`riwayat-filter-pill-btn ${filter === 'waspada' ? 'active' : ''}`}
                onClick={() => setFilter('waspada')}
              >
                Waspada
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards in a row */}
      <div className="riwayat-stats-grid">
        <div className="riwayat-stat-card">
          <span className="riwayat-stat-label">TOTAL KEJADIAN</span>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num">
              {stats?.total_incidents != null ? stats.total_incidents : (loading ? '-' : 0)}
            </span>
            <span className="riwayat-stat-unit">tercatat</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <span className="riwayat-stat-label">STATUS AWAS</span>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#ef4444' }}>
              {stats?.awas_count != null ? stats.awas_count : (loading ? '-' : 0)}
            </span>
            <span className="riwayat-stat-unit">kali</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <span className="riwayat-stat-label">TOTAL DIEVAKUASI</span>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#009aa6' }}>
              {stats?.total_evacuated != null
                ? Number(stats.total_evacuated).toLocaleString('id-ID')
                : (loading ? '-' : 0)}
            </span>
            <span className="riwayat-stat-unit">orang</span>
          </div>
        </div>

        <div className="riwayat-stat-card">
          <span className="riwayat-stat-label">TMA TERTINGGI</span>
          <div className="riwayat-stat-val-wrap">
            <span className="riwayat-stat-num" style={{ color: '#f59e0b' }}>
              {stats?.max_tma_mdpl != null ? `${stats.max_tma_mdpl}` : (loading ? '-' : '-')}
            </span>
            <span className="riwayat-stat-unit">mdpl</span>
          </div>
        </div>
      </div>

      {/* Timeline Event List */}
      <div className="riwayat-timeline-wrap">
        {loading ? (
          <div className="riwayat-empty-state">
            <p>Memuat rekam jejak kejadian hidrometeorologi...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="riwayat-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>{search.trim() ? 'Pencarian Tidak Ditemukan' : 'Belum Ada Riwayat Kejadian'}</h3>
            <p>
              {search.trim()
                ? `Tidak ada kejadian yang cocok dengan "${search.trim()}". Coba kata kunci lain.`
                : filter === 'semua'
                  ? 'Belum ada data rekaman kejadian hidrometeorologi tersimpan di sistem.'
                  : `Tidak ada rekaman kejadian dengan filter status "${filter.toUpperCase()}".`}
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const tmaVal = evt.water_level_m != null ? `${evt.water_level_m} mdpl` : (evt.tma || null)
            const rainVal = evt.rainfall_mm != null ? `${evt.rainfall_mm} mm` : (evt.rainfall || null)
            const evacVal = evt.evacuated_count != null && evt.evacuated_count > 0 ? `${evt.evacuated_count} jiwa` : (evt.evacuation || null)
            const affectedPeople = evt.affected_people_count != null && evt.affected_people_count > 0 ? `${evt.affected_people_count} jiwa` : null
            const shelters = evt.shelter_count != null && evt.shelter_count > 0 ? `${evt.shelter_count} posko` : null

            return (
              <div key={evt.id} className="riwayat-event-card">
                <span 
                  className="riwayat-event-dot" 
                  style={{ backgroundColor: getDotColor(evt.category) }} 
                />
                <div className="riwayat-event-inner-card">
                  <div className="riwayat-event-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: getDotColor(evt.category) + '15',
                          color: getDotColor(evt.category),
                          border: `1px solid ${getDotColor(evt.category)}40`
                        }}>
                          {evt.category || 'WASPADA'}
                        </span>
                        {evt.village_name && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#0369a1',
                            background: '#e0f2fe',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            ðŸ“ {evt.village_name}
                          </span>
                        )}
                      </div>
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{evt.title}</strong>
                    </div>

                    <span className="riwayat-event-time">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatEventDate(evt.event_date || evt.date)}
                    </span>
                  </div>

                  <p className="riwayat-event-desc" style={{ marginTop: '8px', lineHeight: '1.5' }}>
                    {evt.description || evt.desc || '-'}
                  </p>
                  
                  <div className="riwayat-event-chips-row" style={{ marginTop: '12px' }}>
                    {tmaVal && (
                      <span className="riwayat-mini-chip">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2.5">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        TMA {tmaVal}
                      </span>
                    )}
                    {rainVal && (
                      <span className="riwayat-mini-chip">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5">
                          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                        </svg>
                        Hujan {rainVal}
                      </span>
                    )}
                    {evacVal && (
                      <span className="riwayat-mini-chip" style={{ background: '#fef2f2', borderColor: '#fecdd3', color: '#b91c1c' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Dievakuasi {evacVal}
                      </span>
                    )}
                    {affectedPeople && (
                      <span className="riwayat-mini-chip">
                        ðŸ‘¥ Terdampak: {affectedPeople}
                      </span>
                    )}
                    {shelters && (
                      <span className="riwayat-mini-chip">
                        â›º {shelters}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
