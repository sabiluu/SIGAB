import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getShelters, updateShelterCapacity } from '../../services/shelterService'

export default function PoskoManager() {
  const [poskoList, setPoskoList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPoskos()
  }, [])

  const fetchPoskos = async () => {
    try {
      setLoading(true)
      const data = await getShelters()
      setPoskoList(data)
    } catch (err) {
      console.error('Failed to fetch shelters:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCapacity = async (id, newCapacity, maxCapacity) => {
    if (newCapacity < 0) newCapacity = 0
    if (newCapacity > maxCapacity) newCapacity = maxCapacity
    try {
      await updateShelterCapacity(id, newCapacity)
      fetchPoskos()
    } catch (err) {
      alert('Gagal update kapasitas: ' + err.message)
    }
  }

  const totalPosko = poskoList.length
  const totalCapacity = poskoList.reduce((sum, p) => sum + (p.capacity_max || 0), 0)
  const totalOccupied = poskoList.reduce((sum, p) => sum + (p.capacity_occupied || 0), 0)
  const remaining = totalCapacity - totalOccupied
  const occupancyPct = totalCapacity ? Math.round((totalOccupied / totalCapacity) * 100) : 0

  return (
    <AdminLayout activeMenu="posko">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Posko</h2>
          <p>Atur kapasitas & kuota pengungsian tiap posko secara langsung.</p>
        </div>
        <button className="primary-btn" onClick={fetchPoskos}>↻ Refresh</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card portal-card">
          <small>TOTAL POSKO</small>
          <strong>{totalPosko} <small>lokasi</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>TERISI</small>
          <strong>{totalOccupied} <small>/ {totalCapacity}</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>SISA KUOTA</small>
          <strong>{remaining} <small>tempat</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>OKUPANSI</small>
          <strong>{occupancyPct}%</strong>
        </div>
      </div>

      <div className="posko-grid">
        {loading ? <p>Memuat data posko...</p> : poskoList.map((posko) => {
          const pctVal = posko.capacity_max ? Math.round((posko.capacity_occupied / posko.capacity_max) * 100) : 0
          const pct = `${pctVal}%`
          let status = 'Tersedia'
          if (pctVal >= 100) status = 'Penuh'
          else if (pctVal >= 80) status = 'Hampir Penuh'
          
          return (
            <div key={posko.id} className="posko-card portal-card">
              <div className="posko-card-header">
                <div>
                  <strong>{posko.name}</strong>
                  <small>@ {posko.address}</small>
                </div>
                <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
              </div>

              <div className="posko-stats">
                <strong>{posko.capacity_occupied} <small>/ {posko.capacity_max}</small></strong>
                <span className="pct">{pct}</span>
              </div>

              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: pct, background: pctVal >= 100 ? '#dc2626' : '#f59e0b' }}></div>
              </div>

              <div className="posko-footer">
                <span>PIC: {posko.pic_name || '-'}</span>
                <div className="stepper">
                  <button onClick={() => handleUpdateCapacity(posko.id, (posko.capacity_occupied || 0) - 5, posko.capacity_max)}>-</button>
                  <span>±5</span>
                  <button onClick={() => handleUpdateCapacity(posko.id, (posko.capacity_occupied || 0) + 5, posko.capacity_max)}>+</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </AdminLayout>
  )
}
