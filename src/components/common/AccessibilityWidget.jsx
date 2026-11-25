import { useEffect, useRef } from 'react'
import { useAccessibility } from '../../context/AccessibilityContext'
import { IconStop, IconVolume } from './Icons'

export const AccessibilityIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="4.5" r="2" />
    <path d="M5 9.5h14" />
    <path d="M12 9.5v5.5" />
    <path d="M9 21l3-6 3 6" />
  </svg>
)

export default function AccessibilityWidget() {
  const {
    prefs,
    updatePref,
    resetPrefs,
    readCurrentScreen,
    stopSpeaking,
    isSpeaking,
    isPanelOpen,
    closePanel,
    togglePanel,
    speechSupported,
    vibrationSupported,
  } = useAccessibility()

  const panelRef = useRef(null)

  // Keyboard shortcut Alt+A to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        togglePanel()
      } else if (e.key === 'Escape' && isPanelOpen) {
        closePanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPanelOpen, togglePanel, closePanel])

  const handleSkipToContent = (e) => {
    e.preventDefault()
    const target =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('h1')
    if (target) {
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1')
      }
      target.focus()
      target.scrollIntoView({ behavior: prefs.reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content" onClick={handleSkipToContent}>
        Lewati ke konten utama
      </a>

      {isPanelOpen && (
        <div
          className="a11y-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePanel()
          }}
        >
          <section
            ref={panelRef}
            className="a11y-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Pengaturan Aksesibilitas SIGAB"
          >
            <div className="a11y-panel-header">
              <h2 className="a11y-panel-title">
                <AccessibilityIcon size={19} />
                <span>Pengaturan Aksesibilitas</span>
              </h2>
              <button
                type="button"
                className="a11y-close-btn"
                onClick={closePanel}
                aria-label="Tutup panel aksesibilitas"
              >
                ✕
              </button>
            </div>

            <div className="a11y-section">
              <span className="a11y-label">Ukuran Teks</span>
              <div className="a11y-font-group" role="group" aria-label="Ukuran Teks">
                {[
                  { id: 'normal', label: 'Normal' },
                  { id: 'large', label: 'Besar' },
                  { id: 'xlarge', label: 'Ekstra' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`a11y-pill-btn ${prefs.fontSize === opt.id ? 'active' : ''}`}
                    aria-pressed={prefs.fontSize === opt.id}
                    onClick={() => updatePref('fontSize', opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="a11y-section">
              <span className="a11y-label">Tampilan & Kenyamanan</span>
              <div className="a11y-toggle-list">
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.highContrast}
                  className={`a11y-toggle-item ${prefs.highContrast ? 'active' : ''}`}
                  onClick={() => updatePref('highContrast', !prefs.highContrast)}
                >
                  <div className="a11y-toggle-text">
                    <strong>Mode Kontras Tinggi</strong>
                    <span>Perjelas batas, fokus & teks luar ruang</span>
                  </div>
                  <span className="a11y-switch" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.readableSpacing}
                  className={`a11y-toggle-item ${prefs.readableSpacing ? 'active' : ''}`}
                  onClick={() => updatePref('readableSpacing', !prefs.readableSpacing)}
                >
                  <div className="a11y-toggle-text">
                    <strong>Spasi Baca Nyaman</strong>
                    <span>Jarak huruf & baris lebih renggang</span>
                  </div>
                  <span className="a11y-switch" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.reduceMotion}
                  className={`a11y-toggle-item ${prefs.reduceMotion ? 'active' : ''}`}
                  onClick={() => updatePref('reduceMotion', !prefs.reduceMotion)}
                >
                  <div className="a11y-toggle-text">
                    <strong>Kurangi Animasi</strong>
                    <span>Matikan efek gerak & transisi</span>
                  </div>
                  <span className="a11y-switch" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="a11y-section">
              <span className="a11y-label">Bantuan Darurat & Suara</span>
              <div className="a11y-toggle-list">
                {speechSupported && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.voiceEnabled}
                    className={`a11y-toggle-item ${prefs.voiceEnabled ? 'active' : ''}`}
                    onClick={() => updatePref('voiceEnabled', !prefs.voiceEnabled)}
                  >
                    <div className="a11y-toggle-text">
                      <strong>Pembaca Suara (ID)</strong>
                      <span>Bacakan status darurat & SOS</span>
                    </div>
                    <span className="a11y-switch" aria-hidden="true" />
                  </button>
                )}

                {vibrationSupported && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.vibrationEnabled}
                    className={`a11y-toggle-item ${prefs.vibrationEnabled ? 'active' : ''}`}
                    onClick={() => updatePref('vibrationEnabled', !prefs.vibrationEnabled)}
                  >
                    <div className="a11y-toggle-text">
                      <strong>Getar Darurat (HP)</strong>
                      <span>Pola getar saat peringatan/SOS</span>
                    </div>
                    <span className="a11y-switch" aria-hidden="true" />
                  </button>
                )}
              </div>

              {speechSupported && (
                <div className="a11y-voice-actions">
                  <button
                    type="button"
                    className="a11y-action-btn ui-inline-label"
                    style={{ justifyContent: 'center' }}
                    onClick={readCurrentScreen}
                  >
                    <IconVolume size={15} />
                    <span>Bacakan Layar Ini</span>
                  </button>
                  {isSpeaking && (
                    <button
                      type="button"
                      className="a11y-action-btn stop ui-inline-label"
                      style={{ justifyContent: 'center' }}
                      onClick={stopSpeaking}
                    >
                      <IconStop size={15} />
                      <span>Berhenti</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="a11y-panel-footer">
              <span>Pintasan: Alt + A</span>
              <button type="button" className="a11y-reset-btn" onClick={resetPrefs}>
                Reset Default
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
