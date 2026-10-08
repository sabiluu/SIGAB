import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getSOSTickets, updateSOSStatus } from '../../services/sosService'
import wsService from '../../services/wsService'

export default function SOSManager() {
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [assignedUnitInput, setAssignedUnitInput] = useState('')

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const data = await getSOSTickets()
      setTickets(data)
      if (data.length > 0 && !selectedTicketId) {
        setSelectedTicketId(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()

    wsService.connect('sos')
    const unsubNew = wsService.on('sos_new', (payload) => {
      fetchTickets()
    })
    const unsubUpd = wsService.on('sos_updated', () => {
      fetchTickets()
    })
    const unsubDispatched = wsService.on('sos_dispatched', () => {
      fetchTickets()
    })

    return () => {
      unsubNew()
      unsubUpd()
      unsubDispatched()
    }
  }, [])

  const handleUpdateStatus = async (id, newStatus, unitName = null) => {
    try {
      const payload = { status: newStatus }
      if (unitName) payload.assigned_unit = unitName
      await updateSOSStatus(id, payload)
      fetchTickets()
    } catch (err) {
      alert('Gagal update status: ' + err.message)
    }
  }

  const activeTicket = tickets.find(t => t.id === selectedTicketId) || tickets[0] || null

  const getRentanText = (t) => {
    if (!t) return '-'
    const v = []
    if (t.has_elderly) v.push('Lansia')
    if (t.has_toddler) v.push('Balita')
    if (t.has_pregnant) v.push('Ibu Hamil')
    if (t.has_disability) v.push('Disabilitas')
    return v.length > 0 ? v.join(', ') : 'Tidak ada'
  }

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'submitted' && t.status !== 'submitted') return false
    if (filterStatus === 'verified' && t.status !== 'verified') return false
    if (filterStatus === 'dispatched' && t.status !== 'dispatched' && t.status !== 'arrived') return false
    if (filterStatus === 'completed' && t.status !== 'completed') return false
    if (filterStatus === 'active' && (t.status === 'completed' || t.status === 'rejected')) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchNum = t.ticket_number?.toLowerCase().includes(q)
      const matchAddr = t.gps_address?.toLowerCase().includes(q)
      const matchVil = (t.village_name || '').toLowerCase().includes(q)
      return matchNum || matchAddr || matchVil
    }
    return true
  })

  return (
    <AdminLayout activeMenu="sos">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Tiket SOS & Evakuasi</h2>
          <p>Disposisi perahu karet & pantau status penyelamatan warga secara real-time via WebSocket.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="summary-mini-card">TIKET AKTIF <strong>{tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected').length}</strong></div>
          <div className="summary-mini-card">JIWA MENUNGGU <strong>{tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected').reduce((sum, t) => sum + (t.family_count || 0), 0)}</strong></div>
          <div className="summary-mini-card">TEREVAKUASI <strong>{tickets.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.family_count || 0), 0)} jiwa</strong></div>
          <button className="add-btn" onClick={fetchTickets}>↻ Refresh</button>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="portal-card" style={{ padding: '24px' }}>
          <div className="table-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div className="tab-pills" style={{ display: 'flex', gap: '6px' }}>
              <button className={filterStatus === 'all' ? 'active' : ''} onClick={() => setFilterStatus('all')}>Semua ({tickets.length})</button>
              <button className={filterStatus === 'submitted' ? 'active' : ''} onClick={() => setFilterStatus('submitted')}>Menunggu ({tickets.filter(t => t.status === 'submitted').length})</button>
              <button className={filterStatus === 'verified' ? 'active' : ''} onClick={() => setFilterStatus('verified')}>Terverifikasi ({tickets.filter(t => t.status === 'verified').length})</button>
              <button className={filterStatus === 'dispatched' ? 'active' : ''} onClick={() => setFilterStatus('dispatched')}>Meluncur ({tickets.filter(t => t.status === 'dispatched' || t.status === 'arrived').length})</button>
              <button className={filterStatus === 'completed' ? 'active' : ''} onClick={() => setFilterStatus('completed')}>Selesai ({tickets.filter(t => t.status === 'completed').length})</button>
            </div>
            <div className="search-box-mini">
              <input 
                type="text" 
                placeholder="⌕ Cari tiket, desa, alamat..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <table className="sos-table">
            <thead>
              <tr>
                <th>ID TIKET</th>
                <th>LOKASI / DESA</th>
                <th>JIWA</th>
                <th>STATUS</th>
                <th>AKSI CEPAT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px'}}>Memuat tiket...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px'}}>Tidak ada tiket yang sesuai kriteria.</td></tr>
              ) : filteredTickets.map(ticket => (
                <tr key={ticket.id} className={selectedTicketId === ticket.id ? 'selected' : ''} onClick={() => setSelectedTicketId(ticket.id)} style={{ cursor: 'pointer' }}>
                  <td className="ticket-id">
                    <strong>{ticket.ticket_number}</strong>
                    <br/><small style={{ color: '#64748b' }}>Skor: {ticket.priority_score}</small>
                  </td>
                  <td>
                    <strong>{ticket.gps_address || (ticket.village_name ? `Desa ${ticket.village_name}` : `Desa ID ${ticket.village_id}`)}</strong>
                    <br/><small style={{ color: '#64748b' }}>GPS: {Number(ticket.gps_latitude).toFixed(4)}, {Number(ticket.gps_longitude).toFixed(4)}</small>
                  </td>
                  <td>
                    <strong>{ticket.family_count} jiwa</strong>
                    {ticket.has_elderly || ticket.has_toddler || ticket.has_pregnant || ticket.has_disability ? (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#e11d48' }}>⚠️ Rentan</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge-baru ${ticket.status}`}>
                      {ticket.status === 'submitted' ? 'Menunggu' :
                       ticket.status === 'verified' ? 'Terverifikasi' :
                       ticket.status === 'dispatched' ? 'Tim Meluncur' :
                       ticket.status === 'arrived' ? 'Tim Tiba' :
                       ticket.status === 'completed' ? 'Selesai' : ticket.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions" style={{ display: 'flex', gap: '6px' }}>
                      {ticket.status === 'submitted' && (
                        <button className="dispatch-btn" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'verified'); }} title="Verifikasi">
                          Verifikasi
                        </button>
                      )}
                      {(ticket.status === 'submitted' || ticket.status === 'verified') && (
                        <button className="dispatch-btn" style={{ background: '#f59e0b' }} onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'dispatched', 'Perahu Karet Tim Alfa'); }} title="Kirim Perahu">
                          🚤 Kirim Tim
                        </button>
                      )}
                      {ticket.status === 'dispatched' && (
                        <button className="dispatch-btn" style={{ background: '#3b82f6' }} onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'arrived'); }} title="Tiba di Lokasi">
                          ⚓ Tiba
                        </button>
                      )}
                      {ticket.status !== 'completed' && (
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'completed'); }} title="Selesai Evakuasi">
                          ✔️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeTicket && (
          <aside className="sos-detail-panel portal-card">
            <div className="detail-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <strong>{activeTicket.ticket_number}</strong>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Pelapor: <b>{activeTicket.reporter_name || 'Warga Baureno'}</b>
                </div>
              </div>
              <div className="detail-meta">
                <span>◷ {activeTicket.submitted_at ? new Date(activeTicket.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB</span>
              </div>
            </div>

            <div className="detail-content" style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '14px' }}>
                <small style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>LOKASI PELAPOR</small>
                <h3 style={{ margin: '4px 0', fontSize: '1.1rem' }}>{activeTicket.gps_address || 'Koordinat Lapangan'}</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
                  Wilayah: <strong>{activeTicket.village_name ? `Desa ${activeTicket.village_name}` : `Desa ID #${activeTicket.village_id}`}</strong>
                </p>
              </div>

              <div className="gps-box" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <small style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>KOORDINAT GPS PRESISI</small>
                <strong>📍 {Number(activeTicket.gps_latitude).toFixed(6)}, {Number(activeTicket.gps_longitude).toFixed(6)}</strong>
                <div style={{ marginTop: '6px' }}>
                  <a 
                    href={`https://www.google.com/maps?q=${activeTicket.gps_latitude},${activeTicket.gps_longitude}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}
                  >
                    Buka di Google Maps ↗
                  </a>
                </div>
              </div>

              <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="stat-box" style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
                  <small style={{ color: '#64748b' }}>Jumlah Jiwa</small>
                  <strong style={{ display: 'block', fontSize: '1.2rem', color: '#0f172a' }}>{activeTicket.family_count} <small style={{ fontSize: '0.8rem' }}>orang</small></strong>
                </div>
                <div className="stat-box" style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
                  <small style={{ color: '#64748b' }}>Skor Prioritas</small>
                  <strong style={{ display: 'block', fontSize: '1.2rem', color: '#dc2626' }}>{activeTicket.priority_score} pts</strong>
                </div>
              </div>

              <div style={{ marginBottom: '14px', background: '#fff1f2', padding: '10px', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                <small style={{ color: '#be123c', fontWeight: 'bold', display: 'block' }}>KELOMPOK RENTAN TERIDENTIFIKASI:</small>
                <span style={{ color: '#881337', fontWeight: 'bold' }}>{getRentanText(activeTicket)}</span>
              </div>

              {activeTicket.assigned_unit && (
                <div style={{ marginBottom: '14px', background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <small style={{ color: '#1e40af', fontWeight: 'bold', display: 'block' }}>ARMADA PENJEMPUT:</small>
                  <span style={{ color: '#1e3a8a', fontWeight: 'bold' }}>🚤 {activeTicket.assigned_unit}</span>
                </div>
              )}

              <div className="fleet-section" style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>Tindakan Tim Pusdalops BPBD:</h4>
                <div style={{ marginBottom: '10px' }}>
                  <input 
                    type="text"
                    placeholder="Nama Armada (contoh: Perahu Karet Tim Alfa)"
                    value={assignedUnitInput}
                    onChange={e => setAssignedUnitInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button 
                    onClick={() => handleUpdateStatus(activeTicket.id, 'verified')} 
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Verifikasi
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(activeTicket.id, 'dispatched', assignedUnitInput || 'Perahu Karet Pusdalops')} 
                    style={{ padding: '8px', borderRadius: '6px', background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🚤 Kirim Tim
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(activeTicket.id, 'arrived')} 
                    style={{ padding: '8px', borderRadius: '6px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ⚓ Tim Tiba
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(activeTicket.id, 'completed')} 
                    style={{ padding: '8px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✔️ Selesai
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}
