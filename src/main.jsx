import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'
import './styles/auth.css'
import './styles/role-home.css'
import './styles/warga-portal.css'
import './styles/admin-custom.css'
import './styles/landing.css'
import './styles/accessibility.css'
import { AuthProvider } from './context/AuthContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import AccessibilityWidget from './components/common/AccessibilityWidget'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <App />
          <AccessibilityWidget />
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  </StrictMode>,
)
