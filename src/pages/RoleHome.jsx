import { useState, useEffect } from 'react'
import { logout, getProfile } from '../services/authService'
import { apiFetch } from '../services/api'
import wsService from '../services/wsService'
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
import { getSOSTickets } from '../services/sosService'
import '../styles/role-home.css'
import '../styles/warga-portal.css'

function Brand({ admin = false, locName = '' }) {
  return (
    <div className={`role-brand ${admin ? 'role-brand-admin' : ''}`}>
      <span className="role-brand-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
          <path d="M4 12c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
          <path d="M4 16c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" />
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
  const [userProfile, setUserProfile] = useState({ full_name: 'Ahmad Fauzi' })
  const [selectedVillageId, setSelectedVillageId] = useState(null)
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [tempVillageId, setTempVillageId] = useState(3)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const geo = useGeolocation()

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
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
  } = useRealtimeNotifications('alerts')

  // Sample default notifications if empty so citizen always has guidance
  const defaultNotifs = [
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

  const displayNotifs = notifications.length > 0 ? notifications : defaultNotifs
  const activeUnread = notifications.length > 0 ? unreadCount : 1

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
      
    wsService.connect('alerts')
    const unsub = wsService.on('emergency_status', (data) => setIsEmergencyActive(data.is_active))
    return () => unsub()
  }, [])

  const handleSelectTab = (tab) => {
    setActiveTab(tab)
    setMobileMenuOpen(false)
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
    <div className="warga-container">
      {/* Emergency Banner */}
      {isEmergencyActive && (
        <div style={{ background: '#dc2626', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'notifPulse 1.5s infinite' }} />
            <span>🚨 BANJIR PARAH — SEGERA EVAKUASI</span>
            <span style={{ fontWeight: 'normal', opacity: 0.9, fontSize: '0.85rem' }}>Baureno • Siaga Level 4 • Live Pusdalops</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              style={{ background: 'white', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => handleSelectTab('sos')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              MINTA BANTUAN SOS
            </button>
          </div>
        </div>
      )}

      {/* Header Sticky */}
      <header className="warga-header-wrapper">
        <div className="warga-header">
          <Brand locName={geo.address ? geo.address.split(',')[0] : 'Baureno'} />

          {/* Navigation Links */}
          <nav className="warga-nav" aria-label="Navigasi Warga">
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'beranda' ? 'active' : ''}`}
              onClick={() => handleSelectTab('beranda')}
            >
              Beranda
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'riwayat' ? 'active' : ''}`}
              onClick={() => handleSelectTab('riwayat')}
            >
              Riwayat Kejadian
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'panduan' ? 'active' : ''}`}
              onClick={() => handleSelectTab('panduan')}
            >
              Panduan
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'kontak' ? 'active' : ''}`}
              onClick={() => handleSelectTab('kontak')}
            >
              Kontak Darurat
            </button>
            <button
              type="button"
              className={`warga-nav-item ${activeTab === 'sos' ? 'active' : ''}`}
              onClick={() => handleSelectTab('sos')}
              style={{ color: '#dc2626', fontWeight: 700 }}
            >
              🚨 SOS Darurat
            </button>
          </nav>

          {/* Header Right Tools */}
          <div className="warga-tools">
            <div 
              className="warga-loc-pill"
              title="Klik untuk memilih desa domisili Baureno atau perbarui GPS"
              onClick={handleOpenLocationModal}
              style={{ cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={geo.isCustom ? '#0284c7' : geo.isRealDevice ? '#10b981' : 'currentColor'} 
                strokeWidth="2.5"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{geo.loading ? 'Mencari GPS...' : (geo.address || 'Desa Baureno, Bojonegoro')}</span>
              <span style={{ fontSize: '10px', opacity: 0.65, marginLeft: '1px' }}>▾</span>
              {geo.isRealDevice && (
                <span 
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 6px #10b981'
                  }} 
                  title="GPS Device Terkunci" 
                />
              )}
            </div>

            {/* Notification Dropdown */}
            <div className="notif-dropdown-wrapper">
              <button 
                type="button" 
                className="warga-bell-btn" 
                title="Notifikasi & Peringatan"
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown)
                  setShowProfileDropdown(false)
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {activeUnread > 0 && <span className="notif-badge-count">{activeUnread}</span>}
              </button>

              {showNotifDropdown && (
                <div className="notif-panel">
                  <div className="notif-panel-header">
                    <h4>Pemberitahuan ({displayNotifs.length})</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => markAllAsRead()}>Tandai Dibaca</button>
                      <button type="button" onClick={() => clearAll()} style={{ color: '#94a3b8' }}>Bersihkan</button>
                    </div>
                  </div>
                  <div className="notif-panel-body">
                    {displayNotifs.length === 0 ? (
                      <div className="notif-empty">
                        <div className="notif-empty-icon">🔔</div>
                        <strong>Tidak ada notifikasi</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Semua peringatan telah dibaca.</p>
                      </div>
                    ) : (
                      displayNotifs.map((item) => (
                        <div 
                          key={item.id} 
                          className={`notif-item ${!item.read ? 'unread' : ''}`}
                          onClick={() => {
                            markAsRead(item.id)
                            if (item.type?.includes('sos')) handleSelectTab('sos')
                            else if (item.type?.includes('flood') || item.type?.includes('emergency')) handleSelectTab('peta')
                            setShowNotifDropdown(false)
                          }}
                        >
                          <div className={`notif-item-icon ${item.type?.includes('flood') ? 'flood' : item.type?.includes('sos') ? 'sos' : 'info'}`}>
                            {item.type?.includes('flood') ? '🌊' : item.type?.includes('sos') ? '🚨' : '📢'}
                          </div>
                          <div className="notif-item-content">
                            <div className="notif-item-title">{item.title}</div>
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
              )}
            </div>

            {/* User Profile Pill & Dropdown */}
            <div className="profile-dropdown-wrapper">
              <div 
                className="warga-user-pill" 
                title="Profil Pengguna"
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown)
                  setShowNotifDropdown(false)
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="warga-user-avatar">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                    alt={userProfile.full_name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
                <span className="warga-user-name">{userProfile.full_name || 'Ahmad Fauzi'}</span>
                <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>▾</span>
              </div>

              {showProfileDropdown && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <strong>{userProfile.full_name || 'Ahmad Fauzi'}</strong>
                    <small>{userProfile.nik ? `NIK: ${userProfile.nik}` : 'Warga Terdaftar'}</small>
                    <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '4px', fontWeight: 600 }}>
                      📍 {geo.address ? geo.address.split(',')[0] : 'Desa Baureno'}
                    </div>
                  </div>
                  <div className="profile-dropdown-body">
                    <button 
                      type="button" 
                      className="profile-dropdown-item"
                      onClick={() => {
                        setShowProfileModal(true)
                        setShowProfileDropdown(false)
                      }}
                    >
                      <span>👤</span> Data Rumah Tangga &amp; NIK
                    </button>
                    <button 
                      type="button" 
                      className="profile-dropdown-item"
                      onClick={() => {
                        handleSelectTab('peta')
                        setShowProfileDropdown(false)
                      }}
                    >
                      <span>🗺️</span> Peta Risiko &amp; Posko
                    </button>
                    <button 
                      type="button" 
                      className="profile-dropdown-item"
                      onClick={() => {
                        handleSelectTab('panduan')
                        setShowProfileDropdown(false)
                      }}
                    >
                      <span>📖</span> Panduan Evakuasi
                    </button>
                    <button 
                      type="button" 
                      className="profile-dropdown-item"
                      onClick={() => {
                        handleSelectTab('kontak')
                        setShowProfileDropdown(false)
                      }}
                    >
                      <span>☎️</span> Kontak Darurat BPBD
                    </button>
                    <button 
                      type="button" 
                      className="profile-dropdown-item danger"
                      onClick={logout}
                    >
                      <span>⎋</span> Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <button 
              type="button" 
              className="warga-hamburger" 
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu Navigasi Mobile"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <div 
        className={`mobile-nav-overlay ${mobileMenuOpen ? 'show' : ''}`} 
        onClick={() => setMobileMenuOpen(false)}
      >
        <div className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-nav-header">
            <Brand locName={geo.address ? geo.address.split(',')[0] : 'Baureno'} />
            <button type="button" className="mobile-nav-close" onClick={() => setMobileMenuOpen(false)}>
              ✕
            </button>
          </div>
          <div 
            style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}
            onClick={() => {
              setMobileMenuOpen(false)
              handleOpenLocationModal()
            }}
          >
            <div><strong>{userProfile.full_name || 'Ahmad Fauzi'}</strong></div>
            <div style={{ fontSize: '0.72rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span>📍 {geo.address || 'Desa Baureno, Bojonegoro'}</span>
              <span style={{ fontSize: '10px', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>Ubah Desa</span>
            </div>
          </div>
          <div className="mobile-nav-list">
            <button 
              type="button" 
              className={`mobile-nav-item ${activeTab === 'beranda' ? 'active' : ''}`}
              onClick={() => handleSelectTab('beranda')}
            >
              🏠 Beranda
            </button>
            <button 
              type="button" 
              className={`mobile-nav-item ${activeTab === 'riwayat' ? 'active' : ''}`}
              onClick={() => handleSelectTab('riwayat')}
            >
              📜 Riwayat Kejadian
            </button>
            <button 
              type="button" 
              className={`mobile-nav-item ${activeTab === 'panduan' ? 'active' : ''}`}
              onClick={() => handleSelectTab('panduan')}
            >
              📖 Panduan Kesiapsiagaan
            </button>
            <button 
              type="button" 
              className={`mobile-nav-item ${activeTab === 'kontak' ? 'active' : ''}`}
              onClick={() => handleSelectTab('kontak')}
            >
              ☎️ Kontak Darurat
            </button>
            <button 
              type="button" 
              className={`mobile-nav-item sos ${activeTab === 'sos' ? 'active' : ''}`}
              onClick={() => handleSelectTab('sos')}
            >
              🚨 Minta Bantuan SOS
            </button>
          </div>
          <div className="mobile-nav-footer">
            <button 
              type="button" 
              onClick={logout} 
              className="warga-logout-btn" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              ⎋ Keluar Akun
            </button>
          </div>
        </div>
      </div>

      {/* User Profile Modal */}
      {showProfileModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Profil Warga &amp; Rumah Tangga
              </h3>
              <button 
                type="button" 
                onClick={() => setShowProfileModal(false)}
                style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800 }}>
                {userProfile.full_name ? userProfile.full_name.charAt(0) : 'W'}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem', color: '#0f172a' }}>
                  {userProfile.full_name || 'Ahmad Fauzi'}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  NIK: {userProfile.nik || '3522141508890002'} • {userProfile.phone_number || '0812-3456-7890'}
                </span>
                <div style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  ✓ Terverifikasi BPBD
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Kecamatan &amp; Desa</span>
                <strong>Kec. Baureno</strong>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>Desa Baureno</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Anggota Keluarga</span>
                <strong>{userProfile.family_count || 4} Jiwa</strong>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>Prioritas Evakuasi: Standar</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Kelompok Rentan</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>1 Lansia</span>
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>1 Balita</span>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Koordinat Terdaftar</span>
                <strong>-7.1425, 112.0841</strong>
                <div style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ GPS Akurat (3m)</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Kecamatan Baureno, Bojonegoro • Penentu Posko &amp; Peringatan Banjir Terdekat
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
                {geo.address || 'Desa Baureno, Bojonegoro'}
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
      <main className="warga-page-body">
        {(activeTab === 'beranda' || activeTab === 'peta') && (
          <WargaBeranda 
            onNavigate={(tab) => handleSelectTab(tab)} 
            geo={geo} 
            userProfile={userProfile} 
            selectedVillageId={selectedVillageId}
            onSelectVillageId={setSelectedVillageId}
            onOpenLocationModal={handleOpenLocationModal}
            initialScrollToMap={activeTab === 'peta'}
          />
        )}
        {activeTab === 'riwayat' && <WargaRiwayatKejadian />}
        {activeTab === 'panduan' && <WargaPanduan />}
        {activeTab === 'kontak' && <WargaKontakDarurat />}
        {activeTab === 'sos' && <WargaSOS onNavigate={(tab) => handleSelectTab(tab)} geo={geo} />}
      </main>

      {/* Footer */}
      <footer className="warga-footer">
        <div className="warga-footer-inner">
          <span>© 2025 SiagaBencana Portal Warga Kecamatan Baureno, Bojonegoro.</span>
          <span>Badan Penanggulangan Bencana Daerah (BPBD)</span>
        </div>
      </footer>
    </div>
  )
}

function AdminHome() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isEmergency, setIsEmergency] = useState(false)
  const [tickets, setTickets] = useState([])
  const { data: realtimeData } = useDashboardRealtime()

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

    wsService.connect('alerts')
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
        await apiFetch('/emergency/1/deactivate', { method: 'POST', body: JSON.stringify({}) })
      } else {
        await apiFetch('/emergency/1/activate', { method: 'POST', body: JSON.stringify({}) })
      }
    } catch(e) { 
      console.error(e)
      alert("Gagal menghubungi server: " + e.message)
      setIsEmergency(isEmergency)
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

  const dischargeVal = realtimeData?.discharge?.discharge_m3s 
    ? Math.round(realtimeData.discharge.discharge_m3s).toLocaleString('id-ID')
    : '1.200'

  const rainVal = realtimeData?.weather?.precipitation_mm ?? 0

  const getVulnerableSummary = (t) => {
    const v = []
    if (t.has_elderly) v.push('Lansia')
    if (t.has_toddler) v.push('Balita')
    if (t.has_pregnant) v.push('Ibu Hamil')
    if (t.has_disability) v.push('Difabel')
    return v.length > 0 ? ` • ${v.join(', ')}` : ''
  }

  return (
    <main className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`}>
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
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <div className="search-box">⌕ &nbsp; Cari desa, tiket, atau petugas...</div>
          <div className="admin-time">
            <strong>{timeStr}</strong>
            <small>{dateStr}</small>
          </div>
          <div 
            className={`danger-toggle ${isEmergency ? 'active' : ''}`} 
            onClick={toggleEmergency}
            style={{ cursor: 'pointer', background: isEmergency ? '#fff1f2' : '#f1f5f9', borderColor: isEmergency ? '#fecdd3' : '#e2e8f0' }}
          >
            <span>
              STATUS DARURAT
              <br />
              <strong style={{ color: isEmergency ? '#e11d48' : '#64748b' }}>{isEmergency ? 'AKTIF' : 'NONAKTIF'}</strong>
            </span>
            <i className="toggle-indicator" />
            <style>{`
              .danger-toggle i.toggle-indicator { background: ${isEmergency ? '#e11d48' : '#cbd5e1'}; transition: all 0.3s; }
              .danger-toggle i.toggle-indicator::after { right: ${isEmergency ? '2px' : '22px'}; transition: all 0.3s; }
            `}</style>
          </div>
          <div className="admin-avatar">●</div>
          <button onClick={logout} className="logout-btn" title="Keluar">
            <i>⎋</i> Keluar
          </button>
        </header>
        <div className="admin-dashboard">
          <div className="kpi-grid">
            <Kpi icon="♜" label="RERATA DEBIT SUNGAI" value={dischargeVal} unit="m³/s" change="Live GloFAS" />
            <Kpi icon="☁" label="RERATA CURAH HUJAN" value={rainVal} unit="mm" change="Open-Meteo" />
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
              <RiskMap />
            </article>
            <article className="sos-queue portal-card">
              <div className="admin-section-head">
                <h2>🔴 Antrian SOS Live</h2>
                <b>{activeTickets.length} antrean</b>
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
                  const time = ticket.submitted_at ? new Date(ticket.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'
                  return (
                    <div className="sos-ticket" key={ticket.id}>
                      <div>
                        <strong>{ticket.ticket_number}</strong>
                        <time>{time} WIB</time>
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
    </main>
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
  return role === 'petugas' ? <AdminHome /> : <WargaHome />
}

export default RoleHome