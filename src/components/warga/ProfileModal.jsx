import { useState, useEffect, useRef } from 'react'
import { updateProfile } from '../../services/authService'

export default function ProfileModal({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
  geo,
  villages = [],
  startInEditMode = false,
}) {
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const [formData, setFormData] = useState({
    full_name: '',
    nik: '',
    phone: '',
    email: '',
    village_id: 3,
    address: '',
    family_count: 4,
    elderly_count: 1,
    toddler_count: 1,
    pregnant_count: 0,
    disabled_count: 0,
    notes: '',
    avatar_url: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [alertStatus, setAlertStatus] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setIsEditing(startInEditMode)
    }
  }, [isOpen, startInEditMode])

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || 'Warga Baureno (Demo)',
        nik: userProfile.nik || '3522141508890002',
        phone: userProfile.phone || userProfile.phone_number || '081234567890',
        email: userProfile.email || 'warga@baureno.id',
        village_id: userProfile.village_id || 3,
        address: userProfile.address || 'RT 03 / RW 01, Dusun Kauman',
        family_count: userProfile.family_count ?? 4,
        elderly_count: userProfile.elderly_count ?? 1,
        toddler_count: userProfile.toddler_count ?? 1,
        pregnant_count: userProfile.pregnant_count ?? 0,
        disabled_count: userProfile.disabled_count ?? 0,
        notes: userProfile.notes || 'Rumah lantai 2, dekat tanggul sungai',
        avatar_url: userProfile.avatar_url || '',
      })
    }
  }, [userProfile, isOpen])

  if (!isOpen) return null

  const selectedVillage = villages.find(v => v.id === Number(formData.village_id)) || {
    name: 'Baureno (Pusat)',
    latitude: -7.1282,
    longitude: 112.1039,
  }

  const getInitials = (name) => {
    if (!name) return 'WB'
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCounterChange = (field, delta) => {
    setFormData((prev) => {
      const current = Number(prev[field]) || 0
      const nextVal = Math.max(0, current + delta)
      return { ...prev, [field]: nextVal }
    })
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)

    if (!file.type.startsWith('image/')) {
      setPhotoError('Hanya file gambar (JPG, PNG, WebP) yang diperbolehkan.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Ukuran file maksimal 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 256
        let width = img.width
        let height = img.height

        const minDim = Math.min(width, height)
        const sx = (width - minDim) / 2
        const sy = (height - minDim) / 2

        canvas.width = MAX_SIZE
        canvas.height = MAX_SIZE

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, MAX_SIZE, MAX_SIZE)

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setFormData((prev) => ({ ...prev, avatar_url: compressedDataUrl }))
      }
      img.onerror = () => {
        setPhotoError('Gagal memproses gambar. Silakan coba file lain.')
      }
      img.src = event.target.result
    }
    reader.onerror = () => {
      setPhotoError('Gagal membaca file gambar.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, avatar_url: '' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    setAlertStatus(null)

    try {
      const payload = {
        full_name: formData.full_name.trim(),
        name: formData.full_name.trim(),
        nik: formData.nik.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        village_id: Number(formData.village_id),
        address: formData.address.trim(),
        family_count: Number(formData.family_count) || 1,
        elderly_count: Number(formData.elderly_count) || 0,
        toddler_count: Number(formData.toddler_count) || 0,
        pregnant_count: Number(formData.pregnant_count) || 0,
        disabled_count: Number(formData.disabled_count) || 0,
        notes: formData.notes.trim(),
        avatar_url: formData.avatar_url || '',
      }

      const updated = await updateProfile(payload)

      // Sinkronkan lokasi desa jika berubah
      if (geo && geo.setVillageLocation && payload.village_id) {
        const targetV = villages.find((v) => v.id === payload.village_id)
        if (targetV) geo.setVillageLocation(targetV)
      }

      if (onProfileUpdated) {
        onProfileUpdated(updated)
      }

      setAlertStatus({
        type: 'success',
        message: '✓ Profil dan data keluarga berhasil diperbarui!',
      })

      // Kembali ke mode tinjau setelah sukses
      setTimeout(() => {
        setIsEditing(false)
        setAlertStatus(null)
      }, 1200)
    } catch (err) {
      console.error('Gagal memperbarui profil:', err)
      setAlertStatus({
        type: 'error',
        message: 'Gagal menyimpan perubahan. Silakan coba lagi.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Hitung prioritas evakuasi berdasarkan kelompok rentan
  const hasVulnerable =
    Number(formData.elderly_count) > 0 ||
    Number(formData.toddler_count) > 0 ||
    Number(formData.pregnant_count) > 0 ||
    Number(formData.disabled_count) > 0

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="profile-modal-header">
          <h3>
            <span>👤</span>
            {isEditing ? 'Edit Profil & Data Warga' : 'Profil Warga & Rumah Tangga'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isEditing && (
              <button
                type="button"
                className="profile-quick-edit-btn"
                onClick={() => setIsEditing(true)}
                title="Buka form untuk mengedit profil"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                }}
              >
                <span>✏️</span> Edit Profil
              </button>
            )}
            <button
              type="button"
              className="profile-modal-close-btn"
              onClick={onClose}
              title="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Modal */}
        <div className="profile-modal-body">
          {alertStatus && (
            <div className={`profile-alert-banner ${alertStatus.type}`}>
              {alertStatus.message}
            </div>
          )}

          {!isEditing ? (
            /* ================= VIEW MODE ================= */
            <>
              <div className="profile-hero">
                <div className="profile-avatar-wrapper" style={{ position: 'relative' }}>
                  <div className="profile-avatar-circle-lg" style={{ overflow: 'hidden' }}>
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt={formData.full_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getInitials(formData.full_name)
                    )}
                  </div>
                  <button
                    type="button"
                    className="profile-avatar-camera-btn"
                    onClick={() => {
                      setIsEditing(true)
                      setTimeout(() => fileInputRef.current?.click(), 100)
                    }}
                    title="Klik untuk ganti foto profil"
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: '2px solid #ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    📷
                  </button>
                </div>
                <div className="profile-hero-info">
                  <strong>{formData.full_name}</strong>
                  <div className="profile-hero-meta">
                    <span>NIK: {formData.nik}</span>
                    <span>•</span>
                    <span>📞 {formData.phone}</span>
                  </div>
                  <div className="profile-verified-badge">
                    ✓ Terverifikasi BPBD Baureno
                  </div>
                </div>
              </div>

              <div className="profile-grid-2">
                <div className="profile-info-card">
                  <div className="profile-info-label">
                    <span>📍</span> Kecamatan &amp; Desa
                  </div>
                  <div className="profile-info-value">
                    Desa {selectedVillage.name.replace(' (Pusat)', '')}
                  </div>
                  <div className="profile-info-sub">
                    Kecamatan Baureno
                  </div>
                </div>

                <div className="profile-info-card">
                  <div className="profile-info-label">
                    <span>🏠</span> Alamat Domisili
                  </div>
                  <div className="profile-info-value">
                    {formData.address || 'Belum diisi'}
                  </div>
                  <div className="profile-info-sub">
                    {selectedVillage.latitude?.toFixed(4)}, {selectedVillage.longitude?.toFixed(4)}
                  </div>
                </div>

                <div className="profile-info-card">
                  <div className="profile-info-label">
                    <span>👨‍👩‍👧‍👦</span> Jumlah Keluarga
                  </div>
                  <div className="profile-info-value">
                    {formData.family_count} Jiwa
                  </div>
                  <div className="profile-info-sub">
                    Prioritas:{' '}
                    <strong style={{ color: hasVulnerable ? '#dc2626' : '#16a34a' }}>
                      {hasVulnerable ? 'Prioritas Tinggi (Rentan)' : 'Standar'}
                    </strong>
                  </div>
                </div>

                <div className="profile-info-card">
                  <div className="profile-info-label">
                    <span>🛡️</span> Kelompok Rentan
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {Number(formData.elderly_count) > 0 && (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                        👴 {formData.elderly_count} Lansia
                      </span>
                    )}
                    {Number(formData.toddler_count) > 0 && (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                        👶 {formData.toddler_count} Balita
                      </span>
                    )}
                    {Number(formData.pregnant_count) > 0 && (
                      <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                        🤰 {formData.pregnant_count} Ibu Hamil
                      </span>
                    )}
                    {Number(formData.disabled_count) > 0 && (
                      <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                        ♿ {formData.disabled_count} Disabilitas
                      </span>
                    )}
                    {!hasVulnerable && (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        Tidak ada anggota rentan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {formData.notes && (
                <div className="profile-info-card" style={{ marginBottom: '14px' }}>
                  <div className="profile-info-label">
                    <span>📝</span> Catatan Khusus Evakuasi / Riwayat Medis
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
                    {formData.notes}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSubmit}>
              {/* Seksi Ganti Foto Profil */}
              <div className="profile-form-section profile-avatar-edit-section">
                <div className="profile-section-title">
                  <span>📷</span> Foto Profil Warga
                </div>
                <div className="profile-avatar-upload-box" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '14px',
                  flexWrap: 'wrap'
                }}>
                  <div className="profile-avatar-circle-lg" style={{ overflow: 'hidden', flexShrink: 0 }}>
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt={formData.full_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getInitials(formData.full_name)
                    )}
                  </div>
                  <div className="profile-avatar-upload-actions" style={{ flex: 1, minWidth: '200px' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePhotoSelect}
                    />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="profile-btn-upload-photo"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>📷</span> {formData.avatar_url ? 'Ganti Foto' : 'Unggah Foto'}
                      </button>
                      {formData.avatar_url && (
                        <button
                          type="button"
                          className="profile-btn-remove-photo"
                          onClick={handleRemovePhoto}
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '7px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>🗑️</span> Hapus Foto
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px' }}>
                      Pilih foto JPG, PNG, atau WebP (otomatis dipotong persegi & dioptimalkan).
                    </div>
                    {photoError && (
                      <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                        ⚠️ {photoError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seksi Identitas Diri */}
              <div className="profile-form-section">
                <div className="profile-section-title">
                  <span>👤</span> Data Identitas Diri
                </div>
                <div className="profile-form-grid">
                  <div className="profile-form-group">
                    <label>Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label>NIK (16 Digit) *</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.nik}
                      onChange={(e) => handleInputChange('nik', e.target.value.replace(/\D/g, ''))}
                      placeholder="3522xxxxxxxxxxxx"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label>Nomor WhatsApp / HP *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="0812xxxxxxxx"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label>Email Terdaftar</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="email@baureno.id"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi Domisili & Lokasi */}
              <div className="profile-form-section">
                <div className="profile-section-title">
                  <span>📍</span> Lokasi Domisili &amp; Koordinat GPS
                </div>

                {/* Quick Real GPS Device Toggle */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                      🎯 Sinkronkan dengan GPS Nyata Perangkat
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#15803d', marginTop: '2px' }}>
                      {geo?.isRealDevice 
                        ? `Koordinat nyata terdeteksi: ${geo.latitude?.toFixed(4)}, ${geo.longitude?.toFixed(4)}`
                        : 'Kunci koordinat GPS perangkat Anda untuk akurasi rute evakuasi & sinyal SOS'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (geo?.useRealDeviceLocation) {
                        geo.useRealDeviceLocation()
                      }
                    }}
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
                    {geo?.isRealDevice ? '✓ GPS Aktif' : 'Gunakan GPS Device'}
                  </button>
                </div>

                <div className="profile-form-grid">
                  <div className="profile-form-group">
                    <label>Desa Domisili (25 Desa Baureno) *</label>
                    <select
                      value={formData.village_id}
                      onChange={(e) => handleInputChange('village_id', Number(e.target.value))}
                    >
                      {villages.map((v) => (
                        <option key={v.id} value={v.id}>
                          Desa {v.name.replace(/^Desa\s+/i, '')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="profile-form-group">
                    <label>Alamat Lengkap / RT / RW / Dusun *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Contoh: RT 02 / RW 01, Dusun Krajan"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi Rumah Tangga & Kerentanan */}
              <div className="profile-form-section">
                <div className="profile-section-title">
                  <span>👨‍👩‍👧‍👦</span> Data Keluarga &amp; Prioritas Evakuasi
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <div className="profile-form-group">
                    <label>Total Jumlah Anggota Keluarga (Jiwa)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        style={{ maxWidth: '120px' }}
                        value={formData.family_count}
                        onChange={(e) => handleInputChange('family_count', Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Termasuk kepala keluarga &amp; anggota serumah
                      </span>
                    </div>
                  </div>
                </div>

                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Rincian Anggota Keluarga Rentan:
                </label>
                
                <div className="profile-vulnerable-grid">
                  <div className="profile-counter-card">
                    <span className="profile-counter-label">👴 Lansia (&gt;60 thn)</span>
                    <div className="profile-counter-controls">
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('elderly_count', -1)}
                      >
                        -
                      </button>
                      <span className="profile-counter-num">{formData.elderly_count}</span>
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('elderly_count', 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="profile-counter-card">
                    <span className="profile-counter-label">👶 Balita (&lt;5 thn)</span>
                    <div className="profile-counter-controls">
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('toddler_count', -1)}
                      >
                        -
                      </button>
                      <span className="profile-counter-num">{formData.toddler_count}</span>
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('toddler_count', 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="profile-counter-card">
                    <span className="profile-counter-label">🤰 Ibu Hamil/Menyusui</span>
                    <div className="profile-counter-controls">
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('pregnant_count', -1)}
                      >
                        -
                      </button>
                      <span className="profile-counter-num">{formData.pregnant_count}</span>
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('pregnant_count', 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="profile-counter-card">
                    <span className="profile-counter-label">♿ Disabilitas/Sakit Berat</span>
                    <div className="profile-counter-controls">
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('disabled_count', -1)}
                      >
                        -
                      </button>
                      <span className="profile-counter-num">{formData.disabled_count}</span>
                      <button
                        type="button"
                        className="profile-counter-btn"
                        onClick={() => handleCounterChange('disabled_count', 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seksi Catatan Tambahan */}
              <div className="profile-form-section">
                <div className="profile-form-group full-width">
                  <label>📝 Catatan Khusus Evakuasi / Riwayat Medis</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Contoh: Butuh bantuan perahu evakuasi karena lansia tidak bisa jalan, rumah lantai 2..."
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="profile-modal-footer">
          {!isEditing ? (
            <>
              <button
                type="button"
                className="profile-btn-secondary"
                onClick={onClose}
              >
                Tutup
              </button>
              <button
                type="button"
                className="profile-btn-primary"
                onClick={() => setIsEditing(true)}
              >
                <span>✏️</span> Edit Profil &amp; Data Warga
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="profile-btn-secondary"
                onClick={() => {
                  setIsEditing(false)
                  setAlertStatus(null)
                }}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="button"
                className="profile-btn-primary"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>Menyimpan...</>
                ) : (
                  <>
                    <span>💾</span> Simpan Perubahan
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
