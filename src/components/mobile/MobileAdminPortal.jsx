import { useState, useEffect, useMemo } from 'react'
import { logout } from '../../services/authService'
import { getSOSTickets, updateSOSStatus, createSOSTicket } from '../../services/sosService'
import { getShelters, updateShelterCapacity, createShelter } from '../../services/shelterService'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import RiskMap from '../../components/RiskMap'
import LogoutModal from '../../components/common/LogoutModal'
import '../../styles/mobile.css'

export default function MobileAdminView({ initialTab = 'dashboard' }) {
  const [activeTab, setActiveTab] = useState(initialTab) // 'dashboard' | 'sos' | 'radar' | 'posko'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Sync with URL hash if user navigates via #sos, #radar, #posko
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setDrawerOpen(false)
    const hashMap = {
      dashboard: '#petugas',
      sos: '#sos',
      radar: '#radar',
      posko: '#posko',
    }
    if (hashMap[tab]) {
      window.history.replaceState(null, '', hashMap[tab])
    }
  }

  // Real-time data
  const { data: realtimeData } = useDashboardRealtime()
  const [tickets, setTickets] = useState([])
  const [shelters, setShelters] = useState([])
  const [sosFilter, setSosFilter] = useState('all')
  const [sosSearch, setSosSearch] = useState('')
  const [selectedVillageName, setSelectedVillageName] = useState('Baureno')

  // Add Posko modal state
  const [showAddPoskoModal, setShowAddPoskoModal] = useState(false)
  const [newPosko, setNewPosko] = useState({
    name: '',
    address: '',
    village_id: 3,
    capacity_total: 200,
    capacity_occupied: 0,
    contact_person: 'Petugas BPBD',
    contact_phone: '08111222333',
  })

  const fetchAllAdminData = async () => {
    try {
      const [tData, sData] = await Promise.all([getSOSTickets(), getShelters()])
      if (Array.isArray(tData)) setTickets(tData)
      if (Array.isArray(sData)) setShelters(sData)
    } catch (_) {}
  }

  useEffect(() => {
    fetchAllAdminData()
    const timer = setInterval(fetchAllAdminData, 10000)
    return () => clearInterval(timer)
  }, [])

  const villages = useMemo(() => {
    const raw = realtimeData?.villages || []
    const seen = new Map()
    raw.forEach((v) => {
      const cleanName = (v.name || 'Baureno').replace(/^Desa\s+/i, '').trim()
      const key = cleanName.toLowerCase()
      if (!seen.has(key)) {
        const prob = Number(v.current_probability ?? v.probability ?? 18.0)
        seen.set(key, {
          ...v,
          cleanName,
          probability: prob,
          risk_level: prob >= 76 ? 'awas' : prob >= 51 ? 'siaga' : prob >= 25 ? 'waspada' : 'aman',
        })
      }
    })
    return Array.from(seen.values()).sort((a, b) => b.probability - a.probability)
  }, [realtimeData])

  const activeTickets = useMemo(
    () => tickets.filter((t) => t.status !== 'completed' && t.status !== 'rejected'),
    [tickets]
  )

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (sosFilter === 'active') return t.status !== 'completed' && t.status !== 'rejected'
        if (sosFilter !== 'all') return t.status === sosFilter
        return true
      })
      .filter((t) => {
        if (!sosSearch.trim()) return true
        const q = sosSearch.toLowerCase()
        return (
          (t.ticket_number || '').toLowerCase().includes(q) ||
          (t.name || t.reporter_name || '').toLowerCase().includes(q) ||
          (t.gps_address || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0))
  }, [tickets, sosFilter, sosSearch])

  const handleUpdateTicketStatus = async (ticketId, nextStatus, unit = null) => {
    try {
      const payload = { status: nextStatus }
      if (unit) payload.assigned_unit = unit
      await updateSOSStatus(ticketId, payload)
      fetchAllAdminData()
    } catch (err) {
      alert('Gagal mengubah status tiket: ' + (err.message || err))
    }
  }

  const handleSimulateSOSTicket = async () => {
    try {
      await createSOSTicket({
        name: 'Warga Simulasi Darurat',
        phone: '081299887766',
        village_id: 3,
        gps_latitude: -7.1211,
        gps_longitude: 112.1027,
        gps_address: 'Desa Kauman, Kec. Baureno',
        patokan: 'Dekat Tanggul Bengawan Solo RT 03',
        family_count: 4,
        has_elderly: true,
        has_toddler: true,
        has_pregnant: false,
        has_disability: false,
      })
      fetchAllAdminData()
      switchTab('sos')
    } catch (err) {
      alert('Gagal membuat tiket simulasi: ' + (err.message || err))
    }
  }

  const handleAdjustPoskoCapacity = async (posko, delta) => {
    const current = Number(posko.capacity_occupied || 0)
    const max = Number(posko.capacity_total || 200)
    const next = Math.max(0, Math.min(max, current + delta))
    setShelters((prev) => prev.map((p) => (p.id === posko.id ? { ...p, capacity_occupied: next } : p)))
    try {
      await updateShelterCapacity(posko.id, next)
      fetchAllAdminData()
    } catch (_) {}
  }

  const handleAddPoskoSubmit = async (e) => {
    e.preventDefault()
    try {
      await createShelter({
        name: newPosko.name.trim(),
        address: newPosko.address.trim(),
        village_id: Number(newPosko.village_id || 3),
        latitude: -7.129,
        longitude: 112.105,
        capacity_total: Number(newPosko.capacity_total || 200),
        capacity_occupied: Number(newPosko.capacity_occupied || 0),
        contact_person: newPosko.contact_person.trim() || 'Petugas BPBD',
        contact_phone: newPosko.contact_phone.trim() || '08111222333',
      })
      setShowAddPoskoModal(false)
      setNewPosko({
        name: '',
        address: '',
        village_id: 3,
        capacity_total: 200,
        capacity_occupied: 0,
        contact_person: 'Petugas BPBD',
        contact_phone: '08111222333',
      })
      fetchAllAdminData()
    } catch (err) {
      alert('Gagal menambah posko: ' + (err.message || err))
    }
  }

  const statusIndoMap = {
    submitted: { label: 'Menunggu Verifikasi', bg: '#fee2e2', color: '#dc2626' },
    verified: { label: 'Terverifikasi', bg: '#fef3c7', color: '#d97706' },
    dispatched: { label: 'Tim Meluncur', bg: '#ffedd5', color: '#ea580c' },
    arrived: { label: 'Tim Tiba di Lokasi', bg: '#dbeafe', color: '#2563eb' },
    completed: { label: 'Selesai Dievakuasi', bg: '#d1fae5', color: '#059669' },
  }

  const waspadaCount = villages.filter((v) => v.probability >= 25).length
  const totalRefugees = shelters.reduce((acc, s) => acc + Number(s.capacity_occupied || 0), 0)

  return (
    <div className="sigab-mobile-root" style={{ paddingBottom: '78px' }}>
      {/* 1. STICKY DARK ADMIN HEADER */}
      <header className="m-top-header dark">
        <div className="m-brand" onClick={() => switchTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="m-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="m-brand-text">
            <span className="m-brand-title">SIGAB Pusdalops</span>
            <span className="m-brand-sub">Komando BPBD Kec. Baureno</span>
          </div>
        </div>

        <div className="m-header-actions">
          <span
            style={{
              background: activeTickets.length > 0 ? '#dc2626' : '#10b981',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '4px 9px',
              borderRadius: '999px',
            }}
          >
            {activeTickets.length} SOS Aktif
          </span>
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu Admin"
          >
            ☰
          </button>
        </div>
      </header>

      {/* SLIDE-OUT ADMIN DRAWER */}
      {drawerOpen && (
        <div className="m-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="m-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid #edf2f7' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Petugas Pusdalops BPBD</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Kecamatan Baureno • Siaga 24/7</div>
              </div>
              <button type="button" className="m-icon-btn" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            <button type="button" className={`m-drawer-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => switchTab('dashboard')}>
              <span>📊</span> Ringkasan Komando
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'sos' ? 'active' : ''}`} onClick={() => switchTab('sos')}>
              <span>🚨</span> Manajemen Tiket SOS ({activeTickets.length})
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => switchTab('radar')}>
              <span>🗺️</span> Radar Peta 25 Desa
            </button>
            <button type="button" className={`m-drawer-link ${activeTab === 'posko' ? 'active' : ''}`} onClick={() => switchTab('posko')}>
              <span>🏕️</span> Manajemen Posko ({shelters.length})
            </button>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #edf2f7' }}>
              <button
                type="button"
                className="m-btn m-btn-danger"
                onClick={() => {
                  setDrawerOpen(false)
                  setShowLogoutModal(true)
                }}
              >
                Keluar Portal Petugas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT BODY */}
      <main style={{ padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ==============================================================
            TAB 1: RINGKASAN DASHBOARD KOMANDO
           ============================================================== */}
        {activeTab === 'dashboard' && (
          <>
            {/* 2x2 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="m-card" style={{ padding: '14px', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Tiket SOS Aktif</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#dc2626', marginTop: '4px' }}>
                  {activeTickets.length} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>antrean</span>
                </div>
              </div>
              <div className="m-card" style={{ padding: '14px', borderLeft: '4px solid #d97706' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Desa Waspada/Siaga</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
                  {waspadaCount} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 25 desa</span>
                </div>
              </div>
              <div className="m-card" style={{ padding: '14px', borderLeft: '4px solid #009aa6' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Total Pengungsi</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0c1a24', marginTop: '4px' }}>
                  {totalRefugees} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>jiwa</span>
                </div>
              </div>
              <div className="m-card" style={{ padding: '14px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Posko Beroperasi</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
                  {shelters.length} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>posko</span>
                </div>
              </div>
            </div>

            {/* Antrian Prioritas SOS */}
            <section className="m-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800 }}>🔴 Antrean SOS Prioritas</h3>
                <button
                  type="button"
                  onClick={handleSimulateSOSTicket}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ + Tiket Simulasi
                </button>
              </div>

              {activeTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px 0', fontSize: '0.8rem', color: '#64748b' }}>
                  🛡️ Tidak ada tiket SOS darurat yang menunggu.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTickets.slice(0, 3).map((t) => (
                    <div key={t.id} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #fecaca', background: '#fff5f5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.84rem', color: '#991b1b' }}>{t.ticket_number || `SOS-${t.id}`}</strong>
                        <span className="m-badge awas">⚡ Skor {t.priority_score || 50}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c1a24' }}>
                        {t.name || t.reporter_name || 'Warga Baureno'} ({t.family_count || 1} jiwa)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#475569', margin: '3px 0 10px' }}>
                        📍 {t.gps_address}
                      </div>
                      <button
                        type="button"
                        className="m-btn m-btn-navy"
                        style={{ minHeight: '38px', padding: '8px 12px', fontSize: '0.76rem' }}
                        onClick={() => switchTab('sos')}
                      >
                        Tindak Lanjuti di Panel SOS →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Peta Ringkas & 5 Desa Risiko Tertinggi */}
            <section className="m-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800 }}>Desa Risiko Tertinggi</h3>
                <button
                  type="button"
                  onClick={() => switchTab('radar')}
                  style={{ background: 'none', border: 'none', color: '#009aa6', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Buka Radar Peta →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {villages.slice(0, 5).map((v) => (
                  <div key={v.id} style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Desa {v.cleanName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Probabilitas Banjir {Number(v.probability).toFixed(1)}%</div>
                    </div>
                    <span className={`m-badge ${v.risk_level}`}>{v.risk_level.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 2: MANAJEMEN TIKET SOS (MOBILE CARDS — NO OVERFLOW TABLE!)
           ============================================================== */}
        {activeTab === 'sos' && (
          <>
            <section className="m-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Manajemen Tiket SOS Warga</h2>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Diurutkan otomatis berdasarkan Skor Prioritas Kerentanan</div>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateSOSTicket}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  + Simulasi
                </button>
              </div>

              {/* Search & Filter Pills */}
              <input
                type="text"
                placeholder="Cari nomor tiket, nama warga, atau desa..."
                value={sosSearch}
                onChange={(e) => setSosSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid #dce5eb',
                  fontSize: '0.8rem',
                  marginBottom: '10px',
                }}
              />

              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {[
                  { id: 'all', label: `Semua (${tickets.length})` },
                  { id: 'active', label: `Aktif (${activeTickets.length})` },
                  { id: 'submitted', label: 'Menunggu' },
                  { id: 'verified', label: 'Terverifikasi' },
                  { id: 'dispatched', label: 'Meluncur' },
                  { id: 'completed', label: 'Selesai' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSosFilter(f.id)}
                    style={{
                      background: sosFilter === f.id ? '#0c1a24' : '#f1f5f9',
                      color: sosFilter === f.id ? '#ffffff' : '#475569',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Mobile SOS Ticket Cards (Cleanly Stacked, Touch-Friendly Buttons) */}
            {filteredTickets.length === 0 ? (
              <div className="m-card" style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b', fontSize: '0.84rem' }}>
                Tidak ada tiket SOS pada kategori ini.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const st = statusIndoMap[t.status] || statusIndoMap.submitted
                const rentanList = []
                if (t.has_elderly) rentanList.push('Lansia')
                if (t.has_toddler) rentanList.push('Balita')
                if (t.has_pregnant) rentanList.push('Ibu Hamil')
                if (t.has_disability) rentanList.push('Difabel')

                return (
                  <article key={t.id} className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Top Row: Ticket ID, Status Pill, Priority Score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0c1a24' }}>
                          {t.ticket_number || `SOS-${t.id}`}
                        </strong>
                        <span
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          ⚡ Skor {t.priority_score || 50}
                        </span>
                      </div>

                      <span
                        style={{
                          background: st.bg,
                          color: st.color,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '999px',
                        }}
                      >
                        {st.label}
                      </span>
                    </div>

                    {/* Reporter & Location Info */}
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 800, color: '#0c1a24', fontSize: '0.84rem' }}>
                        👤 {t.name || t.reporter_name || 'Warga Baureno'} • 📞 {t.phone || t.reporter_phone || '-'}
                      </div>
                      <div style={{ color: '#334155', marginTop: '2px' }}>
                        📍 {t.gps_address || 'Kec. Baureno'} {t.patokan ? `(${t.patokan})` : ''}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        <span style={{ background: '#e2e8f0', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                          👥 {t.family_count || 1} Jiwa
                        </span>
                        {rentanList.length > 0 && (
                          <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                            ⚠️ Rentan: {rentanList.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons (Full Width Grid — Never Squished!) */}
                    {t.status !== 'completed' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {t.status === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateTicketStatus(t.id, 'verified')}
                            style={{
                              gridColumn: '1 / -1',
                              minHeight: '42px',
                              borderRadius: '10px',
                              border: 'none',
                              background: '#d97706',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            ✓ Verifikasi Laporan SOS
                          </button>
                        )}

                        {(t.status === 'submitted' || t.status === 'verified') && (
                          <button
                            type="button"
                            onClick={() => handleUpdateTicketStatus(t.id, 'dispatched', 'Tim Perahu Karet 01')}
                            style={{
                              gridColumn: '1 / -1',
                              minHeight: '42px',
                              borderRadius: '10px',
                              border: 'none',
                              background: '#ea580c',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            🚤 Kirim Tim Evakuasi (Meluncur)
                          </button>
                        )}

                        {t.status === 'dispatched' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(t.id, 'arrived')}
                              style={{
                                minHeight: '42px',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                            >
                              ⚓ Tim Tiba
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(t.id, 'completed')}
                              style={{
                                minHeight: '42px',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#10b981',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                            >
                              ✔ Selesai
                            </button>
                          </>
                        )}

                        {t.status === 'arrived' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateTicketStatus(t.id, 'completed')}
                            style={{
                              gridColumn: '1 / -1',
                              minHeight: '42px',
                              borderRadius: '10px',
                              border: 'none',
                              background: '#10b981',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            ✔ Tandai Evakuasi Selesai
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </>
        )}

        {/* ==============================================================
            TAB 3: RADAR PETA WILAYAH (COMPACT MAP + 25 DESA CARDS)
           ============================================================== */}
        {activeTab === 'radar' && (
          <>
            <section className="m-card" style={{ padding: '14px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800 }}>
                Radar Peta Geospasial 25 Desa
              </h2>
              <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: '#64748b' }}>
                Ketuk marker desa pada peta untuk memeriksa indeks probabilitas banjir.
              </p>

              <div className="m-map-frame" style={{ height: '300px' }}>
                <RiskMap
                  height="300px"
                  selectedVillageName={selectedVillageName}
                  villagesData={villages}
                  shelters={shelters}
                  onSelectVillage={(v) => {
                    if (v?.name) setSelectedVillageName(v.name.replace(/^Desa\s+/i, ''))
                  }}
                />
              </div>
            </section>

            <section className="m-card">
              <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: 800 }}>
                Daftar Status 25 Desa (Urut Risiko)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {villages.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVillageName(v.cleanName)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: selectedVillageName.toLowerCase() === v.cleanName.toLowerCase() ? '2px solid #009aa6' : '1px solid #e2e8f0',
                      background: selectedVillageName.toLowerCase() === v.cleanName.toLowerCase() ? '#f0fdfa' : '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Desa {v.cleanName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Risiko: <strong>{Number(v.probability).toFixed(1)}%</strong>
                      </div>
                    </div>
                    <span className={`m-badge ${v.risk_level}`}>{v.risk_level.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 4: MANAJEMEN POSKO EVAKUASI
           ============================================================== */}
        {activeTab === 'posko' && (
          <>
            <section className="m-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>Manajemen Posko Evakuasi</h2>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {shelters.length} posko aktif • {totalRefugees} pengungsi terdaftar
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPoskoModal(true)}
                style={{
                  background: '#009aa6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '9px 13px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Tambah Posko
              </button>
            </section>

            {shelters.map((p) => {
              const occ = Number(p.capacity_occupied || 0)
              const tot = Number(p.capacity_total || 200)
              const pct = Math.min(100, Math.round((occ / tot) * 100))
              return (
                <article key={p.id} className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#0c1a24' }}>{p.name}</strong>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        📍 {p.address}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                        👤 PJ: {p.contact_person || 'Petugas BPBD'} ({p.contact_phone || '-'})
                      </div>
                    </div>
                    <span className={`m-badge ${pct >= 90 ? 'awas' : pct >= 70 ? 'waspada' : 'aman'}`}>
                      {pct >= 100 ? 'Penuh' : 'Tersedia'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                      <span>Kapasitas Terisi: <strong>{occ}</strong> / {tot} jiwa</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#dc2626' : '#009aa6' }} />
                    </div>
                  </div>

                  {/* Touch-Friendly Counter Buttons (-10, -1, +1, +10) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleAdjustPoskoCapacity(p, -10)}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      −10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustPoskoCapacity(p, -1)}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustPoskoCapacity(p, 1)}
                      style={{ height: '38px', borderRadius: '8px', border: 'none', background: '#009aa6', color: '#ffffff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustPoskoCapacity(p, 10)}
                      style={{ height: '38px', borderRadius: '8px', border: 'none', background: '#0c1a24', color: '#ffffff', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      +10
                    </button>
                  </div>
                </article>
              )
            })}
          </>
        )}
      </main>

      {/* MODAL TAMBAH POSKO BARU */}
      {showAddPoskoModal && (
        <div className="m-modal-overlay" onClick={() => setShowAddPoskoModal(false)}>
          <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>Tambah Posko Evakuasi Baru</h3>
              <button type="button" className="m-icon-btn" onClick={() => setShowAddPoskoModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddPoskoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px' }}>Nama Posko</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Posko Balai Desa Kalisari"
                  value={newPosko.name}
                  onChange={(e) => setNewPosko({ ...newPosko, name: e.target.value })}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #dce5eb' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px' }}>Alamat Lokasi</label>
                <input
                  type="text"
                  required
                  placeholder="Jl. Poros Desa..."
                  value={newPosko.address}
                  onChange={(e) => setNewPosko({ ...newPosko, address: e.target.value })}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #dce5eb' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px' }}>Kapasitas Total</label>
                  <input
                    type="number"
                    required
                    value={newPosko.capacity_total}
                    onChange={(e) => setNewPosko({ ...newPosko, capacity_total: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #dce5eb' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px' }}>Terisi Awal</label>
                  <input
                    type="number"
                    value={newPosko.capacity_occupied}
                    onChange={(e) => setNewPosko({ ...newPosko, capacity_occupied: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #dce5eb' }}
                  />
                </div>
              </div>
              <button type="submit" className="m-btn m-btn-teal">Simpan Posko Baru</button>
            </form>
          </div>
        </div>
      )}

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />

      {/* FIXED 4-TAB ADMIN BOTTOM NAVIGATION BAR */}
      <nav className="m-bottom-nav" aria-label="Navigasi Mobile Petugas">
        <div className="m-nav-row">
          {/* Tab 1: Dashboard */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => switchTab('dashboard')}
          >
            <div className="m-nav-icon-pill">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7.5" height="7.5" rx="2.5" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="2.5" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="2.5" />
              </svg>
            </div>
            <span className="m-nav-label">Dashboard</span>
          </button>

          {/* Tab 2: Radar Peta */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => switchTab('radar')}
          >
            <div className="m-nav-icon-pill">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                <line x1="12" y1="12" x2="18.5" y2="5.5" />
              </svg>
            </div>
            <span className="m-nav-label">Radar Peta</span>
          </button>

          {/* Tab 3: Tiket SOS */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'sos' ? 'active' : ''}`}
            onClick={() => switchTab('sos')}
          >
            <div className="m-nav-icon-pill" style={{ position: 'relative' }}>
              {activeTickets.length > 0 && <span className="m-nav-badge">{activeTickets.length}</span>}
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                <line x1="12" y1="9" x2="12" y2="15" strokeDasharray="2.5 2.5" />
              </svg>
            </div>
            <span className="m-nav-label">Tiket SOS</span>
          </button>

          {/* Tab 4: Posko */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'posko' ? 'active' : ''}`}
            onClick={() => switchTab('posko')}
          >
            <div className="m-nav-icon-pill">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                <path d="M18 9h3a1 1 0 0 1 1 1v12" />
                <path d="M2 22V10a1 1 0 0 1 1-1h3" />
                <path d="M10 22v-4a2 2 0 0 1 4 0v4" />
              </svg>
            </div>
            <span className="m-nav-label">Posko</span>
          </button>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="m-home-indicator" />
      </nav>
    </div>
  )
}
