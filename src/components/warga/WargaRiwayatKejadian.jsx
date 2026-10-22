import { useState, useEffect } from 'react'
import { getFloodIncidents } from '../../services/floodService'

export default function WargaRiwayatKejadian() {
  const [filter, setFilter] = useState('semua')
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await getFloodIncidents({ category: filter })
        if (isMounted && res) {
          setEvents(res.items || [])
          setStats(res.stats || null)
        }
      } catch (err) {
        console.warn('Gagal memuat arsip kejadian banjir:', err)
        if (isMounted) {
          setEvents([])
          setStats(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [filter])

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
      
      <div className="riwayat-header-row">
        <div>
          <h1>Arsip Kejadian Hidrometeorologi</h1>
          <p>Rekam jejak status siaga, data hidrologi, dan jumlah evakuasi di wilayah Baureno.</p>
        </div>

        {/* Filter Segmented Control */}
        <div className="riwayat-filter-segmented">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2.2"
            style={{ marginLeft: 6, marginRight: 2 }}
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <button
            type="button"
            className={`riwayat-filter-pill-btn ${filter === 'semua' ? 'active' : ''}`}
            onClick={() => setFilter('semua')}
          >
            Semua
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
          <button
            type="button"
            className={`riwayat-filter-pill-btn ${filter === 'aman' ? 'active' : ''}`}
            onClick={() => setFilter('aman')}
          >
            Aman
          </button>
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
              {stats?.max_tma_mdpl != null ? stats.max_tma_mdpl : (loading ? '-' : '-')}
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
            <h3>Belum Ada Riwayat Kejadian</h3>
            <p>
              {filter === 'semua'
                ? 'Belum ada data rekaman kejadian hidrometeorologi tersimpan di sistem.'
                : `Tidak ada rekaman kejadian dengan status "${filter.toUpperCase()}".`}
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const tmaVal = evt.water_level_m != null ? `${evt.water_level_m} mdpl` : (evt.tma || null)
            const rainVal = evt.rainfall_mm != null ? `${evt.rainfall_mm} mm` : (evt.rainfall || null)
            const evacVal = evt.evacuated_count != null && evt.evacuated_count > 0 ? `${evt.evacuated_count} org` : (evt.evacuation || null)

            return (
              <div key={evt.id} className="riwayat-event-card">
                <span 
                  className="riwayat-event-dot" 
                  style={{ backgroundColor: getDotColor(evt.category) }} 
                />
                <div className="riwayat-event-inner-card">
                  <div className="riwayat-event-header">
                    <strong>{evt.title}</strong>
                    <span className="riwayat-event-time">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatEventDate(evt.event_date || evt.date)}
                    </span>
                  </div>
                  <p className="riwayat-event-desc">{evt.description || evt.desc || '-'}</p>
                  
                  {(tmaVal || rainVal || evacVal) && (
                    <div className="riwayat-event-chips-row">
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
                        <span className="riwayat-mini-chip">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Evakuasi {evacVal}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

