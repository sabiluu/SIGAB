import { useState, useEffect } from 'react'
import { logout } from '../../services/authService'
import { apiFetch } from '../../services/api'
import wsService from '../../services/wsService'
import LogoutModal from '../common/LogoutModal'
import '../../styles/role-home.css'

const brandIcon = 'https://www.figma.com/api/mcp/asset/d84f02db-e7d0-4c80-8d2c-7b2c55160913/375ad.svg'

export default function AdminLayout({ children, activeMenu }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isEmergency, setIsEmergency] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const [sosCount, setSosCount] = useState(0)

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
    { id: 'dashboard', label: 'Dashboard', icon: '▦', href: '#petugas' },
    { id: 'radar', label: 'Radar Peta', icon: '◉', href: '#radar' },
    { id: 'sos', label: 'Tiket SOS', icon: '▣', href: '#sos', badge: sosCount > 0 ? sosCount : null },
    { id: 'posko', label: 'Manajemen Posko', icon: '♙', href: '#posko' }
  ]

  return (
    <div className={`portal admin-portal ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="role-brand">
            <span className="role-brand-icon"><img src={brandIcon} alt="" /></span>
            <span className="brand-text"><strong>SiagaBencana</strong><small>Pusdalops BPBD</small></span>
          </div>
        </div>
        
        <nav>
          {menuItems.map(item => (
            <a key={item.id} href={item.href} className={activeMenu === item.id ? 'active' : ''}>
              <i>{item.icon}</i>
              <span>{item.label}</span>
              {item.badge && <b>{item.badge}</b>}
            </a>
          ))}
        </nav>

        <div className="operator">
          <span className="op-status">●</span>
          <div className="op-text">
            <small>Petugas Jaga</small>
            <strong>Kec. Baureno</strong>
            <span>Online · Shift Pagi</span>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
          <button
            type="button"
            className="warga-sidebar-logout-btn"
            onClick={() => setShowLogoutModal(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}
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
          <div className="admin-avatar">●</div>
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn"><i>⎋</i> Keluar</button>
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
