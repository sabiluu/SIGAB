import { useState, useEffect } from 'react'

/**
 * Custom hook untuk mendeteksi apakah layar pengguna adalah perangkat Mobile (< breakpoint).
 * Default breakpoint: 768px (Layar >= 768px = Desktop/Laptop, Layar < 768px = Mobile HP).
 */
export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handleUpdate = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    handleUpdate()

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleUpdate)
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleUpdate)
    }
    window.addEventListener('resize', handleUpdate)

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleUpdate)
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleUpdate)
      }
      window.removeEventListener('resize', handleUpdate)
    }
  }, [breakpoint])

  return isMobile
}
