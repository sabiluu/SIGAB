import { useState, useEffect } from 'react'
import { ErrorState, LoadingState } from '../components/common/AsyncState'
import { login, register } from '../services/authService'
import { getVillages } from '../services/floodService'
import '../styles/auth.css'

const SVG_ICONS = {
  brandWave: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
      <path d="M3 7c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
      <path d="M3 12c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
      <path d="M3 17c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0 4.5-1.5 5 0" />
    </svg>
  ),
  close: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
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
  const [rememberMe, setRememberMe] = useState(true)
  const [villages, setVillages] = useState(DEFAULT_VILLAGES)
  const [loginEmail, setLoginEmail] = useState(initialRole === 'petugas' ? 'admin@bpbd.go.id' : 'warga@baureno.id')
  const [loginPassword, setLoginPassword] = useState(initialRole === 'petugas' ? 'admin123' : 'warga123')
  const [showPassword, setShowPassword] = useState(false)
  
  const isRegister = mode === 'register'

  function fillDemoCredentials() {
    setError('')
    if (role === 'petugas') {
      setLoginEmail('admin@bpbd.go.id')
      setLoginPassword('admin123')
    } else {
      setLoginEmail('warga@baureno.id')
      setLoginPassword('warga123')
    }
  }

  useEffect(() => {
    getVillages()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
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
    if (nextRole === 'petugas') {
      setLoginEmail('admin@bpbd.go.id')
      setLoginPassword('admin123')
    } else {
      setLoginEmail('warga@baureno.id')
      setLoginPassword('warga123')
    }
    window.history.replaceState(null, '', `#${mode === 'login' ? 'masuk' : 'daftar'}-${nextRole}`)
  }

  function handleClose() {
    window.location.hash = ''
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
      setError(requestError.message || 'Terjadi kesalahan saat memproses permintaan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-modal-backdrop">
      {/* Blurred overlay */}
      <div className="auth-backdrop-overlay" onClick={handleClose} />

      {/* Centered Modal Card */}
      <div className="auth-modal-card" role="dialog" aria-modal="true">
        {/* Header: Logo, Brand Text, and Close Button */}
        <div className="auth-header">
          <div className="auth-brand-wrap">
            <div className={`auth-brand-icon ${role === 'petugas' ? 'admin' : ''}`}>
              {SVG_ICONS.brandWave}
            </div>
            <div className="auth-brand-text">
              <strong>SIGAB</strong>
              <span>{role === 'petugas' ? 'Pusdalops BPBD Baureno' : 'Siaga Banjir Baureno'}</span>
            </div>
          </div>
          <button 
            type="button" 
            className="auth-close-btn" 
            onClick={handleClose} 
            aria-label="Tutup modal"
          >
            {SVG_ICONS.close}
          </button>
        </div>

        {/* Title Area: Kicker, Heading, and Subtitle */}
        <div className="auth-title-area">
          <span className="auth-kicker">
            {isRegister ? 'BERGABUNG DENGAN SIGAB' : 'SELAMAT DATANG KEMBALI'}
          </span>
          <h1 className="auth-heading">
            {isRegister ? 'Buat akun baru' : 'Masuk ke akun Anda'}
          </h1>
          <p className="auth-subtitle">
            {isRegister 
              ? 'Daftar untuk menerima peringatan dini dan bantuan evakuasi.' 
              : 'Akses informasi wilayah dan layanan darurat SIGAB.'}
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="auth-role-tabs">
          <button
            type="button"
            className={`auth-role-tab ${role === 'warga' ? 'active' : ''}`}
            onClick={() => switchRole('warga')}
          >
            {SVG_ICONS.user}
            <span>Warga</span>
          </button>
          <button
            type="button"
            className={`auth-role-tab ${role === 'petugas' ? 'active' : ''}`}
            onClick={() => switchRole('petugas')}
          >
            {SVG_ICONS.shield}
            <span>Petugas BPBD</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && <ErrorState message={error} onRetry={() => setError('')} />}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister ? (
            /* ================= REGISTER FORMS ================= */
            role === 'warga' ? (
              /* Register Warga */
              <>
                <div className="auth-field">
                  <label htmlFor="reg-name">Nama lengkap</label>
                  <input 
                    id="reg-name" 
                    name="name" 
                    type="text" 
                    placeholder="Masukkan nama lengkap" 
                    required 
                    autoComplete="name" 
                  />
                </div>

                <div className="auth-fields-row">
                  <div className="auth-field">
                    <label htmlFor="reg-nik">NIK</label>
                    <input 
                      id="reg-nik" 
                      name="nik" 
                      type="text" 
                      placeholder="16 digit NIK" 
                      required 
                      minLength={16} 
                      maxLength={16} 
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="reg-phone">No. WhatsApp</label>
                    <input 
                      id="reg-phone" 
                      name="phone" 
                      type="tel" 
                      placeholder="08xx" 
                      required 
                      autoComplete="tel" 
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-village">Desa domisili</label>
                  <select id="reg-village" name="village_id" required defaultValue="">
                    <option value="" disabled>Pilih desa di Kec. Baureno</option>
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>Desa {v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-email">Email</label>
                  <input 
                    id="reg-email" 
                    name="email" 
                    type="email" 
                    placeholder="nama@email.com" 
                    required 
                    autoComplete="email" 
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-pwd">Kata sandi</label>
                  <div className="auth-password-wrapper">
                    <input 
                      id="reg-pwd" 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Minimal 6 karakter" 
                      required 
                      minLength={6} 
                      autoComplete="new-password" 
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? SVG_ICONS.eye : SVG_ICONS.eyeOff}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Register Petugas BPBD */
              <>
                <div className="auth-field">
                  <label htmlFor="petugas-name">Nama lengkap petugas</label>
                  <input 
                    id="petugas-name" 
                    name="name" 
                    type="text" 
                    placeholder="Masukkan nama lengkap" 
                    required 
                    autoComplete="name" 
                  />
                </div>

                <div className="auth-fields-row">
                  <div className="auth-field">
                    <label htmlFor="petugas-code">NIP / Kode</label>
                    <input 
                      id="petugas-code" 
                      name="employeeId" 
                      type="text" 
                      placeholder="Kode Pusdalops" 
                      required 
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="petugas-phone">Telepon dinas</label>
                    <input 
                      id="petugas-phone" 
                      name="phone" 
                      type="tel" 
                      placeholder="08xx" 
                      required 
                      autoComplete="tel" 
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="petugas-email">Email dinas</label>
                  <input 
                    id="petugas-email" 
                    name="email" 
                    type="email" 
                    placeholder="nama@bpbd.go.id" 
                    required 
                    autoComplete="email" 
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="petugas-pwd">Kata sandi</label>
                  <div className="auth-password-wrapper">
                    <input 
                      id="petugas-pwd" 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Minimal 6 karakter" 
                      required 
                      minLength={6} 
                      autoComplete="new-password" 
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? SVG_ICONS.eye : SVG_ICONS.eyeOff}
                    </button>
                  </div>
                </div>
              </>
            )
          ) : (
            /* ================= LOGIN FORMS ================= */
            <>
              <div className="auth-demo-hint">
                <div className="auth-demo-info">
                  <span className="auth-demo-badge">Akun Uji Coba {role === 'petugas' ? 'Petugas' : 'Warga'}</span>
                  <span className="auth-demo-text">
                    {role === 'petugas' ? 'admin@bpbd.go.id • admin123' : 'warga@baureno.id • warga123'}
                  </span>
                </div>
                <button type="button" className="auth-demo-btn" onClick={fillDemoCredentials}>
                  Isi Cepat
                </button>
              </div>

              <div className="auth-field">
                <label htmlFor="login-email">
                  {role === 'petugas' ? 'Email dinas' : 'Email'}
                </label>
                <input 
                  id="login-email" 
                  name="email" 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={role === 'petugas' ? 'admin@bpbd.go.id' : 'warga@baureno.id'} 
                  required 
                  autoComplete="username" 
                />
              </div>

              <div className="auth-field">
                <label htmlFor="login-pwd">Kata sandi</label>
                <div className="auth-password-wrapper">
                  <input 
                    id="login-pwd" 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi" 
                    required 
                    autoComplete="current-password" 
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? SVG_ICONS.eye : SVG_ICONS.eyeOff}
                  </button>
                </div>
              </div>

              <div className="auth-options-row">
                <label className="auth-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span>Ingat saya</span>
                </label>
                <a href="#lupa-sandi" className="auth-forgot-link">
                  Lupa kata sandi?
                </a>
              </div>
            </>
          )}

          {/* Submit Button */}
          {submitting ? (
            <LoadingState label="Menghubungkan ke server..." />
          ) : (
            <button className="auth-submit-btn" type="submit">
              <span>{isRegister ? 'Daftar sekarang' : 'Masuk ke SIGAB'}</span>
              {SVG_ICONS.arrowRight}
            </button>
          )}
        </form>

        {/* Footer Prompt */}
        <div className="auth-footer-prompt">
          {isRegister ? (
            <>
              Sudah punya akun?{' '}
              <button 
                type="button" 
                className="auth-link-teal" 
                onClick={() => switchMode('login')}
              >
                Masuk di sini
              </button>
            </>
          ) : (
            <>
              Belum punya akun?{' '}
              <button 
                type="button" 
                className="auth-link-teal" 
                onClick={() => switchMode('register')}
              >
                {role === 'petugas' ? 'Daftar sebagai petugas' : 'Daftar sebagai warga'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthPage