import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getSOSTickets, updateSOSStatus } from '../../services/sosService'

export default function SOSManager() {
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTickets()
  }, [])

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

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateSOSStatus(id, { status: newStatus })
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
    return v.length > 0 ? v.join(', ') : '-'
  }

  return (
    <AdminLayout activeMenu="sos">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Tiket SOS</h2>
          <p>Kelola & tindak lanjuti permintaan evakuasi warga secara real-time.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="summary-mini-card">TIKET AKTIF <strong>{tickets.filter(t => t.status !== 'completed' && t.status !== 'rejected').length}</strong></div>
          <div className="summary-mini-card">JIWA MENUNGGU <strong>{tickets.filter(t => t.status !== 'completed').reduce((sum, t) => sum + (t.family_count || 0), 0)}</strong></div>
          <div className="summary-mini-card">SELESAI <strong>{tickets.filter(t => t.status === 'completed').length}</strong></div>
          <button className="add-btn" onClick={fetchTickets}>↻ Refresh</button>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="portal-card" style={{ padding: '24px' }}>
          <div className="table-filters">
            <div className="tab-pills">
              <button className="active">Semua</button>
            </div>
            <div className="search-box-mini">⌕ &nbsp; Cari ID / lokasi...</div>
          </div>

          <table className="sos-table">
            <thead>
              <tr>
                <th>ID TIKET</th>
                <th>LOKASI / GPS</th>
                <th>JIWA</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>Memuat data...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>Tidak ada tiket SOS.</td></tr>
              ) : tickets.map(ticket => (
                <tr key={ticket.id} className={selectedTicketId === ticket.id ? 'selected' : ''} onClick={() => setSelectedTicketId(ticket.id)}>
                  <td className="ticket-id">{ticket.ticket_number}</td>
                  <td>
                    <strong>{ticket.gps_address || `Desa ID ${ticket.village_id}`}</strong>
                    <br/><small>{ticket.gps_latitude}, {ticket.gps_longitude}</small>
                  </td>
                  <td>{ticket.family_count}</td>
                  <td><span className={`badge-baru ${ticket.status}`}>{ticket.status}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="dispatch-btn" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'dispatched'); }}>Dispatch</button>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'completed'); }}>✔️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeTicket && (
          <aside className="sos-detail-panel portal-card">
            <div className="detail-header">
              <strong>{activeTicket.ticket_number}</strong>
              <div className="detail-meta">
                <span>◷ {new Date(activeTicket.submitted_at).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="detail-content">
              <h3>{activeTicket.gps_address || 'Alamat tidak diketahui'}</h3>
              <p>Desa ID: {activeTicket.village_id}</p>

              <div className="gps-box">
                <small>KOORDINAT GPS</small>
                <strong>{activeTicket.gps_latitude}, {activeTicket.gps_longitude}</strong>
              </div>

              <div className="stats-row">
                <div className="stat-box">
                  <small>Jumlah</small>
                  <strong>{activeTicket.family_count} <small>orang</small></strong>
                </div>
                <div className="stat-box">
                  <small>Kelompok Rentan</small>
                  <strong>{getRentanText(activeTicket)}</strong>
                </div>
              </div>

              <div className="fleet-section">
                <h4>Ubah Status Evakuasi</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button onClick={() => handleUpdateStatus(activeTicket.id, 'verified')} style={{padding: '8px', flex: 1}}>Verifikasi</button>
                  <button onClick={() => handleUpdateStatus(activeTicket.id, 'dispatched')} style={{padding: '8px', flex: 1, background: '#f59e0b', color: '#fff', border: 'none'}}>Kirim Tim</button>
                  <button onClick={() => handleUpdateStatus(activeTicket.id, 'arrived')} style={{padding: '8px', flex: 1, background: '#3b82f6', color: '#fff', border: 'none'}}>Tim Tiba</button>
                  <button onClick={() => handleUpdateStatus(activeTicket.id, 'completed')} style={{padding: '8px', flex: 1, background: '#10b981', color: '#fff', border: 'none'}}>Selesai</button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}
