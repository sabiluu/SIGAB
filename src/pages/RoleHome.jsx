import { useState, useEffect } from 'react'
import { logout, getProfile } from '../services/authService'
import { apiFetch } from '../services/api'
import wsService from '../services/wsService'
import { getSOSTickets, createSOSTicket } from '../services/sosService'
import RiskMap from '../components/RiskMap'
import WargaBeranda from '../components/warga/WargaBeranda'
import WargaRiwayatKejadian from '../components/warga/WargaRiwayatKejadian'
import WargaPanduan from '../components/warga/WargaPanduan'
import WargaKontakDarurat from '../components/warga/WargaKontakDarurat'
import WargaSOS from '../components/warga/WargaSOS'
import VillageStatsTable from '../components/dashboard/VillageStatsTable'
import useDashboardRealtime from '../hooks/useDashboardRealtime'
import useGeolocation, { BAURENO_VILLAGES } from '../hooks/useGeolocation'
import useRealtimeNotifications from '../hooks/useRealtimeNotifications'
import { playSosAlertTone } from '../utils/audioAlarm'
import { formatWIBTime, getStoredSidebarState, setStoredSidebarState } from '../utils/helpers'
import LogoutModal from '../components/common/LogoutModal'
import ProfileModal from '../components/warga/ProfileModal'
import '../styles/role-home.css'
import '../styles/warga-portal.css'

function Brand({ admin = false, locName = '' }) {
  return (
    <div className={`role-brand ${admin ? 'role-brand-admin' : ''}`}>
      <span className="role-brand-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 7c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
          <path d="M3 12c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
          <path d="M3 17c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
        </svg>
      </span>
      <span className="role-brand-text">
        <strong>SiagaBencana</strong>
        <small>{admin ? 'Pusdalops BPBD' : (locName ? `Portal Warga • ${locName}` : 'Portal Warga')}</small>
      </span>
    </div>
  )
}

