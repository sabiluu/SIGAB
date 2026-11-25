const iconProps = (size = 16, className = '') => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  className: className ? `ui-svg-icon ${className}` : 'ui-svg-icon',
})

export const IconAlert = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export const IconMap = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
)

export const IconPin = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

export const IconPhone = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

export const IconHome = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M10 21v-6a2 2 0 0 1 4 0v6" />
  </svg>
)

export const IconShield = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
)

export const IconTarget = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="1" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="1" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="23" y2="12" />
  </svg>
)

export const IconLock = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

export const IconRadio = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
  </svg>
)

export const IconRefresh = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

export const IconCamera = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export const IconImage = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

export const IconList = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="14" y2="15" />
  </svg>
)

export const IconFlask = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M9 3h6" />
    <path d="M10 3v5.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V3" />
    <path d="M7 15h10" />
  </svg>
)

export const IconZap = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export const IconVolume = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

export const IconStop = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
)

export const IconUser = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export const IconUsers = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const IconHeart = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export const IconAccessibility = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <circle cx="12" cy="4.5" r="2" />
    <path d="M5 9.5h14" />
    <path d="M12 9.5v5.5" />
    <path d="M9 21l3-6 3 6" />
  </svg>
)

export const IconEdit = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const IconSave = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

export const IconFileText = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

export const IconSearch = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const IconClock = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

export const IconNavigation = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
)

export const IconWaves = ({ size = 16, className = '' }) => (
  <svg {...iconProps(size, className)}>
    <path d="M2 7c2-1.6 4.5-1.6 6.5 0s4.5 1.6 6.5 0 4.5-1.6 7 0" />
    <path d="M2 12c2-1.6 4.5-1.6 6.5 0s4.5 1.6 6.5 0 4.5-1.6 7 0" />
    <path d="M2 17c2-1.6 4.5-1.6 6.5 0s4.5 1.6 6.5 0 4.5-1.6 7 0" />
  </svg>
)
