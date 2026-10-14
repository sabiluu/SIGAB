import { useState, useEffect } from 'react'
import { ErrorState, LoadingState } from '../components/common/AsyncState'
import { login, register } from '../services/authService'
import { getVillages } from '../services/floodService'

const assetPathPrefix = 'https://www.figma.com/api/mcp/asset/187de7f3-3e0e-42e4-9bfe-938d4a46eeaf'
const icons = {
  brand: `data:image/svg+xml;utf8,${encodeURIComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#2563eb"/><path d="M4 8c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`,
  user: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>')}`,
  petugas: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>')}`,
}

const DEFAULT_VILLAGES = [
  { id: 1, name: 'Banjaran' }, { id: 2, name: 'Banjaranyar' }, { id: 3, name: 'Baureno' },
  { id: 4, name: 'Blongsong' }, { id: 5, name: 'Bumiayu' }, { id: 6, name: 'Drajat' },
  { id: 7, name: 'Gajah' }, { id: 8, name: 'Gunungsari' }, { id: 9, name: 'Kalisari' },
  { id: 10, name: 'Karangdayu' }, { id: 11, name: 'Kauman' }, { id: 12, name: 'Kedungrejo' },
  { id: 13, name: 'Lebaksari' }, { id: 14, name: 'Ngemplak' }, { id: 15, name: 'Pasinan' },
  { id: 16, name: 'Pomahan' }, { id: 17, name: 'Pucangarum' }, { id: 18, name: 'Selorejo' },
  { id: 19, name: 'Sembunglor' }, { id: 20, name: 'Sraturejo' }, { id: 21, name: 'Sumuragung' },
  { id: 22, name: 'Tanggungan' }, { id: 23, name: 'Tlogoagung' }, { id: 24, name: 'Trojalu' },
  { id: 25, name: 'Tulungagung' }
]