function WargaHome() {
  const [activeTab, setActiveTab] = useState('beranda')
  const [userProfile, setUserProfile] = useState({ full_name: 'Ahmadi' })
  const [selectedVillageId, setSelectedVillageId] = useState(null)
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileStartInEditMode, setProfileStartInEditMode] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [tempVillageId, setTempVillageId] = useState(3)
  const [sidebarOpen, setSidebarOpen] = useState(() => getStoredSidebarState(typeof window !== 'undefined' ? window.innerWidth > 1024 : true))
  const geo = useGeolocation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const { data: realtimeData } = useDashboardRealtime()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 1024) {
      setStoredSidebarState(sidebarOpen)
    }
  }, [sidebarOpen])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024 && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sidebarOpen])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hh = String(currentTime.getHours()).padStart(2, '0')
  const mm = String(currentTime.getMinutes()).padStart(2, '0')
  const ss = String(currentTime.getSeconds()).padStart(2, '0')
  const liveTimeStr = `${hh}:${mm}:${ss} WIB`

  const handleOpenLocationModal = () => {
    const currentVillage = BAURENO_VILLAGES.find(v => {
      if (geo.isCustom && geo.address) {
        return geo.address.toLowerCase().includes(v.name.toLowerCase().replace(' (pusat)', ''))
      }
      return false
    })
    setTempVillageId(currentVillage ? currentVillage.id : (selectedVillageId || 3))
    setShowLocationModal(true)
  }

  const handleApplyVillage = (vId) => {
    const target = BAURENO_VILLAGES.find(v => v.id === Number(vId))
    if (target) {
      geo.setVillageLocation(target)
      setSelectedVillageId(target.id)
      setShowLocationModal(false)
    }
  }

  const handleResetLocation = () => {
    geo.resetToBaurenoDefault()
    setSelectedVillageId(3)
    setShowLocationModal(false)
  }

  const handleUseRealGps = () => {
    geo.useRealDeviceLocation()
    setShowLocationModal(false)
  }

  const { 
    notifications: liveNotifs, 
    markAsRead: wsMarkAsRead, 
    markAllAsRead: wsMarkAllAsRead, 
    clearAll: wsClearAll 
  } = useRealtimeNotifications('alerts', {
    villageId: userProfile?.village_id || selectedVillageId,
    userId: userProfile?.id,
    role: 'user',
  })

  // Local notifications state to ensure mark as read and clear work 100% reliably
  const [localNotifs, setLocalNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('sigab_warga_notifs')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return [
      {
        id: 'def-1',
        type: 'flood_alert',
        title: 'Pemantauan Debit Bengawan Solo',
        message: 'Debit Bengawan Solo terpantau stabil pada 1.200 m³/s. Pantau terus status dusun Anda.',
        timestamp: new Date().toISOString(),
        read: false
      },
      {
        id: 'def-2',
        type: 'info',
        title: 'Posko Siaga Baureno Siap 24 Jam',
        message: 'Posko Utama SDN 1 Baureno dan Balai Desa Gunungsari siap beroperasi.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true
      }
    ]
  })

  // Merge live incoming WebSocket notifications into local state
  useEffect(() => {
    if (liveNotifs && liveNotifs.length > 0) {
      setLocalNotifs(prev => {
        const merged = [...liveNotifs]
        prev.forEach(p => {
          if (!merged.some(m => m.id === p.id)) {
            merged.push(p)
          }
        })
        return merged
      })
    }
  }, [liveNotifs])

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sigab_warga_notifs', JSON.stringify(localNotifs))
    } catch (e) {}
  }, [localNotifs])

  const handleMarkAsRead = (id) => {
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    wsMarkAsRead(id)
  }

  const handleMarkAllAsRead = () => {
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })))
    wsMarkAllAsRead()
  }

  const handleClearAll = () => {
    setLocalNotifs([])
    wsClearAll()
  }

  const displayNotifs = localNotifs
  const activeUnread = displayNotifs.filter(n => !n.read).length

  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res && res.full_name) {
          setUserProfile(res)
          if (res.village_id) {
            setSelectedVillageId(res.village_id)
          }
          const targetVillageId = res.village_id || 1
          apiFetch(`/emergency/${targetVillageId}`)
            .then(em => setIsEmergencyActive(em.is_emergency_active))
            .catch(() => {})
        }
      })
      .catch(() => {})

    apiFetch('/emergency/1')
      .then(res => setIsEmergencyActive(res.is_emergency_active))
      .catch(() => {})
      
    wsService.connect('alerts', {
      villageId: userProfile?.village_id || selectedVillageId,
      userId: userProfile?.id,
      role: 'user',
    })
    const unsub = wsService.on('emergency_status', (data) => setIsEmergencyActive(data.is_active))
    return () => unsub()
  }, [])

  const handleSelectTab = (tab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      setSidebarOpen(false)
    }
    if (tab === 'peta') {
      setTimeout(() => {
        const el = document.getElementById('peta-wilayah-section')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 80)
    } else if (tab === 'beranda') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="warga-portal-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="warga-sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)} 
          title="Klik untuk menutup menu"
        />
      )}

      <div className={`warga-portal-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{ flex: 1 }}>
      {/* 1. LEFT SIDEBAR */}
      <aside className={`warga-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div>
          <div className="warga-sidebar-header-row">
            <button
              type="button"
              className="warga-sidebar-toggle-btn-inside"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Ciutkan Sidebar" : "Buka Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <a href="#" className="warga-sidebar-brand" onClick={(e) => { e.preventDefault(); handleSelectTab('beranda'); }}>
              <div className="warga-sidebar-brand-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M3 7c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
                  <path d="M3 12c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
                  <path d="M3 17c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
                </svg>
              </div>
              <div className="warga-sidebar-brand-text">
                <strong>SIGAB</strong>
                <span>Siaga Banjir Baureno</span>
              </div>
            </a>
          </div>

          <nav className="warga-sidebar-nav">
            <button
              type="button"
              className={`warga-sidebar-item ${activeTab === 'beranda' ? 'active' : ''}`}
              onClick={() => handleSelectTab('beranda')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Beranda</span>
            </button>

            <button
              type="button"
              className={`warga-sidebar-item ${activeTab === 'peta' ? 'active' : ''}`}
              onClick={() => handleSelectTab('peta')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span>Peta &amp; Posko</span>
            </button>

            <button
              type="button"
              className={`warga-sidebar-item ${activeTab === 'riwayat' ? 'active' : ''}`}
              onClick={() => handleSelectTab('riwayat')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Riwayat Banjir</span>
            </button>

            <button
              type="button"
              className={`warga-sidebar-item ${activeTab === 'panduan' ? 'active' : ''}`}
              onClick={() => handleSelectTab('panduan')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <span>Panduan</span>
            </button>

            <button
              type="button"
              className={`warga-sidebar-item ${activeTab === 'kontak' ? 'active' : ''}`}
              onClick={() => handleSelectTab('kontak')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Kontak Darurat</span>
            </button>

            <button
              type="button"
              className={`warga-sidebar-item ${showProfileModal ? 'active' : ''}`}
              onClick={() => {
                setProfileStartInEditMode(true)
                setShowProfileModal(true)
                if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
                  setSidebarOpen(false)
                }
              }}
              title="Edit profil pengguna, domisili, dan data keluarga"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Edit Profil</span>
            </button>

            {isEmergencyActive && (
              <button
                type="button"
                className={`warga-sidebar-item ${activeTab === 'sos' ? 'active' : ''}`}
                onClick={() => handleSelectTab('sos')}
                style={{ color: '#ef4444', fontWeight: 800 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>🚨 Minta Bantuan SOS</span>
              </button>
            )}
          </nav>
        </div>

        <div className="warga-sidebar-bottom">
          {/* Simulation Toggle in Sidebar */}
          <button
            type="button"
            className={`warga-sidebar-sim-btn ${isEmergencyActive ? 'active' : ''}`}
            onClick={() => {
              const next = !isEmergencyActive
              setIsEmergencyActive(next)
              if (next) playSosAlertTone()
            }}
            title={isEmergencyActive ? "Nonaktifkan simulasi banjir" : "Aktifkan simulasi banjir parah"}
          >
            <div className="warga-sidebar-sim-info">
              <span className="warga-sidebar-sim-icon">{isEmergencyActive ? '🚨' : '🧪'}</span>
              <div className="warga-sidebar-sim-text">
                <span className="sim-title">Simulasi Banjir</span>
                <span className="sim-desc">{isEmergencyActive ? 'Status: PARAH (ON)' : 'Status: Normal (OFF)'}</span>
              </div>
            </div>
            <div className={`warga-sidebar-sim-toggle ${isEmergencyActive ? 'on' : ''}`}>
              <div className="sim-knob" />
            </div>
          </button>

          <div className="warga-sidebar-help-card">
            <div className="warga-sidebar-help-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <span className="help-sub">Butuh bantuan?</span>
            <span className="help-title">Hubungi BPBD</span>
            <a href="tel:0353881234" className="help-phone">(0353) 881-234</a>
          </div>

          <button
            type="button"
            className="warga-sidebar-logout-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <div className="warga-main-container">
        {/* 0. EMERGENCY TOP INDICATOR BAR */}
        {isEmergencyActive && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 1200,
            background: '#dc2626',
            color: '#ffffff',
            padding: '10px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.22)',
                fontSize: '14px'
              }}>
                📢
              </span>
              <span style={{ fontSize: '0.94rem', letterSpacing: '0.02em', fontWeight: 800, textTransform: 'uppercase' }}>
                BANJIR PARAH — EVAKUASI SEKARANG
              </span>
              <span style={{ opacity: 0.95, fontWeight: 500, fontSize: '0.84rem' }}>
                {geo.address ? geo.address.split(',')[0].replace(/^Desa\s+/i, '') : 'Baureno'} • Level 4 • {liveTimeStr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleSelectTab('sos')}
              style={{
                background: '#ffffff',
                color: '#dc2626',
                border: 'none',
                padding: '6px 18px',
                borderRadius: '9999px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '0.95rem' }}>⚠️</span>
              <span>MINTA BANTUAN SOS</span>
            </button>
          </div>
        )}

        {/* Topbar */}
        <header className="warga-topbar">
          <div className="warga-topbar-left">
            <button
              type="button"
              className="warga-sidebar-toggle-btn warga-mobile-only-toggle"
              onClick={() => setSidebarOpen(true)}
              title="Buka Sidebar"
              aria-label="Buka Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="warga-topbar-breadcrumb">
              <strong>Portal Warga</strong>
              <span className="divider">|</span>
              <span 
                onClick={() => setShowProfileModal(true)} 
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Klik untuk melihat atau mengatur data domisili, profil & keluarga Anda"
              >
                <span style={{ fontSize: '13px' }}>📍</span>
                {geo.loading ? (
                  <span>Mendeteksi GPS...</span>
                ) : (
                  <span>{geo.address ? geo.address.split(',')[0].replace(/^Desa\s+/i, '') : 'Lokasi Device'}</span>
                )}
                {geo.isRealDevice && (
                  <span style={{ 
                    fontSize: '9px', 
                    background: '#dcfce7', 
                    color: '#15803d', 
                    padding: '1px 5px', 
                    borderRadius: '10px', 
                    fontWeight: 700 
                  }}>
                    GPS Real
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="warga-topbar-actions">
            {isEmergencyActive && (
              <button
                type="button"
                className="warga-sim-active-badge"
                onClick={() => setIsEmergencyActive(false)}
                title="Simulasi aktif. Klik untuk kembali ke normal"
              >
                <span className="sim-pulse-dot" />
                <span>🚨 Mode Simulasi (ON)</span>
              </button>
            )}

            <div className="warga-live-chip">
              <span className="pulse-dot" />
              <span>Data live • {liveTimeStr}</span>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="warga-circle-btn"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Notifikasi & Peringatan"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {activeUnread > 0 && <span className="warga-badge-count">{activeUnread}</span>}
              </button>

              {showNotifDropdown && (
                <>
                  {/* Invisible backdrop to dismiss dropdown on click outside */}
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
                    onClick={() => setShowNotifDropdown(false)} 
                  />
                  <div className="notif-panel">
                    <div className="notif-panel-header">
                      <h4>
                        <span>🔔</span> Pemberitahuan ({displayNotifs.length})
                      </h4>
                      <div className="notif-panel-actions">
                        {activeUnread > 0 && (
                          <button 
                            type="button" 
                            className="notif-btn-read"
                            onClick={handleMarkAllAsRead}
                            title="Tandai semua notifikasi sudah dibaca"
                          >
                            ✓ Tandai Dibaca
                          </button>
                        )}
                        {displayNotifs.length > 0 && (
                          <button 
                            type="button" 
                            className="notif-btn-clear"
                            onClick={handleClearAll}
                            title="Hapus semua notifikasi"
                          >
                            Bersihkan
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="notif-panel-body">
                      {displayNotifs.length === 0 ? (
                        <div className="notif-empty">
                          <div className="notif-empty-icon">🔔</div>
                          <strong>Tidak ada notifikasi</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Semua pemberitahuan sudah dibaca.</p>
                        </div>
                      ) : (
                        displayNotifs.map((item) => (
                          <div 
                            key={item.id} 
                            className={`notif-item ${!item.read ? 'unread' : ''}`}
                            onClick={() => {
                              handleMarkAsRead(item.id)
                              if (item.type?.includes('sos')) handleSelectTab('sos')
                              else if (item.type?.includes('flood') || item.type?.includes('emergency')) handleSelectTab('peta')
                              setShowNotifDropdown(false)
                            }}
                          >
                            <div className={`notif-item-icon ${item.type?.includes('flood') ? 'flood' : item.type?.includes('sos') ? 'sos' : 'info'}`}>
                              {item.type?.includes('flood') ? '🌊' : item.type?.includes('sos') ? '🚨' : '📢'}
                            </div>
                            <div className="notif-item-content">
                              <div className="notif-item-title">
                                <span>{item.title}</span>
                                {!item.read && <span className="notif-unread-dot" title="Belum dibaca" />}
                              </div>
                              <div className="notif-item-msg">{item.message}</div>
                              <div className="notif-item-time">
                                {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div 
              className="warga-profile-chip" 
              onClick={() => {
                setProfileStartInEditMode(false)
                setShowProfileModal(true)
              }}
              title="Data Profil Pengguna, Domisili & Rumah Tangga (Klik untuk lihat & edit)"
            >
              <div className="warga-avatar-circle" style={{ overflow: 'hidden' }}>
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile.full_name || 'Profil'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  userProfile?.full_name ? userProfile.full_name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'WB'
                )}
              </div>
              <div className="warga-profile-info">
                <strong>{userProfile?.full_name || 'Warga Baureno (Demo)'}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Warga terverifikasi</span>
                </span>
              </div>
            </div>
          </div>
        </header>

      {/* User Profile & Household Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false)
          setProfileStartInEditMode(false)
        }}
        startInEditMode={profileStartInEditMode}
        userProfile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile(updated)
          if (updated.village_id) {
            setSelectedVillageId(updated.village_id)
          }
        }}
        geo={geo}
        villages={BAURENO_VILLAGES}
      />

      {/* Location Picker Modal */}
      {showLocationModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowLocationModal(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>📍</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Lokasi Domisili Warga
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Kecamatan Baureno • Penentu Posko &amp; Peringatan Banjir Terdekat
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowLocationModal(false)}
                style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Real Device Location Option */}
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                  🎯 Lokasi GPS Real Perangkat
                </div>
                <div style={{ fontSize: '0.74rem', color: '#15803d', marginTop: '2px' }}>
                  Kunci koordinat GPS nyata langsung dari perangkat Anda saat ini.
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseRealGps}
                style={{
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                Gunakan GPS Device
              </button>
            </div>

            {/* Status Lokasi Aktif Saat Ini */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Lokasi Aktif Sekarang
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: geo.isCustom ? '#eff6ff' : geo.isRealDevice ? '#dcfce7' : '#f1f5f9',
                  color: geo.isCustom ? '#1d4ed8' : geo.isRealDevice ? '#15803d' : '#475569',
                  border: `1px solid ${geo.isCustom ? '#bfdbfe' : geo.isRealDevice ? '#bbf7d0' : '#cbd5e1'}`
                }}>
                  {geo.isCustom ? '✓ Dipilih Mandiri' : geo.isRealDevice ? '✓ GPS Hardware' : 'Default Baureno'}
                </span>
              </div>
              <strong style={{ fontSize: '0.98rem', color: '#0f172a', display: 'block' }}>
                {geo.address || 'Desa Baureno, Baureno'}
              </strong>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                Koordinat: {geo.latitude?.toFixed(4)}, {geo.longitude?.toFixed(4)}
              </div>
            </div>

            {/* Form Pilihan 25 Desa Baureno */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="select-village-domisili" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                Pilih Desa Domisili Anda (25 Desa Resmi):
              </label>
              <select
                id="select-village-domisili"
                value={tempVillageId}
                onChange={(e) => setTempVillageId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {BAURENO_VILLAGES.map(v => (
                  <option key={v.id} value={v.id}>
                    Desa {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Access Badges for Key Flood-Prone / High-Traffic Villages */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
                Pilihan Cepat Desa Prioritas Banjir &amp; Posko:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[3, 8, 22, 24, 1, 5, 12, 13].map(vId => {
                  const v = BAURENO_VILLAGES.find(item => item.id === vId)
                  if (!v) return null
                  const isSelected = tempVillageId === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setTempVillageId(v.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#1d4ed8' : '#334155',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleResetLocation}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Kembalikan ke Pusat Kecamatan Baureno"
                >
                  ↺ Reset Default
                </button>
                <button
                  type="button"
                  onClick={() => {
                    geo.refresh()
                  }}
                  disabled={geo.loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1fae5',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Deteksi ulang dari sensor GPS perangkat (disarankan di HP)"
                >
                  {geo.loading ? 'Mendeteksi...' : '📡 Pindai GPS'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyVillage(tempVillageId)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  ✓ Terapkan Lokasi Desa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on Tab */}
      <main className="warga-content-body">
        {(activeTab === 'beranda' || activeTab === 'peta') && (
          <WargaBeranda 
            activeTab={activeTab}
            onNavigate={(tab) => handleSelectTab(tab)} 
            geo={geo} 
            userProfile={userProfile} 
            onEditProfile={() => {
              setProfileStartInEditMode(true)
              setShowProfileModal(true)
            }}
            selectedVillageId={selectedVillageId}
            onSelectVillageId={setSelectedVillageId}
            onOpenLocationModal={handleOpenLocationModal}
            initialScrollToMap={activeTab === 'peta'}
            isEmergencyActive={isEmergencyActive}
            onToggleSimulatedEmergency={(val) => setIsEmergencyActive(val)}
          />
        )}
        {activeTab === 'riwayat' && <WargaRiwayatKejadian />}
        {activeTab === 'panduan' && <WargaPanduan />}
        {activeTab === 'kontak' && <WargaKontakDarurat isEmergencyActive={isEmergencyActive} />}
        {activeTab === 'sos' && (
          <WargaSOS 
            onNavigate={(tab) => handleSelectTab(tab)} 
            geo={geo} 
            userProfile={userProfile}
            isEmergencyActive={isEmergencyActive}
          />
        )}
      </main>
      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />
    </div>
  </div>
  </div>
  )
}

function AdminHome() {
  const [sidebarOpen, setSidebarOpen] = useState(() => getStoredSidebarState(true))
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isEmergency, setIsEmergency] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [tickets, setTickets] = useState([])
  const { data: realtimeData } = useDashboardRealtime()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 1024) {
      setStoredSidebarState(sidebarOpen)
    }
  }, [sidebarOpen])

  const fetchTickets = () => {
    getSOSTickets()
      .then(res => {
        if (Array.isArray(res)) setTickets(res)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    apiFetch('/emergency/1').then(res => setIsEmergency(res.is_emergency_active)).catch(() => {})
    fetchTickets()

    wsService.connect('alerts', { role: 'admin' })
    wsService.connect('sos')
    const unsubAlerts = wsService.on('emergency_status', (data) => setIsEmergency(data.is_active))
    const unsubSosNew = wsService.on('sos_new', () => {
      playSosAlertTone()
      fetchTickets()
    })
    const unsubSosUpd = wsService.on('sos_updated', () => {
      fetchTickets()
    })

    return () => {
      clearInterval(timer)
      unsubAlerts()
      unsubSosNew()
      unsubSosUpd()
    }
  }, [])

  const toggleEmergency = async () => {
    const nextState = !isEmergency
    setIsEmergency(nextState)

    try {
      if (isEmergency) {
        await apiFetch('/emergency/3/deactivate', { method: 'POST', body: JSON.stringify({}) }).catch(() => {})
        await apiFetch('/emergency/1/deactivate', { method: 'POST', body: JSON.stringify({}) }).catch(() => {})
      } else {
        await apiFetch('/emergency/3/activate', { method: 'POST', body: JSON.stringify({ notes: 'Simulasi darurat aktif' }) }).catch(() => {})
        await apiFetch('/emergency/1/activate', { method: 'POST', body: JSON.stringify({ notes: 'Simulasi darurat aktif' }) }).catch(() => {})
      }
    } catch(e) { 
      console.error(e)
    }
  }

  const hh = String(currentTime.getHours()).padStart(2, '0')
  const mm = String(currentTime.getMinutes()).padStart(2, '0')
  const ss = String(currentTime.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss} WIB`

  const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
  const dateStr = currentTime.toLocaleDateString('id-ID', dateOptions)

  const activeTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected')
  const shelters = realtimeData?.shelters || []
  const totalShelterCap = shelters.reduce((s, sh) => s + (sh.capacity_total || 0), 0)
  const occupiedShelterCap = shelters.reduce((s, sh) => s + (sh.capacity_occupied || 0), 0)
  const shelterOccPct = totalShelterCap ? Math.round((occupiedShelterCap / totalShelterCap) * 100) : 0

  const handleCreateSimulatedTicket = async () => {
    try {
      const payload = {
        name: 'Warga Baureno (Simulasi Darurat)',
        phone: '081234567899',
        village_id: 3,
        gps_latitude: -7.1285,
        gps_longitude: 112.104,
        gps_address: 'Bantaran Bengawan Solo, RT 02/RW 01, Desa Baureno',
        patokan: 'Ketinggian air 1.6m di dalam rumah, arus deras luapan Bengawan Solo, butuh perahu evakuasi darurat!',
        family_count: 5,
        has_elderly: true,
        has_toddler: true,
        has_pregnant: false,
        has_disability: false
      }
      await createSOSTicket(payload)
      fetchTickets()
      playSosAlertTone()
      alert('Tiket SOS simulasi banjir parah berhasil dibuat dan masuk ke antrean live!')
    } catch (err) {
      alert('Gagal membuat tiket simulasi: ' + (err.message || 'Error'))
    }
  }

  const dischargeVal = isEmergency
    ? '1.950'
    : (realtimeData?.discharge?.discharge_m3s 
        ? Math.round(realtimeData.discharge.discharge_m3s).toLocaleString('id-ID')
        : '1.200')

  const rainVal = isEmergency ? 148 : (realtimeData?.weather?.precipitation_mm ?? 0)

  const getVulnerableSummary = (t) => {
    const v = []
    if (t.has_elderly) v.push('Lansia')
    if (t.has_toddler) v.push('Balita')
    if (t.has_pregnant) v.push('Ibu Hamil')
    if (t.has_disability) v.push('Difabel')
    return v.length > 0 ? ` • ${v.join(', ')}` : ''
  }

  return (
    <div className="admin-portal-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* 0. EMERGENCY TOP INDICATOR BAR FOR ADMIN */}
      {isEmergency && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1200,
          background: '#dc2626',
          color: '#ffffff',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 700,
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.22)',
              fontSize: '14px'
            }}>
              📢
            </span>
            <span style={{ fontSize: '0.94rem', letterSpacing: '0.02em', fontWeight: 800, textTransform: 'uppercase' }}>
              STATUS DARURAT BANJIR PARAH AKTIF — SIAGA LEVEL 4 (BENGAWAN SOLO)
            </span>
            <span style={{ opacity: 0.95, fontWeight: 500, fontSize: '0.84rem' }}>
              Kec. Baureno • Live Pusdalops BPBD • {timeStr}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href="#sos"
              style={{
                background: '#ffffff',
                color: '#dc2626',
                textDecoration: 'none',
                padding: '6px 18px',
                borderRadius: '9999px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              <span>⚠️</span>
              <span>LIHAT TIKET SOS ({activeTickets.length})</span>
            </a>
            <button
              type="button"
              onClick={toggleEmergency}
              style={{
                background: 'rgba(0,0,0,0.25)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '5px 14px',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
              title="Nonaktifkan status darurat"
            >
              Nonaktifkan Status
            </button>
          </div>
        </div>
      )}

      <main className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`} style={{ flex: 1 }}>
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
            ☰
          </button>
          <Brand admin />
        </div>
        <nav>
          <a className="active" href="#petugas">
            <i>▦</i> <span>Dashboard</span>
          </a>
          <a href="#radar">
            <i>◉</i> <span>Radar Peta</span>
          </a>
          <a href="#sos">
            <i>▣</i> <span>Tiket SOS</span>
            {activeTickets.length > 0 && <b>{activeTickets.length}</b>}
          </a>
          <a href="#posko">
            <i>♙</i> <span>Manajemen Posko</span>
          </a>
        </nav>
        <div className="operator">
          <span className="op-status">●</span>
          <div className="op-text">
            <small>Petugas Jaga</small>
            <strong>Kec. Baureno</strong>
            <span>Online · Shift Pagi</span>
          </div>
        </div>

        <div className="sidebar-logout-wrap">
          <button
            type="button"
            className="warga-sidebar-logout-btn"
            onClick={() => setShowLogoutModal(true)}
            title="Keluar dari Akun Petugas"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <div className="admin-time">
            <strong>{timeStr}</strong>
            <small>{dateStr}</small>
          </div>
          <div 
            className={`danger-toggle ${isEmergency ? 'active' : ''}`} 
            onClick={toggleEmergency}
            style={{ cursor: 'pointer', background: isEmergency ? '#fff1f2' : '#f1f5f9', borderColor: isEmergency ? '#fecdd3' : '#e2e8f0' }}
            title="Klik untuk mengaktifkan simulasi banjir parah atau mengembalikan ke kondisi normal"
          >
            <span>
              STATUS DARURAT (SIMULASI)
              <br />
              <strong style={{ color: isEmergency ? '#e11d48' : '#64748b' }}>
                {isEmergency ? 'AKTIF (BANJIR PARAH)' : 'NONAKTIF (KONDISI REAL)'}
              </strong>
            </span>
            <i className="toggle-indicator" />
            <style>{`
              .danger-toggle i.toggle-indicator { background: ${isEmergency ? '#e11d48' : '#cbd5e1'}; transition: all 0.3s; }
              .danger-toggle i.toggle-indicator::after { right: ${isEmergency ? '2px' : '22px'}; transition: all 0.3s; }
            `}</style>
          </div>
          <div className="admin-avatar">BPBD</div>
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn" title="Keluar">
            <i>⎋</i> Keluar
          </button>
        </header>
        <div className="admin-dashboard">
          <div className="kpi-grid">
            <Kpi icon="♜" label="RERATA DEBIT SUNGAI" value={dischargeVal} unit="m³/s" change={isEmergency ? 'Simulasi Banjir Parah' : 'Live GloFAS'} danger={isEmergency} />
            <Kpi icon="☁" label="RERATA CURAH HUJAN" value={rainVal} unit="mm" change={isEmergency ? 'Simulasi Hujan Ekstrem' : 'Live Open-Meteo'} danger={isEmergency} />
            <Kpi icon="⚠" label="TIKET SOS AKTIF" value={activeTickets.length} unit="tiket" change={`${activeTickets.length} butuh evakuasi`} danger={activeTickets.length > 0} />
            <Kpi icon="♧" label="TOTAL KAPASITAS POSKO" value={occupiedShelterCap} unit={`/${totalShelterCap || 1200}`} change={`${shelterOccPct}% terisi`} />
          </div>
          <div className="admin-main-grid">
            <article className="risk-map portal-card">
              <div className="admin-section-head">
                <div>
                  <h2>
                    Peta Risiko 25 Desa <b>● Live Radar</b>
                  </h2>
                  <p>Kecamatan Baureno — Visualisasi Spasial &amp; Sebaran Genangan Bengawan Solo</p>
                </div>
              </div>
              <div className="map-legend">
                <span className="red-dot" /> Sangat Tinggi (Awas){' '}
                <span className="orange-dot" /> Tinggi (Siaga){' '}
                <span className="yellow-dot" /> Sedang (Waspada){' '}
                <span className="green-dot" /> Rendah (Aman){' '}
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#radar'
                  }}
                >
                  ▧ Buka Radar ↗
                </button>
              </div>
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #cbd5e1', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.02)' }}>
                <RiskMap height="480px" villagesData={realtimeData?.villages || []} shelters={shelters} />
              </div>
            </article>
            <article className="sos-queue portal-card">
              <div className="admin-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2>🔴 Antrian SOS Live</h2>
                  <b>{activeTickets.length} antrean</b>
                </div>
                <button
                  type="button"
                  onClick={handleCreateSimulatedTicket}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                  }}
                  title="Generate tiket SOS simulasi untuk pengujian evakuasi"
                >
                  ⚡ Buat Tiket Simulasi
                </button>
              </div>
              {activeTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
                  <strong>Tidak ada tiket darurat aktif</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>Situasi warga dalam pantauan aman.</p>
                </div>
              ) : (
                activeTickets.slice(0, 5).map((ticket) => {
                  const location = ticket.gps_address || (ticket.village_name ? `Desa ${ticket.village_name}` : `Desa ID ${ticket.village_id}`)
                  const time = ticket.submitted_at ? formatWIBTime(ticket.submitted_at) : 'Baru saja'
                  return (
                    <div className="sos-ticket" key={ticket.id}>
                      <div>
                        <strong>{ticket.ticket_number}</strong>
                        <time>{time}</time>
                      </div>
                      <b>📍 {location}</b>
                      <small>👥 {ticket.family_count} jiwa{getVulnerableSummary(ticket)}</small>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = '#sos'
                        }}
                      >
                        ♟ &nbsp; Tindak Lanjuti di Panel SOS ↗
                      </button>
                    </div>
                  )
                })
              )}
            </article>
          </div>

          {/* Tabel Statistik Risiko 25 Desa */}
          <VillageStatsTable onSelectVillage={() => { window.location.hash = '#radar' }} />
        </div>
      </section>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />
    </main>
  </div>
  )
}

function Kpi({ icon, label, value, unit, change, danger }) {
  return (
    <article className="kpi-card portal-card">
      <div>
        <span>{icon}</span>
        <b className={danger ? 'danger-text' : ''}>{change}</b>
      </div>
      <small>{label}</small>
      <strong>
        {value}
        <em>{unit}</em>
      </strong>
    </article>
  )
}

function RoleHome({ role }) {
  return (role === 'petugas' || role === 'admin') ? <AdminHome /> : <WargaHome />
}

export default RoleHome