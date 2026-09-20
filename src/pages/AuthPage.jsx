import { useState } from 'react'
import { ErrorState, LoadingState } from '../components/common/AsyncState'
import { login, register } from '../services/authService'

const assetPathPrefix = 'https://www.figma.com/api/mcp/asset/187de7f3-3e0e-42e4-9bfe-938d4a46eeaf'
const icons = {
  brand: `${assetPathPrefix}/fca0f.svg`,
  user: `${assetPathPrefix}/f7d97.svg`,
  petugas: `${assetPathPrefix}/a12f6.svg`,
}

const registerFields = {
  warga: [
    ['name', 'Nama lengkap'],
    ['nik', 'NIK (16 digit)'],
    ['phone', 'Nomor telepon'],
    ['village', 'Desa / dusun tempat tinggal'],
    ['email', 'Email'],
    ['password', 'Kata sandi'],
  ],
  petugas: [
    ['name', 'Nama lengkap'],
    ['phone', 'Nomor telepon'],
    ['employeeId', 'NIP / kode petugas'],
    ['email', 'Email dinas'],
    ['password', 'Kata sandi'],
  ],
}

function AuthPage({ initialMode = 'login', initialRole = 'warga' }) {
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isRegister = mode === 'register'
  const fields = isRegister ? registerFields[role] : [['email', role === 'petugas' ? 'Email dinas' : 'Email'], ['password', 'Kata sandi']]

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
    try {
      const response = isRegister
        ? await register({ ...formData, role })
        : await login(formData.email, formData.password)
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
      <section className="auth-hero"><div className="auth-brand"><span><img src={icons.brand} alt="" /></span><strong>SiagaBencana<small>Sistem Peringatan Dini Banjir</small></strong></div><div className="auth-hero-copy"><h1>Selamat datang di garda terdepan kesiapsiagaan banjir.</h1><p>Pantau risiko banjir real-time, terima peringatan dini, dan minta bantuan evakuasi langsung dari genggaman Anda.</p><ul><li>✓ <span>Peringatan dini berbasis debit Bengawan Solo & BMKG</span></li><li>✓ <span>Rute evakuasi & tombol SOS saat darurat</span></li><li>✓ <span>Terhubung langsung dengan Pusdalops BPBD</span></li></ul></div><small className="auth-copyright">© 2026 BPBD Bojonegoro &nbsp; • &nbsp; PRD v3.0</small></section>
      <section className="auth-panel"><div className="auth-form-wrap"><div className="auth-tabs"><button className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')} type="button">Masuk</button><button className={isRegister ? 'active' : ''} onClick={() => switchMode('register')} type="button">Daftar</button></div><h2>{isRegister ? 'Buat akun baru' : 'Masuk ke akun Anda'}</h2><p className="auth-subtitle">{isRegister ? 'Daftar untuk menerima peringatan dini banjir.' : 'Lanjutkan memantau kondisi wilayah Anda.'}</p><div className="role-switch"><button className={role === 'warga' ? 'selected' : ''} onClick={() => switchRole('warga')} type="button"><span><img src={icons.user} alt="" /></span><strong>Warga</strong><small>Publik / masyarakat</small></button><button className={role === 'petugas' ? 'selected' : ''} onClick={() => switchRole('petugas')} type="button"><span><img src={icons.petugas} alt="" /></span><strong>Petugas BPBD</strong><small>Pusdalops / admin</small></button></div>{error && <ErrorState message={error} onRetry={() => setError('')} />}<form onSubmit={handleSubmit}>{fields.map(([name, label]) => <label className="auth-field" key={name}><input name={name} type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'} placeholder={label} autoComplete="off" required /></label>)}{!isRegister && <div className="auth-options"><label><input type="checkbox" /> Ingat saya</label><a href="#lupa-sandi">Lupa sandi?</a></div>}{submitting ? <LoadingState label="Menghubungkan ke server..." /> : <button className="auth-submit" type="submit">{isRegister ? 'Daftar Sekarang' : 'Masuk'} <span>→</span></button>}</form><p className="auth-switch">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} <button type="button" onClick={() => switchMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Masuk di sini' : 'Daftar di sini'}</button></p></div></section>
    </main>
  )
}

export default AuthPage