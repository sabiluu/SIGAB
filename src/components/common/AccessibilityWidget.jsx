import { useEffect, useRef, useState } from 'react'
import { useAccessibility } from '../../context/AccessibilityContext'

const A11yIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
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
    activeCount,
    speechSupported,
    vibrationSupported,
  } = useAccessibility()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // Keyboard shortcut Alt+A to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

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

      <div className="a11y-root">
        {open && (
          <section
            ref={panelRef}
            className="a11y-panel"
            role="dialog"
            aria-label="Pengaturan Aksesibilitas SIGAB"
          >
            <div className="a11y-panel-header">
              <h2 className="a11y-panel-title">
                <A11yIcon />
                <span>Aksesibilitas</span>
              </h2>
              <button
                type="button"
                className="a11y-close-btn"
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
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
                    className="a11y-action-btn"
                    onClick={readCurrentScreen}
                  >
                    🔊 Bacakan Layar Ini
                  </button>
                  {isSpeaking && (
                    <button
                      type="button"
                      className="a11y-action-btn stop"
                      onClick={stopSpeaking}
                    >
                      ⏹ Berhenti
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
        )}

        <button
          ref={triggerRef}
          type="button"
          className="a11y-fab"
          aria-label="Buka Pengaturan Aksesibilitas"
          aria-expanded={open}
          title="Aksesibilitas (Alt + A)"
          onClick={() => setOpen((prev) => !prev)}
        >
          <A11yIcon />
          <span className="a11y-fab-label">Aksesibilitas</span>
          {activeCount > 0 && <span className="a11y-fab-badge">{activeCount}</span>}
        </button>
      </div>
    </>
  )
}
