import { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'

export default function SOSManager() {
  const [selectedTicket, setSelectedTicket] = useState('EVAC-BRN-001')

  const tickets = [
    { id: 'EVAC-BRN-001', lokasi: 'Dsn. Krajan RT03', desa: 'Desa Baureno', koordinat: '-7.1984, 111.9401', jiwa: 4, rentan: 'Lansia', status: 'Baru', time: '2 mnt lalu' },
    { id: 'EVAC-BRN-002', lokasi: 'Jl. Bengawan 12', desa: 'Desa Trojalu', koordinat: '-7.2011, 111.9455', jiwa: 7, rentan: 'Balita', status: 'Baru', time: '5 mnt lalu' },
    { id: 'EVAC-BRN-003', lokasi: 'Dsn. Sawah RT01', desa: 'Desa Pasinan', koordinat: '-7.2098, 111.9502', jiwa: 2, rentan: '-', status: 'Baru', time: '12 mnt lalu' },
  ]

  const activeTicket = tickets.find(t => t.id === selectedTicket) || tickets[0]

  return (
    <AdminLayout activeMenu="sos">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Tiket SOS</h2>
          <p>Kelola & tindak lanjuti permintaan evakuasi warga secara real-time.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="summary-mini-card">TIKET AKTIF <strong>6</strong></div>
          <div className="summary-mini-card">JIWA MENUNGGU <strong>32</strong></div>
          <div className="summary-mini-card">SELESAI <strong>2</strong></div>
          <button className="add-btn">+ Tiket Manual</button>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="portal-card" style={{ padding: '24px' }}>
          <div className="table-filters">
            <div className="tab-pills">
              <button className="active">Baru</button>
              <button>Diproses</button>
              <button>Selesai</button>
              <button>Semua</button>
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
              {tickets.map(ticket => (
                <tr key={ticket.id} className={selectedTicket === ticket.id ? 'selected' : ''} onClick={() => setSelectedTicket(ticket.id)}>
                  <td className="ticket-id">{ticket.id}</td>
                  <td>
                    <strong>{ticket.lokasi}</strong>
                    <small>{ticket.koordinat}</small>
                  </td>
                  <td>{ticket.jiwa}</td>
                  <td><span className="badge-baru">{ticket.status}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="dispatch-btn">Dispatch</button>
                      <button className="icon-btn">✎</button>
                      <button className="icon-btn">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="sos-detail-panel portal-card">
          <div className="detail-header">
            <strong>{activeTicket.id}</strong>
            <div className="detail-meta">
              <span>◷ {activeTicket.time}</span>
              <button className="text-btn">✎ Edit</button>
            </div>
          </div>

          <div className="detail-content">
            <h3>{activeTicket.lokasi}</h3>
            <p>{activeTicket.desa}</p>

            <div className="gps-box">
              <small>KOORDINAT GPS</small>
              <strong>{activeTicket.koordinat}</strong>
            </div>

            <div className="stats-row">
              <div className="stat-box">
                <small>Jumlah</small>
                <strong>{activeTicket.jiwa} <small>orang</small></strong>
              </div>
              <div className="stat-box">
                <small>Kelompok Rentan</small>
                <strong>{activeTicket.rentan}</strong>
              </div>
            </div>

            <div className="fleet-section">
              <h4>Tim Perahu Tersedia</h4>
              {[
                { name: 'Perahu Karet 01', status: 'Siaga', color: '#10b981' },
                { name: 'Perahu Karet 02', status: 'Bertugas', color: '#f59e0b' },
                { name: 'Perahu Mesin 01', status: 'Siaga', color: '#10b981' },
              ].map((boat, idx) => (
                <div key={idx} className="boat-card">
                  <span>⚡ {boat.name}</span>
                  <b style={{ color: boat.color }}>● {boat.status}</b>
                </div>
              ))}
            </div>

            <button className="primary-action-btn">Kerahkan Perahu Sekarang</button>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
