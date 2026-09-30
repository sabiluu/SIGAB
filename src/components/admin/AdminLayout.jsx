import { useState, useEffect } from 'react'
import { logout } from '../../services/authService'
import '../../styles/role-home.css'

const brandIcon = 'https://www.figma.com/api/mcp/asset/d84f02db-e7d0-4c80-8d2c-7b2c55160913/375ad.svg'

export default function AdminLayout({ children, activeMenu }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hh = String(currentTime.getHours()).padStart(2, '0')
  const mm = String(currentTime.getMinutes()).padStart(2, '0')
  const ss = String(currentTime.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss} WIB`
  const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦', href: '#petugas' },
    { id: 'radar', label: 'Radar Peta', icon: '◉', href: '#radar' },
    { id: 'sos', label: 'Tiket SOS', icon: '▣', href: '#sos', badge: 12 },
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
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div className="search-box">⌕ &nbsp; Cari desa, tiket, atau petugas...</div>
          <div className="admin-time">
            <strong>{timeStr}</strong>
            <small>{dateStr}</small>
          </div>
          <div className="danger-toggle">
            <span>STATUS DARURAT<br /><strong>AKTIF</strong></span>
            <i />
          </div>
          <div className="admin-avatar">●</div>
          <button onClick={logout} className="logout-btn"><i>⎋</i> Keluar</button>
        </header>
        
        <main className="admin-dashboard">
          {children}
        </main>
      </section>
    </div>
  )
}