function AuthPage({ initialMode = 'login', initialRole = 'warga' }) {
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [villages, setVillages] = useState(DEFAULT_VILLAGES)
  const isRegister = mode === 'register'

  useEffect(() => {
    getVillages()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Take first 25 unique villages
          const unique = []
          const seen = new Set()
          for (const item of data) {
            const cleanName = item.name.replace(/^Desa\s+/i, '')
            if (!seen.has(cleanName)) {
              seen.add(cleanName)
              unique.push({ id: item.id, name: cleanName })
            }
            if (unique.length >= 25) break
          }
          setVillages(unique)
        }
      })
      .catch(() => {})
  }, [])

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    window.history.replaceState(null, '', `#${nextMode === 'login' ? 'masuk' : 'daftar'}-${role}`)
  }

  function switchRole(nextRole) {
    setRole(nextRole)
    setError('')
    window.history.replaceState(null, '', `#${mode === 'login' ? 'masuk' : 'daftar'}-${nextRole}`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const formData = Object.fromEntries(new FormData(event.currentTarget))
    
    // Validasi NIK jika warga register
    if (isRegister && role === 'warga' && formData.nik && formData.nik.length < 16) {
      setError('NIK harus terdiri dari minimal 16 digit.')
      setSubmitting(false)
      return
    }

    try {
      const response = isRegister
        ? await register({ ...formData, role })
        : await login(formData.email, formData.password, role)
      const target = response?.user?.role || role
      window.location.hash = target === 'admin' || target === 'petugas' ? '#petugas' : '#warga'
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero"><div className="auth-brand"><span><img src={icons.brand} alt="" /></span><strong>SiagaBencana<small>Sistem Peringatan Dini Banjir</small></strong></div><div className="auth-hero-copy"><h1>Selamat datang di garda terdepan kesiapsiagaan banjir.</h1><p>Pantau risiko banjir real-time, terima peringatan dini, dan minta bantuan evakuasi langsung dari genggaman Anda.</p><ul><li>✓ <span>Peringatan dini berbasis debit Bengawan Solo & BMKG</span></li><li>✓ <span>Rute evakuasi & tombol SOS saat darurat</span></li><li>✓ <span>Terhubung langsung dengan Pusdalops BPBD</span></li></ul></div><small className="auth-copyright">© 2026 SiagaBencana</small></section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <a href="#" className="auth-back">← Kembali ke Beranda</a>
          <div className="auth-tabs">
            <button className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')} type="button">Masuk</button>
            <button className={isRegister ? 'active' : ''} onClick={() => switchMode('register')} type="button">Daftar</button>
          </div>
          <h2>{isRegister ? 'Buat akun baru' : 'Masuk ke akun Anda'}</h2>
          <p className="auth-subtitle">{isRegister ? 'Daftar untuk menerima peringatan dini banjir.' : 'Lanjutkan memantau kondisi wilayah Anda.'}</p>
          <div className="role-switch">
            <button className={role === 'warga' ? 'selected' : ''} onClick={() => switchRole('warga')} type="button">
              <span><img src={icons.user} alt="" /></span><strong>Warga</strong><small>Publik / masyarakat</small>
            </button>
            <button className={role === 'petugas' ? 'selected' : ''} onClick={() => switchRole('petugas')} type="button">
              <span><img src={icons.petugas} alt="" /></span><strong>Petugas BPBD</strong><small>Pusdalops / admin</small>
            </button>
          </div>
          {error && <ErrorState message={error} onRetry={() => setError('')} />}
          <form onSubmit={handleSubmit}>
            {isRegister ? (
              role === 'warga' ? (
                <>
                  <label className="auth-field"><input name="name" type="text" placeholder="Nama lengkap" required autoComplete="name" /></label>
                  <label className="auth-field"><input name="nik" type="text" placeholder="NIK (16 digit)" required minLength={16} maxLength={16} /></label>
                  <label className="auth-field"><input name="phone" type="tel" placeholder="Nomor telepon (WhatsApp)" required /></label>
                  <label className="auth-field">
                    <select name="village_id" required defaultValue="">
                      <option value="" disabled>Pilih Desa Domisili (Kec. Baureno)</option>
                      {villages.map((v) => (
                        <option key={v.id} value={v.id}>Desa {v.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="auth-field"><input name="email" type="email" placeholder="Email" required autoComplete="email" /></label>
                  <label className="auth-field"><input name="password" type="password" placeholder="Kata sandi (minimal 6 karakter)" required minLength={6} autoComplete="new-password" /></label>
                </>
              ) : (
                <>
                  <label className="auth-field"><input name="name" type="text" placeholder="Nama lengkap petugas" required autoComplete="name" /></label>
                  <label className="auth-field"><input name="phone" type="tel" placeholder="Nomor telepon dinas" required /></label>
                  <label className="auth-field"><input name="employeeId" type="text" placeholder="NIP / Kode Petugas Pusdalops" required /></label>
                  <label className="auth-field"><input name="email" type="email" placeholder="Email dinas (@bpbd.go.id)" required autoComplete="email" /></label>
                  <label className="auth-field"><input name="password" type="password" placeholder="Kata sandi" required minLength={6} autoComplete="new-password" /></label>
                </>
              )
            ) : (
              <>
                <label className="auth-field"><input name="email" type="email" placeholder={role === 'petugas' ? 'Email dinas BPBD' : 'Email warga'} required autoComplete="username" /></label>
                <label className="auth-field"><input name="password" type="password" placeholder="Kata sandi" required autoComplete="current-password" /></label>
                <div className="auth-options"><label><input type="checkbox" defaultChecked /> Ingat saya</label><a href="#lupa-sandi">Lupa sandi?</a></div>
              </>
            )}
            {submitting ? <LoadingState label="Menghubungkan ke server..." /> : <button className="auth-submit" type="submit">{isRegister ? 'Daftar Sekarang' : 'Masuk'} <span>→</span></button>}
          </form>
          <p className="auth-switch">
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
            <button type="button" onClick={() => switchMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Masuk di sini' : 'Daftar di sini'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default AuthPage