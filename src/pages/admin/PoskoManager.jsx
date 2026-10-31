import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getShelters, updateShelterCapacity, updateShelter, createShelter, deleteShelter } from '../../services/shelterService'
import { getVillages } from '../../services/floodService'
import wsService from '../../services/wsService'

export default function PoskoManager() {
  const [poskoList, setPoskoList] = useState([])
  const [villages, setVillages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingShelter, setEditingShelter] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [newShelter, setNewShelter] = useState({
    name: '',
    address: '',
    village_id: 1,
    latitude: -7.129,
    longitude: 112.105,
    capacity_total: 200,
    capacity_occupied: 0,
    contact_person: '',
    contact_phone: ''
  })

  useEffect(() => {
    fetchPoskos()
    getVillages().then(data => {
      if (Array.isArray(data)) setVillages(data.slice(0, 25))
    }).catch(() => {})

    wsService.connect('dashboard')
    const unsub = wsService.on('dashboard_update', (msg) => {
      if (msg && Array.isArray(msg.shelters) && msg.shelters.length > 0) {
        setPoskoList(msg.shelters)
      }
    })

    return () => {
      unsub()
    }
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

    // Optimistic UI update
    setPoskoList(prev => prev.map(p => p.id === id ? { ...p, capacity_occupied: newCapacity } : p))

    try {
      await updateShelterCapacity(id, newCapacity)
      fetchPoskos()
    } catch (err) {
      alert('Gagal update kapasitas: ' + err.message)
      fetchPoskos()
    }
  }

  const handleOpenEdit = (posko) => {
    setEditingShelter({
      id: posko.id,
      name: posko.name || '',
      address: posko.address || '',
      village_id: posko.village_id || (villages[0]?.id || 1),
      latitude: posko.latitude != null ? posko.latitude : -7.129,
      longitude: posko.longitude != null ? posko.longitude : 112.105,
      capacity_total: posko.capacity_total || 100,
      capacity_occupied: posko.capacity_occupied || 0,
      contact_person: posko.contact_person || '',
      contact_phone: posko.contact_phone || '',
      is_active: posko.is_active !== false,
    })
    setShowEditModal(true)
  }

  const handleSaveEditShelter = async (e) => {
    e.preventDefault()
    if (!editingShelter) return
    setEditSubmitting(true)
    try {
      const payload = {
        name: editingShelter.name.trim(),
        address: editingShelter.address.trim(),
        village_id: parseInt(editingShelter.village_id, 10),
        capacity_total: parseInt(editingShelter.capacity_total, 10),
        capacity_occupied: parseInt(editingShelter.capacity_occupied, 10) || 0,
        contact_person: (editingShelter.contact_person || '').trim(),
        contact_phone: (editingShelter.contact_phone || '').trim(),
        latitude: parseFloat(editingShelter.latitude),
        longitude: parseFloat(editingShelter.longitude),
        is_active: Boolean(editingShelter.is_active),
      }
      await updateShelter(editingShelter.id, payload)
      setShowEditModal(false)
      setEditingShelter(null)
      fetchPoskos()
    } catch (err) {
      alert('Gagal mengupdate posko: ' + (err.message || err))
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteShelter = async (id, name) => {
    if (!window.confirm(`Yakin ingin menghapus posko "${name}"?`)) return
    try {
      await deleteShelter(id)
      fetchPoskos()
    } catch (err) {
      alert('Gagal menghapus posko: ' + err.message)
    }
  }

  const handleAddShelter = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createShelter({
        ...newShelter,
        village_id: parseInt(newShelter.village_id, 10),
        capacity_total: parseInt(newShelter.capacity_total, 10),
        capacity_occupied: parseInt(newShelter.capacity_occupied, 10) || 0,
        latitude: parseFloat(newShelter.latitude),
        longitude: parseFloat(newShelter.longitude),
      })
      setShowAddModal(false)
      setNewShelter({
        name: '',
        address: '',
        village_id: villages[0]?.id || 1,
        latitude: -7.129,
        longitude: 112.105,
        capacity_total: 200,
        capacity_occupied: 0,
        contact_person: '',
        contact_phone: ''
      })
      fetchPoskos()
    } catch (err) {
      alert('Gagal menambah posko: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalPosko = poskoList.length
  const totalCapacity = poskoList.reduce((sum, p) => sum + (p.capacity_total || 0), 0)
  const totalOccupied = poskoList.reduce((sum, p) => sum + (p.capacity_occupied || 0), 0)
  const remaining = Math.max(0, totalCapacity - totalOccupied)
  const occupancyPct = totalCapacity ? Math.round((totalOccupied / totalCapacity) * 100) : 0

  return (
    <AdminLayout activeMenu="posko">
      <div className="admin-section-head">
        <div>
          <h2>Manajemen Posko & Shelter Pengungsian</h2>
          <p>Atur kapasitas, sisa kuota, dan sebaran posko pengungsian di Kecamatan Baureno.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="primary-btn" onClick={() => setShowAddModal(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            + Tambah Posko
          </button>
          <button className="primary-btn" onClick={fetchPoskos}>↻ Refresh</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card portal-card">
          <small>TOTAL POSKO RESMI</small>
          <strong>{totalPosko} <small>lokasi</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>PENGUNGSI TERDATA</small>
          <strong>{totalOccupied} <small>/ {totalCapacity} jiwa</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>SISA DAYA TAMPUNG</small>
          <strong>{remaining} <small>jiwa</small></strong>
        </div>
        <div className="kpi-card portal-card">
          <small>RERATA KETERISIAN</small>
          <strong style={{ color: occupancyPct > 80 ? '#dc2626' : '#10b981' }}>{occupancyPct}%</strong>
        </div>
      </div>

      <div className="posko-grid">
        {loading ? (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>Memuat data posko...</p>
        ) : poskoList.length === 0 ? (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>Belum ada data posko pengungsian.</p>
        ) : poskoList.map((posko) => {
          const maxCap = posko.capacity_total || 100
          const occCap = posko.capacity_occupied || 0
          const pctVal = Math.round((occCap / maxCap) * 100)
          const pct = `${pctVal}%`
          let status = 'Tersedia'
          if (pctVal >= 100) status = 'Penuh'
          else if (pctVal >= 80) status = 'Hampir Penuh'
          
          return (
            <div key={posko.id} className="posko-card portal-card">
              <div className="posko-card-header">
                <div>
                  <strong>{posko.name}</strong>
                  <small>📍 {posko.address}</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                  <button 
                    type="button"
                    onClick={() => handleOpenEdit(posko)}
                    style={{ 
                      background: '#eff6ff', 
                      border: '1px solid #bfdbfe', 
                      color: '#2563eb', 
                      borderRadius: '6px',
                      cursor: 'pointer', 
                      fontSize: '0.78rem', 
                      padding: '3px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 700
                    }}
                    title="Edit informasi posko"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDeleteShelter(posko.id, posko.name)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px' }}
                    title="Hapus posko"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="posko-stats">
                <strong>{occCap} <small>/ {maxCap} jiwa</small></strong>
                <span className="pct" style={{ fontWeight: 'bold', color: pctVal >= 80 ? '#dc2626' : '#2563eb' }}>{pct}</span>
              </div>

              <div className="progress-bar-bg" style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden', margin: '8px 0' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${Math.min(pctVal, 100)}%`, 
                    background: pctVal >= 100 ? '#dc2626' : pctVal >= 80 ? '#f59e0b' : '#3b82f6',
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <div className="posko-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <span>PIC: <strong>{posko.contact_person || 'Petugas Posko'}</strong></span>
                  {posko.contact_phone && <div>📞 {posko.contact_phone}</div>}
                </div>
                <div className="stepper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    type="button"
                    onClick={() => handleUpdateCapacity(posko.id, occCap - 1, maxCap)}
                    disabled={occCap <= 0}
                    style={{ 
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px', 
                      border: '1.5px solid #cbd5e1', 
                      cursor: occCap <= 0 ? 'not-allowed' : 'pointer',
                      background: occCap <= 0 ? '#f8fafc' : '#ffffff',
                      color: occCap <= 0 ? '#94a3b8' : '#0f172a',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Kurangi 1 pengungsi"
                  >
                    −
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleUpdateCapacity(posko.id, occCap + 1, maxCap)}
                    disabled={occCap >= maxCap}
                    style={{ 
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px', 
                      border: '1.5px solid #cbd5e1', 
                      cursor: occCap >= maxCap ? 'not-allowed' : 'pointer', 
                      background: occCap >= maxCap ? '#f8fafc' : '#ffffff',
                      color: occCap >= maxCap ? '#94a3b8' : '#0284c7',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Tambah 1 pengungsi"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Tambah Posko */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Tambah Posko Pengungsian</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleAddShelter}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Nama Posko</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Balai Desa Baureno"
                    value={newShelter.name}
                    onChange={e => setNewShelter({ ...newShelter, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Alamat Lengkap</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Jl. Raya Baureno No. 12"
                    value={newShelter.address}
                    onChange={e => setNewShelter({ ...newShelter, address: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Desa</label>
                  <select 
                    value={newShelter.village_id}
                    onChange={e => setNewShelter({ ...newShelter, village_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {villages.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Kapasitas Total</label>
                    <input 
                      type="number" 
                      min="1"
                      required 
                      value={newShelter.capacity_total}
                      onChange={e => setNewShelter({ ...newShelter, capacity_total: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Terisi Awal</label>
                    <input 
                      type="number" 
                      min="0"
                      value={newShelter.capacity_occupied}
                      onChange={e => setNewShelter({ ...newShelter, capacity_occupied: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Penanggung Jawab (PIC)</label>
                    <input 
                      type="text" 
                      placeholder="Nama petugas"
                      value={newShelter.contact_person}
                      onChange={e => setNewShelter({ ...newShelter, contact_person: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Nomor Telepon</label>
                    <input 
                      type="tel" 
                      placeholder="08123456789"
                      value={newShelter.contact_phone}
                      onChange={e => setNewShelter({ ...newShelter, contact_phone: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Posko'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Edit Informasi Posko */}
      {showEditModal && editingShelter && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <span>✏️</span> Edit Informasi Posko
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingShelter(null)
                }} 
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveEditShelter}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                    Nama Posko Pengungsian *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={editingShelter.name}
                    onChange={e => setEditingShelter({ ...editingShelter, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                    Alamat Lengkap / Patokan *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={editingShelter.address}
                    onChange={e => setEditingShelter({ ...editingShelter, address: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                    Wilayah Desa Terkait *
                  </label>
                  <select 
                    value={editingShelter.village_id}
                    onChange={e => setEditingShelter({ ...editingShelter, village_id: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  >
                    {villages.map(v => (
                      <option key={v.id} value={v.id}>Desa {v.name.replace(/^Desa\s+/i, '')}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Kapasitas Maksimal (Jiwa) *
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      required 
                      value={editingShelter.capacity_total}
                      onChange={e => setEditingShelter({ ...editingShelter, capacity_total: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Pengungsi Terdata (Jiwa) *
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={editingShelter.capacity_occupied}
                      onChange={e => setEditingShelter({ ...editingShelter, capacity_occupied: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Penanggung Jawab (PIC)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Nama koordinator posko"
                      value={editingShelter.contact_person}
                      onChange={e => setEditingShelter({ ...editingShelter, contact_person: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      No. Telepon / WhatsApp
                    </label>
                    <input 
                      type="tel" 
                      placeholder="0812xxxxxxxx"
                      value={editingShelter.contact_phone}
                      onChange={e => setEditingShelter({ ...editingShelter, contact_phone: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Latitude GPS
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      required
                      value={editingShelter.latitude}
                      onChange={e => setEditingShelter({ ...editingShelter, latitude: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Longitude GPS
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      required
                      value={editingShelter.longitude}
                      onChange={e => setEditingShelter({ ...editingShelter, longitude: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingShelter(null)
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={editSubmitting}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)' }}
                  >
                    {editSubmitting ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
