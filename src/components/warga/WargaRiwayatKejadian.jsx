import { useState, useEffect, useMemo } from 'react'
import { getFloodIncidents, syncSatuData, getSatuDataStatus } from '../../services/floodService'

export default function WargaRiwayatKejadian() {
  const [filter, setFilter] = useState('semua')
  const [year, setYear] = useState('semua')
  const [search, setSearch] = useState('')
  const [allEvents, setAllEvents] = useState([])
  const [serverStats, setServerStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState(null)
  const [portalStatus, setPortalStatus] = useState(null)

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

  // Cek konektivitas API Satu Data Bojonegoro saat pertama kali komponen dimuat
  useEffect(() => {
    getSatuDataStatus()
      .then((status) => {
        if (status) setPortalStatus(status)
      })
      .catch((e) => {
        console.warn('Gagal memverifikasi koneksi Satu Data Bojonegoro:', e)
        setPortalStatus({ reachable: false, error: 'Koneksi lokal aktif' })
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [filter, year])

  // Aksi sinkronisasi langsung dengan portal Satu Data Bojonegoro
  const handleSyncSatuData = async () => {
    setSyncing(true)
    setSyncFeedback(null)
    try {
      const res = await syncSatuData()
      if (res && res.success) {
        setSyncFeedback({
          type: 'success',
          text: res.message || 'Sinkronisasi Satu Data Bojonegoro berhasil! Data riwayat kejadian telah diperbarui.',
        })
        await fetchData()
      } else {
        setSyncFeedback({
          type: 'error',
          text: res?.message || 'Gagal sinkronisasi data dari portal Satu Data.',
        })
      }
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        text: 'Terjadi kendala saat menghubungkan ke Satu Data Bojonegoro: ' + (err.message || 'Koneksi gagal'),
      })
    } finally {
      setSyncing(false)
      setTimeout(() => {
        setSyncFeedback(null)
      }, 7000)
    }
  }

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
      
      <div className="riwayat-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.85rem', fontWeight: 800, color: '#0f172a' }}>
            Arsip Kejadian Hidrometeorologi
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Rekam jejak kejadian banjir resmi BPBD Kabupaten Bojonegoro untuk seluruh desa di wilayah Kecamatan Baureno.
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

      {/* Satu Data Bojonegoro Integration Card */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1.5px solid #a7f3d0',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 340px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#10b981',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
          }}>
            🏛️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.98rem', color: '#065f46' }}>
                Terhubung ke API Satu Data Bojonegoro
              </strong>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: portalStatus?.reachable ? '#047857' : '#b45309',
                background: portalStatus?.reachable ? '#d1fae5' : '#fef3c7',
                border: `1px solid ${portalStatus?.reachable ? '#6ee7b7' : '#fde68a'}`,
                padding: '2px 8px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: portalStatus?.reachable ? '#10b981' : '#f59e0b'
                }} />
                {portalStatus?.reachable ? 'Online (Real-time)' : 'Tersinkronisasi Lokal'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#047857', lineHeight: '1.4' }}>
              Filter: <b>Kecamatan Baureno</b> (Seluruh Desa) • Jenis Bencana: <b>Banjir Bengawan Solo (Luapan Sungai)</b> &amp; <b>Banjir Luapan Sungai / Genangan</b> • Semua Tahun
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="https://data.bojonegorokab.go.id/badan-penanggulangan-bencana.html@detail=kejadian-bencana"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#ffffff',
              border: '1.5px solid #d1fae5',
              borderRadius: '10px',
              color: '#065f46',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            title="Buka portal Satu Data Bojonegoro resmi"
          >
            <span>Buka Portal Resmi</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button
            type="button"
            onClick={handleSyncSatuData}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: syncing ? '#94a3b8' : '#047857',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: syncing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
              transition: 'background 0.2s'
            }}
          >
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s infinite linear' }}>
              🔄
            </span>
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 18px',
            borderRadius: '12px',
            background: syncFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
            border: `1.5px solid ${syncFeedback.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
            color: syncFeedback.type === 'error' ? '#991b1b' : '#065f46',
            fontSize: '0.86rem',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}
        >
          <span>{syncFeedback.text}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

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
                            📍 {evt.village_name}
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
                        👥 Terdampak: {affectedPeople}
                      </span>
                    )}
                    {shelters && (
                      <span className="riwayat-mini-chip">
                        ⛺ {shelters}
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
