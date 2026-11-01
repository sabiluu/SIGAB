import AuthPage from '../../pages/AuthPage'
import './mobile.css'

export default function MobileAuthPage({ initialMode, initialRole }) {
  return (
    <div className="mobile-auth-page">
      <AuthPage initialMode={initialMode} initialRole={initialRole} />
      <p className="mobile-auth-footer">SIGAB · Siaga Banjir Bojonegoro</p>
    </div>
  )
}
