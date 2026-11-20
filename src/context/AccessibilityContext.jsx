import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'sigab_a11y_prefs'

const DEFAULT_PREFS = {
  fontSize: 'normal', // 'normal' | 'large' | 'xlarge'
  highContrast: false,
  reduceMotion: false,
  readableSpacing: false,
  voiceEnabled: false,
  vibrationEnabled: true,
}

const AccessibilityContext = createContext(null)

function loadInitialPrefs() {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
    }
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return { ...DEFAULT_PREFS, reduceMotion: prefersReduced }
  } catch {
    return DEFAULT_PREFS
  }
}

export function AccessibilityProvider({ children }) {
  const [prefs, setPrefs] = useState(loadInitialPrefs)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  // Persist preferences and sync classes to <html>
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Ignore storage quota errors
    }

    const root = document.documentElement
    root.classList.remove('a11y-font-large', 'a11y-font-xlarge')
    if (prefs.fontSize === 'large') root.classList.add('a11y-font-large')
    if (prefs.fontSize === 'xlarge') root.classList.add('a11y-font-xlarge')

    root.classList.toggle('a11y-high-contrast', Boolean(prefs.highContrast))
    root.classList.toggle('a11y-reduce-motion', Boolean(prefs.reduceMotion))
    root.classList.toggle('a11y-readable-spacing', Boolean(prefs.readableSpacing))
  }, [prefs])

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const announce = useCallback((message) => {
    setAnnouncement('')
    requestAnimationFrame(() => setAnnouncement(message))
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [])

  const speak = useCallback(
    (text, { interrupt = true, force = false } = {}) => {
      if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return false
      if (!force && !prefs.voiceEnabled) return false

      try {
        const synth = window.speechSynthesis
        if (interrupt) synth.cancel()

        const utterance = new SpeechSynthesisUtterance(String(text).trim())
        utterance.lang = 'id-ID'
        utterance.rate = 0.98
        utterance.pitch = 1

        const voices = synth.getVoices?.() || []
        const idVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('id'))
        if (idVoice) utterance.voice = idVoice

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        synth.speak(utterance)
        return true
      } catch {
        setIsSpeaking(false)
        return false
      }
    },
    [prefs.voiceEnabled],
  )

  const readCurrentScreen = useCallback(() => {
    if (typeof document === 'undefined') return false
    const selection = window.getSelection?.()?.toString()?.trim()
    if (selection) {
      return speak(selection, { interrupt: true, force: true })
    }

    const container =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.getElementById('root')

    if (!container) return false

    const heading = container.querySelector('h1, h2')?.textContent?.trim() || 'SIGAB Baureno'
    const rawText = (container.innerText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 650)

    const summary = rawText ? `${heading}. ${rawText}` : heading
    return speak(summary, { interrupt: true, force: true })
  }, [speak])

  const vibrate = useCallback(
    (pattern = [180, 90, 180]) => {
      if (!prefs.vibrationEnabled) return false
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          return navigator.vibrate(pattern)
        } catch {
          return false
        }
      }
      return false
    },
    [prefs.vibrationEnabled],
  )

  const updatePref = useCallback(
    (key, value) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value }
        if (key === 'voiceEnabled' && !value) {
          stopSpeaking()
        }
        return next
      })
    },
    [stopSpeaking],
  )

  const resetPrefs = useCallback(() => {
    stopSpeaking()
    setPrefs(DEFAULT_PREFS)
    announce('Pengaturan aksesibilitas dikembalikan ke default.')
  }, [announce, stopSpeaking])

  const activeCount = useMemo(() => {
    let count = 0
    if (prefs.fontSize !== 'normal') count += 1
    if (prefs.highContrast) count += 1
    if (prefs.reduceMotion) count += 1
    if (prefs.readableSpacing) count += 1
    if (prefs.voiceEnabled) count += 1
    return count
  }, [prefs])

  const value = useMemo(
    () => ({
      prefs,
      updatePref,
      resetPrefs,
      speak,
      stopSpeaking,
      readCurrentScreen,
      isSpeaking,
      vibrate,
      announce,
      activeCount,
      speechSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
      vibrationSupported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    }),
    [
      prefs,
      updatePref,
      resetPrefs,
      speak,
      stopSpeaking,
      readCurrentScreen,
      isSpeaking,
      vibrate,
      announce,
      activeCount,
    ],
  )

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      <div className="a11y-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return ctx
}
