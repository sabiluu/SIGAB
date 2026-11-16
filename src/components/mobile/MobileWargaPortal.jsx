import { useState, useEffect, useMemo, useCallback } from 'react'
import { logout, getProfile } from '../../services/authService'
import { apiFetch } from '../../services/api'
import { getSOSTickets, getMyTickets, createSOSTicket } from '../../services/sosService'
import { getShelters } from '../../services/shelterService'
import { getFloodIncidents } from '../../services/floodService'
import wsService from '../../services/wsService'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import useGeolocation, { BAURENO_VILLAGES } from '../../hooks/useGeolocation'
import usePersonalSimulation from '../../hooks/usePersonalSimulation'
import useRealtimeNotifications from '../../hooks/useRealtimeNotifications'
import { playSosAlertTone } from '../../utils/audioAlarm'
import { PERSONAL_SIM_PHASES } from '../../utils/personalSimulation'
import RiskMap from '../../components/RiskMap'
import LogoutModal from '../../components/common/LogoutModal'
import ProfileModal from '../../components/warga/ProfileModal'
import '../../styles/mobile.css'

function getSimPhaseInfo(status) {
  if (!status?.is_running) {
    return {
      themeColor: '#334155',
      bgColor: '#11222f',
      borderColor: '#1a3245',
      textColor: '#7d93a4',
      icon: '🧪',
      phaseName: 'Normal (OFF)',
      desc: 'Simulasi Akun: Normal (OFF)',
      shortDesc: 'Simulasi',
    }
  }

  const phase = (status.phase_name || '').toUpperCase()
  const risk = (status.risk_level || '').toLowerCase()
  const current = status.current_phase || 1
  const rem = status.remaining_seconds || 0
  const countdown = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`

  if (risk === 'awas' || phase.includes('AWAS')) {
    return {
      themeColor: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.16)',
      borderColor: 'rgba(239, 68, 68, 0.6)',
      textColor: '#f87171',
      icon: '🚨',
      phaseName: 'AWAS',
      desc: `Fase ${current}/7: AWAS (${countdown})`,
      shortDesc: `Fase ${current}: AWAS (${countdown})`,
    }
  }

  if (risk === 'tinggi' || phase.includes('SIAGA')) {
    return {
      themeColor: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.16)',
      borderColor: 'rgba(249, 115, 22, 0.6)',
      textColor: '#fb923c',
      icon: '🟠',
      phaseName: 'SIAGA',
      desc: `Fase ${current}/7: SIAGA (${countdown})`,
      shortDesc: `Fase ${current}: SIAGA (${countdown})`,
    }
  }

  if (risk === 'sedang' || phase.includes('WASPADA')) {
    return {
      themeColor: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.16)',
      borderColor: 'rgba(245, 158, 11, 0.6)',
      textColor: '#fbbf24',
      icon: '🟡',
      phaseName: 'WASPADA',
      desc: `Fase ${current}/7: WASPADA (${countdown})`,
      shortDesc: `Fase ${current}: WASPADA (${countdown})`,
    }
  }

  // Default: AMAN (Hijau)
  return {
    themeColor: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
    textColor: '#34d399',
    icon: '🟢',
    phaseName: 'AMAN',
    desc: `Fase ${current}/7: AMAN (${countdown})`,
    shortDesc: `Fase ${current}: AMAN (${countdown})`,
  }
}

export default function MobileWargaView() {
  const [activeTab, setActiveTab] = useState('beranda') // 'beranda' | 'peta' | 'sos' | 'panduan' | 'kontak'
  const savedProfile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('sigab_user_profile') || '{}')
    } catch {
      return {}
    }
  }, [])
  const [userProfile, setUserProfile] = useState(() => ({
    full_name: 'Warga Baureno',
    email: '',
    phone: '081234567890',
    village_id: 3,
    ...savedProfile,
  }))
  const [selectedVillageId, setSelectedVillageId] = useState(savedProfile?.village_id || 3)
  const personalSim = usePersonalSimulation(userProfile?.id || savedProfile?.id || 'warga_default')
  const simStatus = personalSim.simStatus
  const [showVillageSheet, setShowVillageSheet] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [realEmergencyActive, setRealEmergencyActive] = useState(false)
  const [directShelters, setDirectShelters] = useState([])

  // Real-time notifications (synced with desktop & localStorage)
  const {
    notifications: liveNotifs,
    markAsRead: wsMarkAsRead,
    markAllAsRead: wsMarkAllAsRead,
    clearAll: wsClearAll,
  } = useRealtimeNotifications('alerts', {
    villageId: selectedVillageId || userProfile?.village_id,
    userId: userProfile?.id,
    role: 'user',
  })

  const [localNotifs, setLocalNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('sigab_warga_notifs')
      if (saved) return JSON.parse(saved)
    } catch {
      // abaikan
    }
    return [
      {
        id: 'def-1',
        type: 'flood_alert',
        title: 'Pemantauan Debit Bengawan Solo',
        message: 'Debit air sungai terpantau aman. Tetap pantau kabar terbaru dari petugas BPBD.',
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: 'def-2',
        type: 'info',
        title: 'Posko Siaga Baureno Siap 24 Jam',
        message: 'Posko Balai Kecamatan Baureno dan Posko Desa siap melayani warga kapan saja.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true,
      },
    ]
  })

  useEffect(() => {
    if (liveNotifs && liveNotifs.length > 0) {
      setLocalNotifs((prev) => {
        const merged = [...liveNotifs]
        prev.forEach((p) => {
          if (!merged.some((m) => m.id === p.id)) {
            merged.push(p)
          }
        })
        return merged
      })
    }
  }, [liveNotifs])

  useEffect(() => {
    try {
      localStorage.setItem('sigab_warga_notifs', JSON.stringify(localNotifs))
    } catch {
      // abaikan
    }
  }, [localNotifs])

  const handleMarkAsRead = (id) => {
    setLocalNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    wsMarkAsRead(id)
    if (typeof id === 'number') {
      apiFetch(`/notifications/read/${id}`, { method: 'POST' }).catch(() => {})
    }
  }

  const handleMarkAllAsRead = () => {
    setLocalNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    wsMarkAllAsRead()
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {})
  }

  const handleClearAllNotifs = () => {
    setLocalNotifs([])
    wsClearAll()
  }

  const activeUnread = localNotifs.filter((n) => !n.read).length

  const formatNotifTime = (iso) => {
    if (!iso) return 'Baru saja'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return 'Baru saja'
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000)
      if (diffMins < 1) return 'Baru saja'
      if (diffMins < 60) return `${diffMins} menit lalu`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} jam lalu`
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.') + ' WIB'
    } catch {
      return 'Baru saja'
    }
  }

  // Real-time API data & GPS hook
  const { data: realtimeData } = useDashboardRealtime()
  const geo = useGeolocation()

  // Route & Posko state
  const [selectedShelterId, setSelectedShelterId] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Riwayat kejadian banjir (tersambung ke backend /flood/incidents)
  const [floodIncidents, setFloodIncidents] = useState([])

  // SOS state
  const [myTickets, setMyTickets] = useState([])
  const [sosFamilyCount, setSosFamilyCount] = useState(3)
  const [sosPatokan, setSosPatokan] = useState('')
  const [sosElderly, setSosElderly] = useState(true)
  const [sosToddler, setSosToddler] = useState(false)
  const [sosPregnant, setSosPregnant] = useState(false)
  const [sosDisability, setSosDisability] = useState(false)
  const [sosSubmitting, setSosSubmitting] = useState(false)
  const [sosSuccessMsg, setSosSuccessMsg] = useState('')
  const [sosErrorMsg, setSosErrorMsg] = useState('')

  // Load user profile, SOS tickets, shelters, notifications & flood archive from backend
  useEffect(() => {
    let mounted = true

    getProfile()
      .then((p) => {
        if (mounted && p) {
          setUserProfile(p)
          if (p.village_id) {
            setSelectedVillageId(Number(p.village_id))
            wsService.updateVillage(Number(p.village_id), 'alerts')
          }
        }
      })
      .catch(() => {})

    loadTickets()
    const t = setInterval(loadTickets, 10000)

    // Fetch direct shelters from backend
    getShelters()
      .then((res) => {
        if (mounted && Array.isArray(res) && res.length > 0) {
          setDirectShelters(res)
        }
      })
      .catch(() => {})

    // Fetch real flood incidents archive from backend
    getFloodIncidents({ page_size: 15 })
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.items || [])
        if (mounted && items.length > 0) {
          setFloodIncidents(items)
        }
      })
      .catch(() => {})

    // Fetch persisted notifications from backend
    apiFetch('/notifications?limit=30')
      .then((res) => {
        if (mounted && Array.isArray(res) && res.length > 0) {
          setLocalNotifs((prev) => {
            const mapped = res.map((n) => ({
              id: n.id,
              type: n.type || 'info',
              title: n.title,
              message: n.message,
              timestamp: n.created_at,
              read: Boolean(n.is_read),
            }))
            const merged = [...mapped]
            prev.forEach((p) => {
              if (!merged.some((m) => String(m.id) === String(p.id))) {
                merged.push(p)
              }
            })
            return merged
          })
        }
      })
      .catch(() => {})

    // Fetch backend emergency status
    const targetVillage = selectedVillageId || userProfile?.village_id || 1
    apiFetch(`/emergency/${targetVillage}`)
      .then((res) => {
        if (mounted) setRealEmergencyActive(res?.is_emergency_active || false)
      })
      .catch(() => {})

    // Connect to WebSocket channel 'alerts'
    wsService.connect('alerts', {
      villageId: targetVillage,
      userId: userProfile?.id,
      role: 'user',
    })

    const unsubEmergency = wsService.on('emergency_status', (data) => {
      setRealEmergencyActive(data?.is_active || false)
      if (data?.is_active) playSosAlertTone()
    })

    const unsubSosNew = wsService.on('sos_new', () => {
      playSosAlertTone()
      loadTickets()
    })

    const unsubSosUpd = wsService.on('sos_updated', () => {
      loadTickets()
    })

    return () => {
      mounted = false
      clearInterval(t)
      unsubEmergency()
      unsubSosNew()
      unsubSosUpd()
    }
  }, [selectedVillageId, userProfile?.id])

  const loadTickets = async () => {
    try {
      const list = await getMyTickets()
      if (Array.isArray(list)) {
        setMyTickets(list)
        return
      }
    } catch {
      // fallback ke getSOSTickets jika /sos/my belum tersedia
    }
    try {
      const fallbackList = await getSOSTickets()
      if (Array.isArray(fallbackList)) setMyTickets(fallbackList)
    } catch (_) {}
  }

  // Normalize villages & shelters
  const villages = useMemo(() => {
    const raw = realtimeData?.villages || []
    if (raw.length === 0) {
      return BAURENO_VILLAGES.map((v) => ({
        id: v.id,
        name: v.name.replace(' (Pusat)', ''),
        cleanName: v.name.replace(/^Desa\s+/i, '').replace(' (Pusat)', ''),
        probability: 18.5,
        risk_level: 'aman',
        latitude: v.lat,
        longitude: v.lng,
      }))
    }
    return raw.map((v) => {
      const prob = Number(v.current_probability ?? v.probability ?? 18.0)
      const cleanName = (v.name || 'Baureno').replace(/^Desa\s+/i, '').trim()
      return {
        ...v,
        cleanName,
        probability: prob,
        risk_level: prob >= 76 ? 'awas' : prob >= 51 ? 'siaga' : prob >= 25 ? 'waspada' : 'aman',
      }
    })
  }, [realtimeData])

  const shelters = useMemo(() => {
    const raw = (directShelters && directShelters.length > 0)
      ? directShelters
      : (realtimeData?.shelters || [])
    if (raw.length > 0) return raw
    return [
      {
        id: 1,
        name: 'Posko Balai Kecamatan Baureno',
        address: 'Jl. Raya Baureno No. 12, Baureno',
        village_id: 3,
        latitude: -7.129,
        longitude: 112.105,
        capacity_total: 500,
        capacity_occupied: 45,
        contact_person: 'Petugas BPBD',
        contact_phone: '08111222333',
      },
      {
        id: 2,
        name: 'Posko SDN Baureno 1',
        address: 'Jl. Pendidikan Baureno',
        village_id: 3,
        latitude: -7.125,
        longitude: 112.11,
        capacity_total: 300,
        capacity_occupied: 20,
        contact_person: 'Tim Relawan',
        contact_phone: '08123456789',
      },
    ]
  }, [directShelters, realtimeData?.shelters])

  const activeVillage = useMemo(() => {
    const found = villages.find((v) => Number(v.id) === Number(selectedVillageId)) || villages[0]
    if (!found) {
      return { id: 3, cleanName: 'Baureno', probability: 18.0, risk_level: 'aman', latitude: -7.1282, longitude: 112.1039 }
    }
    if (personalSim.isRunning && simStatus) {
      const prob = Number(simStatus.probability != null ? simStatus.probability : found.probability)
      const risk = simStatus.risk_level || (prob >= 76 ? 'awas' : prob >= 51 ? 'siaga' : prob >= 25 ? 'waspada' : 'aman')
      return {
        ...found,
        probability: prob,
        risk_level: risk,
      }
    }
    return found
  }, [villages, selectedVillageId, personalSim.isRunning, simStatus])

  const displayedVillages = useMemo(() => {
    if (!personalSim.isRunning || !simStatus) return villages
    return villages.map((v) => {
      if (Number(v.id) === Number(activeVillage.id)) {
        const prob = Number(simStatus.probability != null ? simStatus.probability : v.probability)
        const risk = simStatus.risk_level || (prob >= 76 ? 'awas' : prob >= 51 ? 'siaga' : prob >= 25 ? 'waspada' : 'aman')
        return {
          ...v,
          probability: prob,
          risk_level: risk,
        }
      }
      return v
    })
  }, [villages, personalSim.isRunning, simStatus, activeVillage.id])

  // Validasi Darurat: Pengiriman SOS HANYA aktif jika status desa AWAS (prob >= 76%), status darurat backend aktif, ATAU Simulasi Akun Warga di fase AWAS
  const isEmergency = useMemo(() => {
    if (personalSim.isRunning) {
      return Boolean(personalSim.isEmergency || simStatus?.risk_level === 'awas' || Number(simStatus?.probability) >= 76)
    }
    return Boolean(
      realEmergencyActive ||
      activeVillage.risk_level === 'awas' ||
      Number(activeVillage.probability) >= 76
    )
  }, [personalSim.isRunning, personalSim.isEmergency, simStatus, realEmergencyActive, activeVillage])

  // Catat otomatis notifikasi peringatan ketika simulasi memasuki fase waspada/siaga/awas
  useEffect(() => {
    if (!personalSim.isRunning) return
    const p = simStatus?.current_phase
    const simInfo = PERSONAL_SIM_PHASES.find((item) => item.phase === p)
    if (!simInfo) return
    if (simInfo.risk === 'waspada' || simInfo.risk === 'siaga' || simInfo.risk === 'awas') {
      const notifId = `sim-phase-${p}-${activeVillage.id}`
      setLocalNotifs((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev
        return [
          {
            id: notifId,
            type: simInfo.risk === 'awas' ? 'sos_alert' : 'flood_alert',
            title: `[Simulasi] Status ${simInfo.name.toUpperCase()} - Desa ${activeVillage.cleanName}`,
            message:
              simInfo.risk === 'awas'
                ? 'Air sungai mencapai level bahaya! Segera evakuasi ke posko terdekat atau kirim sinyal SOS.'
                : `Latihan banjir memasuki tahap ${simInfo.name}. Tinggi air dan curah hujan terpantau meningkat.`,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ]
      })
    }
  }, [personalSim.isRunning, simStatus?.current_phase, activeVillage.id, activeVillage.cleanName])

  // Handler klik tombol SOS: jika belum darurat & simulasi off, tampilkan modal tolak otomatis
  const handleSOSClick = () => {
    if (!isEmergency) {
      setShowRejectModal(true)
    } else {
      setActiveTab('sos')
    }
  }

  const selectedShelter = useMemo(() => {
    if (selectedShelterId) {
      const s = shelters.find((sh) => Number(sh.id) === Number(selectedShelterId))
      if (s) return s
    }
    return null
  }, [shelters, selectedShelterId])

  // Hitung rute OSRM hanya saat user meminta / klik tombol posko (TIDAK otomatis saat awal buka)
  const handleCalculateRoute = useCallback(async (targetShelter) => {
    const sh = targetShelter || (selectedShelterId ? shelters.find(s => Number(s.id) === Number(selectedShelterId)) : shelters[0])
    if (!sh) return
    setSelectedShelterId(sh.id)
    setLoadingRoute(true)

    const uLat = geo.latitude || -7.1155
    const uLon = geo.longitude || 112.0835

    try {
      const res = await apiFetch(`/shelters/${sh.id}/route?user_lat=${uLat}&user_lon=${uLon}`)
      if (res && Array.isArray(res.coordinates) && res.coordinates.length >= 2) {
        setRouteData({
          coordinates: res.coordinates.map((c) => [c[1], c[0]]),
          distance_km: Number(res.distance_km || 2.1).toFixed(2),
          duration_minutes: Math.max(1, Math.round(Number(res.duration_minutes || 6))),
          shelterName: sh.name,
          destLat: sh.latitude,
          destLon: sh.longitude,
        })
        setLoadingRoute(false)
        return
      }
    } catch (_) {}

    // Fallback OSRM direct
    try {
      const r = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${uLon},${uLat};${sh.longitude},${sh.latitude}?overview=full&geometries=geojson`
      )
      const d = await r.json()
      if (d?.routes?.[0]?.geometry?.coordinates) {
        const coords = d.routes[0].geometry.coordinates.map((c) => [c[1], c[0]])
        setRouteData({
          coordinates: coords,
          distance_km: ((d.routes[0].distance || 2100) / 1000).toFixed(2),
          duration_minutes: Math.max(1, Math.round((d.routes[0].duration || 300) / 60)),
          shelterName: sh.name,
          destLat: sh.latitude,
          destLon: sh.longitude,
        })
        setLoadingRoute(false)
        return
      }
    } catch (_) {}

    setRouteData({
      coordinates: [
        [uLat, uLon],
        [sh.latitude || -7.129, sh.longitude || 112.105],
      ],
      distance_km: '2.10',
      duration_minutes: 6,
      shelterName: sh.name,
      destLat: sh.latitude || -7.129,
      destLon: sh.longitude || 112.105,
    })
    setLoadingRoute(false)
  }, [shelters, selectedShelterId, geo.latitude, geo.longitude])

  const handleSendSOS = async (e) => {
    e.preventDefault()
    if (!isEmergency) {
      setSosErrorMsg('Pengiriman SOS ditolak otomatis. Fitur panggilan darurat hanya aktif saat status wilayah DARURAT / AWAS atau saat mode Simulasi Akun Warga mencapai status AWAS.')
      setShowRejectModal(true)
      return
    }
    setSosSubmitting(true)
    setSosErrorMsg('')
    setSosSuccessMsg('')
    try {
      const uLat = geo.latitude || -7.1155
      const uLon = geo.longitude || 112.0835
      await createSOSTicket({
        name: userProfile.full_name || 'Warga Baureno',
        phone: userProfile.phone || '081234567890',
        village_id: Number(activeVillage.id || 3),
        gps_latitude: uLat,
        gps_longitude: uLon,
        gps_address: `Desa ${activeVillage.cleanName}, Kec. Baureno`,
        patokan: sosPatokan || `Dekat Balai Desa ${activeVillage.cleanName} (Simulasi)`,
        family_count: Number(sosFamilyCount) || 1,
        has_elderly: sosElderly,
        has_toddler: sosToddler,
        has_pregnant: sosPregnant,
        has_disability: sosDisability,
        is_simulation: Boolean(personalSim.isRunning),
      })
      setSosSuccessMsg(
        personalSim.isRunning
          ? '🚨 [MODE SIMULASI] Sinyal SOS simulasi berhasil dikirim ke Pusdalops BPBD Baureno!'
          : 'Sinyal SOS darurat berhasil dikirim ke Pusdalops BPBD Baureno! Tim sedang memverifikasi lokasi Anda.'
      )
      setSosPatokan('')
      loadTickets()
    } catch (err) {
      setSosErrorMsg(err.message || 'Gagal mengirim tiket SOS.')
    } finally {
      setSosSubmitting(false)
    }
  }

  const dischargeVal = personalSim.isRunning && simStatus?.discharge_m3s != null
    ? Math.round(simStatus.discharge_m3s).toLocaleString('id-ID')
    : (realtimeData?.discharge?.discharge_m3s
        ? Number(realtimeData.discharge.discharge_m3s).toFixed(2)
        : '1.28')

  const rainVal = personalSim.isRunning && simStatus?.rainfall_mm != null
    ? Number(simStatus.rainfall_mm).toFixed(1)
    : (realtimeData?.weather?.precipitation_mm
        ? Number(realtimeData.weather.precipitation_mm).toFixed(1)
        : '0.0')

  const riskLabelMap = {
    aman: 'AMAN',
    waspada: 'WASPADA',
    siaga: 'SIAGA',
    awas: 'AWAS / DARURAT',
  }

  return (
    <div className="sigab-mobile-root" style={{ paddingBottom: '78px' }}>
      {/* 1. STICKY MOBILE TOP HEADER */}
      <header className="m-top-header">
        <div className="m-brand" onClick={() => setActiveTab('beranda')} style={{ cursor: 'pointer' }}>
          <div className="m-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
              <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
              <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
            </svg>
          </div>
          <div className="m-brand-text">
            <span className="m-brand-title">SIGAB Warga</span>
            <span className="m-brand-sub">Desa {activeVillage.cleanName}</span>
          </div>
        </div>

        <div className="m-header-actions">
          {/* Notification Bell Button */}
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setShowNotifSheet(true)}
            title="Kabar & Notifikasi"
            aria-label="Kabar & Notifikasi"
            style={{ position: 'relative', width: '40px', height: '40px', background: activeUnread > 0 ? '#f0fdfa' : '#f1f6f8', color: activeUnread > 0 ? '#00828f' : '#0c1a24' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {activeUnread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 4px rgba(220,38,38,0.35)',
                }}
              >
                {activeUnread > 9 ? '9+' : activeUnread}
              </span>
            )}
          </button>

          {/* Profile Modal Button */}
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setShowProfileModal(true)}
            title="Profil Saya"
            aria-label="Profil Saya"
            style={{ width: '40px', height: '40px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setShowLogoutModal(true)}
            title="Keluar Akun"
            aria-label="Keluar Akun"
            style={{ color: '#dc2626', width: '40px', height: '40px', background: '#fef2f2' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* STICKY EMERGENCY TOP BANNER (JIKA STATUS AWAS / DARURAT AKTIF) */}
      {isEmergency && (
        <div
          style={{
            position: 'sticky',
            top: '58px',
            zIndex: 89,
            background: '#dc2626',
            color: '#ffffff',
            padding: '8px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.05rem' }}>📢</span>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.02em' }}>
                STATUS AWAS: EVAKUASI SEGERA
              </div>
              <div style={{ fontSize: '0.65rem', color: '#fecaca' }}>
                Desa {activeVillage.cleanName} • Indeks {Math.round(activeVillage.probability)}% {personalSim.isRunning ? '(Mode Simulasi)' : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('sos')}
            style={{
              background: '#ffffff',
              color: '#dc2626',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <span>🚨</span>
            <span>Kirim SOS</span>
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{ padding: '16px 14px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ==============================================================
            TAB 1: BERANDA WARGA (BERSIH, JELAS & RAMAH LANSIA)
           ============================================================== */}
        {activeTab === 'beranda' && (
          <>
            {/* Status Card Desa */}
            <section
              className="m-card"
              style={{
                background: activeVillage.risk_level === 'awas'
                  ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                  : 'linear-gradient(135deg, #0c1a24 0%, #132c3d 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '20px 18px',
                borderRadius: '18px',
                boxShadow: '0 8px 20px rgba(12, 26, 36, 0.14)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: '#cbd5e1' }}>
                  WILAYAH ANDA SAAT INI
                </span>
                <span className={`m-badge ${activeVillage.risk_level}`} style={{ fontSize: '0.74rem', padding: '4px 12px' }}>
                  {riskLabelMap[activeVillage.risk_level] || 'AMAN'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 8px', color: '#ffffff', lineHeight: 1.15 }}>
                    Desa {activeVillage.cleanName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowVillageSheet(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(255, 255, 255, 0.14)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>📍</span>
                    <span>Ganti Desa</span>
                    <span style={{ opacity: 0.8 }}>▾</span>
                  </button>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1 }}>
                    {Math.round(activeVillage.probability)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '4px' }}>
                    Risiko Banjir
                  </div>
                </div>
              </div>

              <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                {activeVillage.risk_level === 'awas'
                  ? '⚠️ Bahaya banjir! Segera menuju posko terdekat atau tekan tombol SOS.'
                  : activeVillage.risk_level === 'siaga'
                  ? '🟠 Air cukup tinggi. Siapkan dokumen & barang penting keluarga.'
                  : activeVillage.risk_level === 'waspada'
                  ? '🟡 Air mulai naik. Harap tetap waspada dan pantau kabar terbaru.'
                  : '✅ Keadaan aman terkendali. Belum ada tanda ancaman banjir.'}
              </p>

              {/* 3 Readable Info Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Debit Air</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '3px' }}>{dischargeVal} m³/s</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Hujan</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '3px' }}>{rainVal} mm/j</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Posko Siap</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '3px' }}>{shelters.length} Lokasi</div>
                </div>
              </div>
            </section>

            {/* Quick Action Buttons (Besar & Mudah Ditekan) */}
            <section
              className="m-card"
              style={{
                background: activeVillage.risk_level === 'awas' ? '#fef2f2' : '#ffffff',
                borderColor: activeVillage.risk_level === 'awas' ? '#fecaca' : '#e2ecee',
                padding: '18px',
              }}
            >
              <h3 style={{ margin: '0 0 4px', fontSize: '0.96rem', fontWeight: 800, color: activeVillage.risk_level === 'awas' ? '#dc2626' : '#0c1a24' }}>
                {activeVillage.risk_level === 'awas'
                  ? '⚠️ Tindakan Darurat Banjir'
                  : '🧭 Menu Cepat Warga'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, margin: '0 0 14px' }}>
                {activeVillage.risk_level === 'awas'
                  ? 'Pilih tombol di bawah untuk melihat jalan ke posko atau meminta jemputan petugas BPBD.'
                  : 'Ketuk tombol di bawah untuk melihat peta posko atau meminta pertolongan darurat.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="m-btn m-btn-teal"
                  style={{ minHeight: '50px', fontSize: '0.92rem', borderRadius: '13px' }}
                  onClick={() => {
                    setActiveTab('peta')
                    if (!routeData && shelters.length > 0) {
                      handleCalculateRoute(shelters[0])
                    }
                  }}
                >
                  <span>🗺️ Lihat Peta &amp; Rute Posko {routeData ? `(${routeData.distance_km} km)` : ''}</span>
                </button>
                <button
                  type="button"
                  className="m-btn m-btn-danger"
                  style={{ minHeight: '50px', fontSize: '0.92rem', borderRadius: '13px' }}
                  onClick={handleSOSClick}
                >
                  <span>🚨 Minta Bantuan Darurat (SOS)</span>
                </button>
              </div>
            </section>

            {/* Posko Terdekat Card */}
            {(() => {
              const recommendedShelter = selectedShelter || shelters[0]
              if (!recommendedShelter) return null

              const occ = Number(recommendedShelter.capacity_occupied || 0)
              const tot = Number(recommendedShelter.capacity_total || 200)
              const pct = Math.min(100, Math.round((occ / tot) * 100))

              return (
                <section className="m-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#00828f' }}>
                      🏕️ POSKO PENGUNGSIAN TERDEKAT
                    </span>
                    <span className="m-badge aman" style={{ fontSize: '0.7rem' }}>Buka 24 Jam</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1a24', marginBottom: '4px' }}>
                    {recommendedShelter.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '12px', lineHeight: 1.4 }}>
                    {recommendedShelter.address}
                    {routeData && (
                      <div style={{ marginTop: '4px', color: '#0f766e', fontWeight: 700 }}>
                        Jarak: {routeData.distance_km} km (sekitar {routeData.duration_minutes} menit)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <span>Terisi: <strong>{occ}</strong> dari {tot} orang</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>
                      Sisa {tot - occ} tempat
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '14px' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: '#10b981',
                      }}
                    />
                  </div>
                  {routeData ? (
                    <button
                      type="button"
                      className="m-btn m-btn-outline"
                      style={{ minHeight: '48px', fontSize: '0.88rem', borderRadius: '12px' }}
                      onClick={() => setActiveTab('peta')}
                    >
                      Tampilkan Jalan di Peta 🗺️
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="m-btn m-btn-outline"
                      style={{ minHeight: '48px', fontSize: '0.88rem', borderRadius: '12px' }}
                      disabled={loadingRoute}
                      onClick={() => handleCalculateRoute(recommendedShelter)}
                    >
                      {loadingRoute ? '⏳ Sedang Menghitung Jalan...' : 'Lihat Jarak & Jalan ke Posko 🗺️'}
                    </button>
                  )}
                </section>
              )
            })()}

            {/* Status Desa Sekitar */}
            <section className="m-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>Kondisi Desa Sekitar</h3>
                <button
                  type="button"
                  onClick={() => setShowVillageSheet(true)}
                  style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '999px', padding: '5px 12px', color: '#0f766e', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Semua ({villages.length}) →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {villages.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVillageId(v.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: Number(v.id) === Number(activeVillage.id) ? '2px solid #009aa6' : '1px solid #e2e8f0',
                      background: Number(v.id) === Number(activeVillage.id) ? '#f0fdfa' : '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0c1a24' }}>Desa {v.cleanName}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>Risiko {Number(v.probability).toFixed(0)}%</div>
                    </div>
                    <span className={`m-badge ${v.risk_level}`} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>{v.risk_level.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Card Simulasi Akun Warga (Diletakkan di bagian paling bawah halaman Beranda) */}
            {(() => {
              const simInfo = PERSONAL_SIM_PHASES.find((p) => p.phase === simStatus.current_phase) || PERSONAL_SIM_PHASES[0]
              return (
                <section
                  className="m-card"
                  style={{
                    background: personalSim.isRunning ? simInfo.bgColor : '#f8fafc',
                    border: `1.5px solid ${personalSim.isRunning ? simInfo.borderColor : '#cbd5e1'}`,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{personalSim.isRunning ? simInfo.icon : '🎮'}</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                          Simulasi Akun Warga
                        </div>
                        <div style={{ fontSize: '0.7rem', color: personalSim.isRunning ? simInfo.themeColor : '#64748b', fontWeight: personalSim.isRunning ? 700 : 500 }}>
                          {personalSim.isRunning ? `Status: ${simInfo.name.toUpperCase()} (Fase ${simStatus.current_phase}/7)` : 'Mode Normal (Live Sensor)'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (personalSim.isRunning) {
                          personalSim.stopSimulation()
                        } else {
                          personalSim.startSimulation(0)
                          playSosAlertTone()
                        }
                      }}
                      style={{
                        background: personalSim.isRunning ? simInfo.themeColor : '#0f766e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '999px',
                        padding: '6px 14px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: personalSim.isRunning ? `0 2px 8px ${simInfo.borderColor}` : '0 2px 6px rgba(15, 118, 110, 0.25)',
                      }}
                    >
                      {personalSim.isRunning ? '⏹ Hentikan' : '▶ Mulai Simulasi'}
                    </button>
                  </div>

                  {personalSim.isRunning ? (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      {/* Visual progress tracker for all 7 phases */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                        {PERSONAL_SIM_PHASES.map((p) => {
                          const isCurrent = simStatus.current_phase === p.phase
                          const isPast = simStatus.current_phase > p.phase
                          return (
                            <div
                              key={p.phase}
                              style={{
                                height: '5px',
                                borderRadius: '3px',
                                background: isCurrent ? p.themeColor : isPast ? '#059669' : 'rgba(148, 163, 184, 0.3)',
                                transition: 'all 0.3s ease',
                              }}
                              title={`Fase ${p.phase}: ${p.name}`}
                            />
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#475569' }}>
                        <span style={{ flex: 1, paddingRight: '8px' }}>{simStatus.description}</span>
                        {simStatus.current_phase !== 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              personalSim.startSimulation(3) // Jump to AWAS (index 3)
                              playSosAlertTone()
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                              flexShrink: 0,
                            }}
                          >
                            ⚡ Loncat ke AWAS
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Alur bertahap: Aman → Waspada → Siaga → Awas → Aman</span>
                      <button
                        type="button"
                        onClick={() => {
                          personalSim.startSimulation(3)
                          playSosAlertTone()
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        ⚡ Uji Coba AWAS (SOS)
                      </button>
                    </div>
                  )}
                </section>
              )
            })()}
          </>
        )}

        {/* ==============================================================
            TAB 2: PETA & RUTE POSKO (OSRM POLYLINE)
           ============================================================== */}
        {activeTab === 'peta' && (
          <>
            <section className="m-card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Peta Risiko & Rute Evakuasi</h2>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    📍 Dari Desa {activeVillage.cleanName} {selectedShelter ? `➔ 🎯 ${selectedShelter.name}` : '• Ketuk posko untuk cek rute'}
                  </div>
                </div>
                {routeData && (
                  <span className="m-badge aman">
                    {routeData.distance_km} km • {routeData.duration_minutes} mnt
                  </span>
                )}
              </div>

              <div className="m-map-frame" style={{ height: '300px', marginBottom: '12px' }}>
                <RiskMap
                  height="300px"
                  selectedVillageName={activeVillage.cleanName}
                  userVillageName={activeVillage.cleanName}
                  userVillageId={Number(activeVillage.id || selectedVillageId)}
                  villagesData={displayedVillages}
                  shelters={shelters}
                  simStatus={simStatus}
                  activeRoute={routeData}
                  routeCoordinates={routeData?.coordinates}
                  selectedShelterId={selectedShelter?.id}
                  onSelectShelter={(sh) => handleCalculateRoute(sh)}
                  userLocation={{
                    latitude: geo.latitude || -7.1155,
                    longitude: geo.longitude || 112.0835,
                    label: `Posisi Anda (${activeVillage.cleanName})`,
                  }}
                />
              </div>

              {/* Legend Navigasi & Indikator Titik Lokasi */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-4px 0 10px', padding: '7px 10px', background: '#f0fdfa', borderRadius: '10px', fontSize: '0.72rem', color: '#334155', border: '1px solid #99f6e4' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb', display: 'inline-block', boxShadow: '0 0 0 2px white, 0 0 4px #2563eb' }} />
                  <strong>Titik Biru:</strong> Posisi Anda ({activeVillage.cleanName})
                </span>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>
                  Gunakan tombol 📍 & 🗺️ di peta
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="m-btn m-btn-danger"
                  onClick={handleSOSClick}
                >
                  🚨 Butuh Jemputan? Kirim SOS
                </button>
              </div>
            </section>

            {/* Daftar Pilihan Posko Evakuasi */}
            <section className="m-card">
              <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: 800 }}>
                Pilih Posko Tujuan ({shelters.length} Posko Aktif)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {shelters.map((sh) => {
                  const isSelected = Number(sh.id) === Number(selectedShelter?.id)
                  const occ = Number(sh.capacity_occupied || 0)
                  const tot = Number(sh.capacity_total || 200)
                  const pct = Math.min(100, Math.round((occ / tot) * 100))
                  return (
                    <div
                      key={sh.id}
                      onClick={() => handleCalculateRoute(sh)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #009aa6' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.86rem', color: '#0c1a24' }}>{sh.name}</strong>
                        <span className={`m-badge ${pct >= 90 ? 'awas' : 'aman'}`}>
                          {isSelected && routeData ? '🎯 Rute Aktif' : `${tot - occ} Kosong`}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px' }}>
                        {sh.address} • 📞 {sh.contact_phone || '08111222333'}
                      </div>
                      <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#dc2626' : '#009aa6' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '6px' }}>
                        <span>Terisi {occ}/{tot} jiwa ({pct}%)</span>
                        <span style={{ color: '#009aa6', fontWeight: 700 }}>
                          {loadingRoute && isSelected
                            ? '⏳ Menghitung rute...'
                            : isSelected && routeData
                            ? `📍 ${routeData.distance_km} km (~${routeData.duration_minutes} mnt)`
                            : 'Ketuk untuk lihat jarak & rute →'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 3: KIRIM SINYAL SOS & TRACKER TIKET
           ============================================================== */}
        {activeTab === 'sos' && (
          <>
            <section className="m-card" style={{ borderTop: `4px solid ${isEmergency ? '#dc2626' : '#f59e0b'}` }}>
              <span className={`m-badge ${isEmergency ? 'awas' : 'waspada'}`} style={{ marginBottom: '8px' }}>
                {isEmergency ? '🚨 STATUS DARURAT AKTIF' : '🔒 PENGIRIMAN SOS TERKUNCI'}
              </span>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>
                Kirim Permintaan Evakuasi SOS
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                {isEmergency
                  ? 'Koordinat GPS dan jumlah anggota keluarga rentan akan langsung masuk ke layar utama Pusdalops BPBD Baureno.'
                  : 'Pengiriman SOS hanya diizinkan saat status wilayah DARURAT / AWAS atau saat mode Simulasi Akun Warga mencapai status AWAS.'}
              </p>

              {/* Locked Notice if Not in Emergency */}
              {!isEmergency && (
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1.5px dashed #f87171',
                    borderRadius: '13px',
                    padding: '14px',
                    marginBottom: '14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.75rem', marginBottom: '4px' }}>🔒</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
                    Pengiriman SOS Ditolak Otomatis
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: '12px' }}>
                    Status Desa {activeVillage.cleanName} saat ini masih{' '}
                    <strong>{riskLabelMap[activeVillage.risk_level] || 'AMAN'} ({Math.round(activeVillage.probability)}%)</strong>.
                    Pusdalops BPBD hanya menerima panggilan SOS saat kondisi <strong>DARURAT / AWAS</strong> (probabilitas ≥ 76%).
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        personalSim.startSimulation(3) // Jump to AWAS (index 3)
                        playSosAlertTone()
                      }}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                      }}
                    >
                      <span>🚨</span> Aktifkan Fase AWAS (94%) untuk Uji SOS
                    </button>
                    {!personalSim.isRunning && (
                      <button
                        type="button"
                        onClick={() => {
                          personalSim.startSimulation(0)
                          playSosAlertTone()
                        }}
                        style={{
                          background: '#ffffff',
                          color: '#0f766e',
                          border: '1.5px solid #0f766e',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🧪 Mulai Simulasi Bertahap dari Awal
                      </button>
                    )}
                  </div>
                </div>
              )}

              {sosSuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '12px', borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px' }}>
                  ✅ {sosSuccessMsg}
                </div>
              )}
              {sosErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px' }}>
                  ⚠️ {sosErrorMsg}
                </div>
              )}

              <form onSubmit={handleSendSOS} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '11px', padding: '10px 12px', fontSize: '0.76rem' }}>
                  <div style={{ fontWeight: 700, color: '#0c1a24' }}>📍 Lokasi Terdeteksi: Desa {activeVillage.cleanName}</div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>
                    GPS: {(geo.latitude || -7.1155).toFixed(4)}, {(geo.longitude || 112.0835).toFixed(4)}
                  </div>
                </div>

                {/* Stepper Jumlah Jiwa */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Jumlah Anggota Keluarga yang Dievakuasi
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      disabled={!isEmergency}
                      onClick={() => setSosFamilyCount(Math.max(1, sosFamilyCount - 1))}
                      style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: isEmergency ? 'pointer' : 'not-allowed', opacity: isEmergency ? 1 : 0.6 }}
                    >
                      −
                    </button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
                      {sosFamilyCount} Jiwa
                    </div>
                    <button
                      type="button"
                      disabled={!isEmergency}
                      onClick={() => setSosFamilyCount(sosFamilyCount + 1)}
                      style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: isEmergency ? 'pointer' : 'not-allowed', opacity: isEmergency ? 1 : 0.6 }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Kelompok Rentan Checkboxes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Kelompok Rentan (Prioritas Penyelamatan)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { label: '👴 Lansia', val: sosElderly, set: setSosElderly },
                      { label: '👶 Balita', val: sosToddler, set: setSosToddler },
                      { label: '🤰 Ibu Hamil', val: sosPregnant, set: setSosPregnant },
                      { label: '♿ Disabilitas', val: sosDisability, set: setSosDisability },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={!isEmergency}
                        onClick={() => item.set(!item.val)}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: item.val ? '1.5px solid #dc2626' : '1px solid #dce5eb',
                          background: item.val ? '#fef2f2' : '#ffffff',
                          color: item.val ? '#dc2626' : '#334155',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: isEmergency ? 'pointer' : 'not-allowed',
                          opacity: isEmergency ? 1 : 0.6,
                          textAlign: 'left',
                        }}
                      >
                        {item.val ? '☑ ' : '☐ '} {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patokan Lokasi */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                    Patokan Rumah / Kondisi Saat Ini
                  </label>
                  <input
                    type="text"
                    disabled={!isEmergency}
                    value={sosPatokan}
                    onChange={(e) => setSosPatokan(e.target.value)}
                    placeholder="Contoh: Rumah pagar biru dekat Masjid, air setinggi lutut"
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid #dce5eb',
                      fontSize: '0.82rem',
                      opacity: isEmergency ? 1 : 0.6,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isEmergency || sosSubmitting}
                  className="m-btn m-btn-danger"
                  style={{
                    background: !isEmergency ? '#94a3b8' : '#dc2626',
                    cursor: !isEmergency ? 'not-allowed' : 'pointer',
                    opacity: !isEmergency ? 0.7 : 1,
                  }}
                >
                  {!isEmergency
                    ? '🔒 Pengiriman Ditolak (Status Belum AWAS)'
                    : sosSubmitting
                    ? 'Mengirim Sinyal SOS...'
                    : '🚨 KIRIM SINYAL SOS SEKARANG'}
                </button>
              </form>
            </section>

            {/* Status Tiket SOS Terkini */}
            <section className="m-card">
              <h3 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: 800 }}>
                Riwayat & Status Tiket SOS ({myTickets.length})
              </h3>
              {myTickets.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  Belum ada tiket SOS aktif.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myTickets.slice(0, 5).map((t) => (
                    <div key={t.id} style={{ padding: '12px', borderRadius: '11px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.82rem' }}>{t.ticket_number || `SOS-${t.id}`}</strong>
                        <span className={`m-badge ${t.status === 'completed' ? 'aman' : 'awas'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#334155' }}>
                        📍 {t.gps_address} • 👥 {t.family_count} jiwa (Skor Prioritas: {t.priority_score})
                      </div>
                      {t.assigned_unit && (
                        <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, marginTop: '4px' }}>
                          🚤 Tim Penjemput: {t.assigned_unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 4: PANDUAN SIAGA & CEKLIS KELUARGA
           ============================================================== */}
        {activeTab === 'panduan' && (
          <section className="m-card">
            <span className="m-badge aman" style={{ marginBottom: '8px' }}>SOP KESIAPSIAGAAN BPBD</span>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.12rem', fontWeight: 800 }}>
              Panduan & Ceklis Menghadapi Banjir
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  badge: 'Level 1 • AMAN (0–24%)',
                  cls: 'aman',
                  items: [
                    'Siapkan Tas Siaga Bencana (dokumen KTP/KK dalam plastik kedap air).',
                    'Simpan nomor darurat Pusdalops BPBD Baureno (0353) 881-234.',
                    'Pastikan saluran air di sekitar rumah bebas dari sumbatan.',
                  ],
                },
                {
                  badge: 'Level 2 • WASPADA (25–50%)',
                  cls: 'waspada',
                  items: [
                    'Pindahkan barang elektronik dan surat berharga ke tempat tinggi.',
                    'Isi penuh baterai HP, powerbank, dan senter darurat.',
                    'Pantau pembaruan tinggi muka air Bengawan Solo di aplikasi SIGAB.',
                  ],
                },
                {
                  badge: 'Level 3 • SIAGA (51–75%)',
                  cls: 'siaga',
                  items: [
                    'Matikan aliran listrik (MCB) dan cabut regulator tabung gas LPG.',
                    'Ungsikan kelompok rentan (lansia, ibu hamil, balita, difabel) lebih dulu ke posko.',
                    'Cek peta rute aman di tab Peta & Rute.',
                  ],
                },
                {
                  badge: 'Level 4 • AWAS (76–100%)',
                  cls: 'awas',
                  items: [
                    'Segera tinggalkan area genangan menuju Posko Evakuasi terdekat.',
                    'Jangan menerobos arus deras; gunakan tombol SOS jika terjebak.',
                  ],
                },
              ].map((sec) => (
                <div key={sec.badge} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span className={`m-badge ${sec.cls}`} style={{ marginBottom: '8px' }}>{sec.badge}</span>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: '#334155', lineHeight: 1.55 }}>
                    {sec.items.map((it, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==============================================================
            TAB 3.5: RIWAYAT TIKET SOS & KEJADIAN BANJIR
           ============================================================== */}
        {activeTab === 'riwayat' && (
          <>
            {/* Status Tiket SOS Terkini */}
            <section className="m-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Riwayat Tiket SOS Anda</h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Pelacakan status penjemputan perahu karet</div>
                </div>
                <span className="m-badge aman" style={{ fontSize: '0.74rem', padding: '4px 10px' }}>{myTickets.length} Tiket</span>
              </div>
              {myTickets.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: '#64748b', textAlign: 'center', padding: '22px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  Belum ada riwayat permintaan SOS Anda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myTickets.map((t) => {
                    const st = (t.status || '').toLowerCase()
                    const statusText =
                      st === 'submitted' || st === 'menunggu'
                        ? 'Menunggu Verifikasi'
                        : st === 'verified' || st === 'terverifikasi'
                        ? 'Terverifikasi'
                        : st === 'dispatched' || st === 'armada meluncur'
                        ? 'Armada Meluncur'
                        : st === 'arrived' || st === 'tiba'
                        ? 'Tiba di Lokasi'
                        : st === 'completed' || st === 'selesai'
                        ? 'Selesai'
                        : st === 'rejected' || st === 'dibatalkan'
                        ? 'Dibatalkan'
                        : t.status || 'Menunggu'
                    const badgeClass =
                      st === 'completed' || st === 'selesai'
                        ? 'aman'
                        : st === 'verified' || st === 'terverifikasi'
                        ? 'siaga'
                        : st === 'submitted' || st === 'menunggu'
                        ? 'waspada'
                        : 'awas'

                    return (
                      <div key={t.id} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '0.88rem', color: '#0c1a24' }}>{t.ticket_number || `SOS-${t.id}`}</strong>
                            {t.is_simulation && (
                              <span
                                style={{
                                  background: '#8b5cf6',
                                  color: '#ffffff',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '999px',
                                }}
                              >
                                🎮 SIMULASI
                              </span>
                            )}
                          </div>
                          <span className={`m-badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
                            {statusText}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
                          📍 {t.gps_address || 'Kec. Baureno'} • 👥 {t.family_count || 1} jiwa
                          {t.priority_score != null ? ` (Prioritas: ${t.priority_score})` : ''}
                        </div>
                        {t.assigned_unit && (
                          <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 700, marginTop: '5px' }}>
                            🚤 Tim Penjemput: {t.assigned_unit}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Arsip Riwayat Banjir Baureno (Data Backend / Fallback) */}
            <section className="m-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Riwayat Banjir di Baureno</h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Catatan kejadian banjir &amp; Satu Data Bojonegoro</div>
                </div>
                {floodIncidents.length > 0 && (
                  <span className="m-badge waspada" style={{ fontSize: '0.72rem' }}>{floodIncidents.length} Catatan</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(floodIncidents.length > 0
                  ? floodIncidents.map((inc) => {
                      const rawDate = inc.incident_date || inc.date || inc.created_at
                      let dateDisplay = 'Catatan Banjir'
                      if (rawDate) {
                        const d = new Date(rawDate)
                        dateDisplay = !isNaN(d.getTime())
                          ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                          : String(rawDate)
                      }
                      const waterHeight = inc.max_water_level_cm
                        ? `Genangan ${inc.max_water_level_cm} cm`
                        : inc.water_level_m
                        ? `TMA ${Number(inc.water_level_m).toFixed(2)} m`
                        : inc.category || 'Arsip BPBD'
                      const desc =
                        inc.description ||
                        inc.impact_summary ||
                        `${inc.village_name || 'Kecamatan Baureno'}${inc.affected_families ? ` • ${inc.affected_families} KK terdampak` : ''}`
                      return {
                        id: inc.id,
                        date: dateDisplay,
                        peak: waterHeight,
                        impact: desc,
                      }
                    })
                  : [
                      { id: 'fb-1', date: '18 Februari 2024', peak: 'TMA 15.20 m', impact: 'Desa Kadungrejo, Baureno, Tanggungan tergenang 40-70 cm' },
                      { id: 'fb-2', date: '04 Maret 2023', peak: 'TMA 14.85 m', impact: 'Jalan poros desa Baureno-Pucangarum tergenang 30 cm' },
                      { id: 'fb-3', date: '21 Januari 2023', peak: 'TMA 15.05 m', impact: 'Area persawahan dan 85 KK di bantaran sungai dievakuasi' },
                    ]
                ).map((ev, i) => (
                  <div key={ev.id || i} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0c1a24' }}>📅 {ev.date}</strong>
                      <span className="m-badge waspada" style={{ fontSize: '0.72rem' }}>{ev.peak}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.48 }}>{ev.impact}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==============================================================
            TAB 5: LAYANAN DARURAT & KONTAK 24 JAM
           ============================================================== */}
        {(activeTab === 'darurat' || activeTab === 'kontak') && (
          <>
            {/* Quick SOS Trigger Banner */}
            <section className="m-card" style={{ borderTop: `4px solid ${isEmergency ? '#dc2626' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={`m-badge ${isEmergency ? 'awas' : 'waspada'}`}>
                  {isEmergency ? '🚨 STATUS DARURAT AKTIF' : 'ℹ️ LAYANAN EVAKUASI'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>24 Jam Siaga</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800 }}>Butuh Evakuasi Darurat BPBD?</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.45 }}>
                Kirimkan koordinat GPS dan rincian keluarga rentan Anda langsung ke monitor Pusdalops BPBD Baureno.
              </p>
              <button
                type="button"
                className="m-btn m-btn-danger"
                onClick={handleSOSClick}
              >
                <span>🚨 Buka Formulir Panggilan SOS</span>
              </button>
            </section>

            {/* Kontak Telepon Darurat */}
            <section className="m-card">
              <h2 style={{ margin: '0 0 6px', fontSize: '1.12rem', fontWeight: 800 }}>
                Kontak Darurat 24 Jam (Kec. Baureno)
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#64748b' }}>
                Ketuk tombol telepon di bawah untuk langsung menghubungi petugas siaga.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Pusdalops BPBD Baureno', role: 'Komando Utama Evakuasi & Perahu Karet', phone: '0353881234', display: '(0353) 881-234' },
                  { name: 'Posko Siaga Kecamatan Baureno', role: 'Koordinasi Posko & Logistik Warga', phone: '08113222333', display: '0811-3222-333' },
                  { name: 'Puskesmas Baureno (Ambulans)', role: 'Layanan Medis & Ibu Hamil/Lansia', phone: '0353891118', display: '(0353) 891-118' },
                  { name: 'Polsek & Koramil Baureno', role: 'Patroli Keamanan & Penyelamatan', phone: '110', display: 'Call Center 110' },
                ].map((c) => (
                  <div key={c.name} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0c1a24' }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{c.role}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00828f', marginTop: '4px' }}>📞 {c.display}</div>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      style={{
                        background: '#009aa6',
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        flexShrink: 0,
                      }}
                    >
                      Hubungi
                    </a>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* BOTTOM SHEET: NOTIFIKASI & KABAR DARURAT (RAMAH LANSIA) */}
      {showNotifSheet && (
        <div className="m-modal-overlay" onClick={() => setShowNotifSheet(false)}>
          <div
            className="m-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '22px 18px 26px', borderRadius: '24px 24px 0 0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>🔔</span>
                <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#0c1a24' }}>
                  Kabar &amp; Peringatan
                </h3>
              </div>
              <button
                type="button"
                className="m-icon-btn"
                onClick={() => setShowNotifSheet(false)}
                aria-label="Tutup Notifikasi"
                style={{ width: '38px', height: '38px', fontSize: '1rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#64748b' }}>
              {activeUnread > 0
                ? `Ada ${activeUnread} kabar baru yang belum Anda baca.`
                : 'Semua kabar sudah Anda baca.'}
            </p>

            {activeUnread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  borderRadius: '11px',
                  background: '#e6f6f8',
                  color: '#00828f',
                  border: '1px solid #bae6fd',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>✓</span>
                <span>Tandai Semua Sudah Dibaca</span>
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '52vh', overflowY: 'auto', paddingBottom: '6px' }}>
              {localNotifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔔</div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0c1a24', marginBottom: '4px' }}>
                    Belum Ada Kabar Baru
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                    Peringatan dini banjir &amp; info resmi dari petugas BPBD akan muncul di sini.
                  </div>
                </div>
              ) : (
                localNotifs.map((item) => {
                  const isSos = item.type?.includes('sos')
                  const isFlood = item.type?.includes('flood')
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleMarkAsRead(item.id)}
                      style={{
                        padding: '14px',
                        borderRadius: '14px',
                        border: !item.read ? '1.5px solid #009aa6' : '1px solid #e2e8f0',
                        background: !item.read ? '#f0fdfa' : '#ffffff',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '11px',
                          background: isSos ? '#fee2e2' : isFlood ? '#ffedd5' : '#e0f2fe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                        }}
                      >
                        {isSos ? '🚨' : isFlood ? '🌊' : 'ℹ️'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0c1a24', lineHeight: 1.25 }}>
                            {item.title}
                          </span>
                          {!item.read && (
                            <span
                              style={{
                                background: '#009aa6',
                                color: '#ffffff',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                flexShrink: 0,
                              }}
                            >
                              BARU
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: '#334155', lineHeight: 1.48 }}>
                          {item.message}
                        </p>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                          {formatNotifTime(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="m-btn m-btn-navy"
                style={{ minHeight: '48px', fontSize: '0.92rem', borderRadius: '12px' }}
                onClick={() => setShowNotifSheet(false)}
              >
                Tutup
              </button>
              {localNotifs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllNotifs}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Hapus Semua Riwayat Kabar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET: PILIH DESA */}
      {showVillageSheet && (
        <div className="m-modal-overlay" onClick={() => setShowVillageSheet(false)}>
          <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '22px 18px 26px', borderRadius: '24px 24px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>Pilih Desa Anda</h3>
              <button type="button" className="m-icon-btn" onClick={() => setShowVillageSheet(false)} style={{ width: '38px', height: '38px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '55vh', overflowY: 'auto' }}>
              {villages.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVillageId(v.id)
                    const updated = { ...userProfile, village_id: v.id }
                    setUserProfile(updated)
                    try {
                      localStorage.setItem('sigab_user_profile', JSON.stringify(updated))
                    } catch (_) {}
                    wsService.updateVillage(v.id, 'alerts')
                    apiFetch(`/emergency/${v.id}`)
                      .then((res) => setRealEmergencyActive(res?.is_emergency_active || false))
                      .catch(() => {})
                    setShowVillageSheet(false)
                  }}
                  style={{
                    padding: '13px 16px',
                    borderRadius: '12px',
                    border: Number(v.id) === Number(activeVillage.id) ? '2px solid #009aa6' : '1px solid #e2e8f0',
                    background: Number(v.id) === Number(activeVillage.id) ? '#f0fdfa' : '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0c1a24' }}>Desa {v.cleanName}</span>
                  <span className={`m-badge ${v.risk_level}`} style={{ fontSize: '0.74rem', padding: '4px 10px' }}>{Number(v.probability).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE & LOGOUT MODALS */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile((prev) => {
            const next = { ...prev, ...updated }
            if (updated.village_id) {
              const vId = Number(updated.village_id)
              setSelectedVillageId(vId)
              wsService.updateVillage(vId, 'alerts')
              apiFetch(`/emergency/${vId}`)
                .then((res) => setRealEmergencyActive(res?.is_emergency_active || false))
                .catch(() => {})
            }
            try {
              localStorage.setItem('sigab_user_profile', JSON.stringify(next))
            } catch (_) {}
            return next
          })
        }}
      />
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />

      {/* MODAL PENOLAKAN SOS OTOMATIS */}
      {showRejectModal && (
        <div className="m-modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div
            className="m-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px 28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '30px',
                margin: '0 auto 14px',
              }}
            >
              🔒
            </div>

            <span className={`m-badge ${activeVillage.risk_level}`} style={{ marginBottom: '10px' }}>
              STATUS DESA: {riskLabelMap[activeVillage.risk_level] || 'AMAN'} ({Math.round(activeVillage.probability)}%)
            </span>

            <h3 style={{ margin: '8px 0 8px', fontSize: '1.18rem', fontWeight: 800, color: '#0f172a' }}>
              Pengiriman SOS Ditolak Otomatis
            </h3>

            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
              Mohon maaf, pengiriman tiket evakuasi SOS ke Pusdalops BPBD <strong>hanya aktif</strong> jika status wilayah berada pada level <strong>DARURAT / AWAS</strong> (probabilitas ≥ 76%), atau saat <strong>Simulasi Akun Warga</strong> mencapai status AWAS.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '18px',
                textAlign: 'left',
                fontSize: '0.76rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              🧪 <strong>Ingin mencoba fitur pengiriman SOS?</strong>
              <br />
              Nyalakan <strong>Simulasi Akun Warga</strong> untuk menguji alur banjir bertahap, atau langsung aktifkan <strong>Fase AWAS (94%)</strong> agar tombol pengiriman SOS dapat langsung digunakan.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="m-btn m-btn-danger"
                style={{ width: '100%', padding: '13px', fontSize: '0.85rem', fontWeight: 800 }}
                onClick={() => {
                  personalSim.startSimulation(3) // Jump to AWAS (index 3)
                  playSosAlertTone()
                  setShowRejectModal(false)
                  setActiveTab('sos')
                }}
              >
                🚨 Aktifkan Fase AWAS (94%) & Buka SOS
              </button>

              <button
                type="button"
                className="m-btn m-btn-teal"
                style={{ width: '100%', padding: '11px', fontSize: '0.82rem', fontWeight: 700 }}
                onClick={() => {
                  personalSim.startSimulation(0) // Start from Phase 1: Aman
                  playSosAlertTone()
                  setShowRejectModal(false)
                  setActiveTab('beranda')
                }}
              >
                ▶ Mulai Simulasi Bertahap (Fase 1: Aman)
              </button>

              <button
                type="button"
                className="m-btn m-btn-outline"
                style={{ width: '100%', padding: '11px', fontSize: '0.82rem' }}
                onClick={() => setShowRejectModal(false)}
              >
                Tutup & Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED 5-TAB MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="m-bottom-nav" aria-label="Navigasi Mobile Warga">
        <div className="m-nav-row">
          {/* Tab 1: Beranda */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'beranda' ? 'active' : ''}`}
            onClick={() => setActiveTab('beranda')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" />
                <path d="M10 21v-7a1 1 0 011-1h2a1 1 0 011 1v7" />
              </svg>
            </div>
            <span className="m-nav-label">Beranda</span>
          </button>

          {/* Tab 2: Peta & Posko */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'peta' ? 'active' : ''}`}
            onClick={() => setActiveTab('peta')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
            </div>
            <span className="m-nav-label">Peta & Posko</span>
          </button>

          {/* Tab 3: Riwayat */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'riwayat' ? 'active' : ''}`}
            onClick={() => setActiveTab('riwayat')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
            <span className="m-nav-label">Riwayat</span>
          </button>

          {/* Tab 4: Panduan */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'panduan' ? 'active' : ''}`}
            onClick={() => setActiveTab('panduan')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h5A2.5 2.5 0 0 1 12 4.5v15a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 1 2 15v-10.5z" />
                <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2h-5A2.5 2.5 0 0 0 12 4.5v15a2 2 0 0 1 2-2h5.5a2.5 2.5 0 0 0 2.5-2.5v-10.5z" />
              </svg>
            </div>
            <span className="m-nav-label">Panduan</span>
          </button>

          {/* Tab 5: Darurat */}
          <button
            type="button"
            className={`m-nav-item ${activeTab === 'darurat' || activeTab === 'kontak' || activeTab === 'sos' ? 'active' : ''}`}
            onClick={() => setActiveTab('darurat')}
          >
            <div className="m-nav-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <span className="m-nav-label">Darurat</span>
          </button>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="m-home-indicator" />
      </nav>
    </div>
  )
}
