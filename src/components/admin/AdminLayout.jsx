import { useState, useEffect } from 'react'
import { logout } from '../../services/authService'
import { apiFetch } from '../../services/api'
import wsService from '../../services/wsService'
import LogoutModal from '../common/LogoutModal'
import { useAccessibility } from '../../context/AccessibilityContext'
import { AccessibilityIcon } from '../common/AccessibilityWidget'
import { getStoredSidebarState, setStoredSidebarState, getCurrentShift } from '../../utils/helpers'
import '../../styles/role-home.css'

export default function AdminLayout({ children, activeMenu }) {
  const { openPanel: openA11yPanel, activeCount: a11yActiveCount } = useAccessibility()
  const [sidebarOpen, setSidebarOpen] = useState(() => getStoredSidebarState(typeof window !== 'undefined' ? window.innerWidth > 1024 : true))
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isEmergency, setIsEmergency] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const [sosCount, setSosCount] = useState(0)

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
    apiFetch('/emergency/1').then(res => setIsEmergency(res.is_emergency_active)).catch(() => {})
    
    // Fetch SOS tickets count
    apiFetch('/sos').then(tickets => {
      if (Array.isArray(tickets)) {
        const active = tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected').length
        setSosCount(active)
      }
    }).catch(() => {})

    wsService.connect('alerts', { role: 'admin' })
    wsService.connect('sos')
    const unsub1 = wsService.on('emergency_status', (data) => setIsEmergency(data.is_active))
    const unsub2 = wsService.on('sos_new', () => setSosCount(prev => prev + 1))
    const unsub3 = wsService.on('sos_completed', () => setSosCount(prev => Math.max(0, prev - 1)))
    
    return () => {
      clearInterval(timer)
      unsub1()
      unsub2()
      unsub3()
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
  const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '#petugas',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'radar',
      label: 'Radar Peta',
      href: '#radar',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      ),
    },
    {
      id: 'sos',
      label: 'Tiket SOS',
      href: '#sos',
      badge: sosCount > 0 ? sosCount : null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: 'posko',
      label: 'Manajemen Posko',
      href: '#posko',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
          <path d="M10 21v-6a2 2 0 0 1 4 0v6" />
        </svg>
      ),
    },
  ]

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          title="Tutup Menu"
        />
      )}

      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="role-brand">
            <span className="role-brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
                <path d="M3 7c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
                <path d="M3 12c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
                <path d="M3 17c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
              </svg>
            </span>
            <span className="brand-text"><strong>SIGAB</strong><small>Pusdalops BPBD</small></span>
          </div>
        </div>
        
        <nav>
          {menuItems.map(item => (
            <a key={item.id} href={item.href} className={activeMenu === item.id ? 'active' : ''} onClick={handleNavClick}>
              <i>{item.icon}</i>
              <span>{item.label}</span>
              {item.badge && <b>{item.badge}</b>}
            </a>
          ))}
          <a
            href="#aksesibilitas"
            onClick={(e) => {
              e.preventDefault()
              openA11yPanel()
              handleNavClick()
            }}
            title="Pengaturan Aksesibilitas (Alt + A)"
          >
            <i><AccessibilityIcon size={18} /></i>
            <span>Aksesibilitas</span>
            {a11yActiveCount > 0 && <b>{a11yActiveCount}</b>}
          </a>
        </nav>

        <div className="operator">
          <span className="op-status">●</span>
          <div className="op-text">
            <small>Petugas Jaga</small>
            <strong>Kec. Baureno</strong>
            <span>Online · {getCurrentShift(currentTime)}</span>
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
          <button
            type="button"
            className="admin-mobile-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Menu Navigasi"
            aria-label="Menu Navigasi"
          >
            ☰
          </button>
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
            <i className="toggle-indicator-layout" />
            <style>{`
              .danger-toggle i.toggle-indicator-layout { background: ${isEmergency ? '#e11d48' : '#cbd5e1'}; transition: all 0.3s; }
              .danger-toggle i.toggle-indicator-layout::after { right: ${isEmergency ? '2px' : '22px'}; transition: all 0.3s; }
            `}</style>
          </div>
        </header>
        
        <main className="admin-dashboard">
          {children}
        </main>
      </section>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />
    </div>
  )
}
