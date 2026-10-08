import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { createSOSTicket, getMyTickets } from '../../services/sosService';
import wsService from '../../services/wsService';
import { useAuth } from '../../context/AuthContext';

import useGeolocation from '../../hooks/useGeolocation';

const userPinIcon = L.divIcon({
  className: 'custom-sos-pin',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(220, 38, 38, 0.4); animation: pulse 1.5s infinite;"></div>
      <div style="background-color: #dc2626; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
        📍
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function WargaSOS({ onNavigate, geo: externalGeo }) {
  const { user } = useAuth();
  const internalGeo = useGeolocation();
  const geo = externalGeo || internalGeo;

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  
  // Riwayat tiket warga
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Data form - sinkron dengan GPS device nyata
  const [gpsLocation, setGpsLocation] = useState(
    geo?.position ? { lat: geo.position.latitude, lng: geo.position.longitude } : null
  );
  const [address, setAddress] = useState(
    geo?.fullAddress || geo?.address || 'Mencari lokasi perangkat...'
  );
  const [detailPatokan, setDetailPatokan] = useState('');
  const [familyCount, setFamilyCount] = useState(1);
  const [vulnerable, setVulnerable] = useState({
    elderly: false,
    toddler: false,
    disability: false,
    pregnant: false
  });

  // Sinkronkan GPS otomatis saat terdeteksi
  useEffect(() => {
    if (geo?.position?.latitude && geo?.position?.longitude) {
      setGpsLocation({ lat: geo.position.latitude, lng: geo.position.longitude });
      if (geo.fullAddress || geo.address) {
        setAddress(geo.fullAddress || geo.address);
      }
    }
  }, [geo?.position?.latitude, geo?.position?.longitude, geo?.fullAddress, geo?.address]);

  // Handler Refresh GPS
  const detectGPS = () => {
    if (geo?.refresh) {
      geo.refresh();
    }
  };

  // Load ticket history
  const loadMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await getMyTickets();
      setMyTickets(res || []);
    } catch (err) {
      console.error('Gagal memuat tiket warga:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadMyTickets();
    }
  }, [activeTab]);

  // WebSocket listener for SOS events on channel 'alerts'
  useEffect(() => {
    wsService.connect('alerts');

    const handleSOSUpdate = (data) => {
      // Update active ticket if matches
      if (ticket && data.ticket_id === ticket.id) {
        setTicket(prev => ({ 
          ...prev, 
          status: data.status,
          assigned_unit: data.extra_data?.assigned_unit || prev.assigned_unit 
        }));
      }

      // Update list of myTickets if present
      setMyTickets(prev => prev.map(t => {
        if (t.id === data.ticket_id) {
          return { 
            ...t, 
            status: data.status,
            assigned_unit: data.extra_data?.assigned_unit || t.assigned_unit 
          };
        }
        return t;
      }));
    };

    const events = ['sos_verified', 'sos_dispatched', 'sos_arrived', 'sos_completed', 'sos_rejected', 'sos_updated'];
    const unsubs = events.map(evt => wsService.on(evt, handleSOSUpdate));

    return () => unsubs.forEach(unsub => unsub());
  }, [ticket]);

  const handleSubmit = async () => {
    if (!gpsLocation) {
      alert('Lokasi GPS belum terkunci. Mohon tunggu atau refresh GPS.');
      return;
    }
    setLoading(true);
    try {
      const fullAddress = detailPatokan.trim() 
        ? `${address} (Patokan: ${detailPatokan.trim()})`
        : address;

      const payload = {
        reporter_id: user?.id || 1,
        village_id: user?.village_id || 1,
        gps_latitude: gpsLocation.lat,
        gps_longitude: gpsLocation.lng,
        gps_address: fullAddress,
        family_count: familyCount,
        has_elderly: vulnerable.elderly,
        has_toddler: vulnerable.toddler,
        has_disability: vulnerable.disability,
        has_pregnant: vulnerable.pregnant
      };
      const res = await createSOSTicket(payload);
      setTicket(res);
      setStep(3);
      // Auto add to myTickets list
      setMyTickets(prev => [res, ...prev]);
    } catch (err) {
      alert('Gagal mengirim SOS: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Menunggu Verifikasi</span>;
      case 'verified':
        return <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Terverifikasi</span>;
      case 'dispatched':
        return <span style={{ background: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Armada Meluncur</span>;
      case 'arrived':
        return <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Tiba di Lokasi</span>;
      case 'completed':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Selesai</span>;
      case 'rejected':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Dibatalkan</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>{status}</span>;
    }
  };

  const renderTrackerSteps = (currentStatus, assignedUnit) => {
    const stepsConfig = [
      { key: 'submitted', title: '1. Tiket Diterima', desc: 'Menunggu konfirmasi petugas Pusdalops BPBD' },
      { key: 'verified', title: '2. Terverifikasi', desc: 'Petugas sedang menyusun koordinasi regu lapangan' },
      { key: 'dispatched', title: '3. Armada Bergerak', desc: assignedUnit ? `Armada ditugaskan: ${assignedUnit}` : 'Perahu karet & personel SAR dalam perjalanan' },
      { key: 'arrived', title: '4. Tiba di Lokasi', desc: 'Tim SAR telah tiba di titik evakuasi Anda' },
      { key: 'completed', title: '5. Selesai Evakuasi', desc: 'Warga telah dievakuasi ke tempat aman/posko' },
    ];

    const order = ['submitted', 'verified', 'dispatched', 'arrived', 'completed'];
    const currentIndex = order.indexOf(currentStatus);

    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {stepsConfig.map((s, idx) => {
          const isDone = currentIndex >= idx;
          const isCurrent = currentIndex === idx;

          return (
            <div key={s.key} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isDone ? (isCurrent ? '#dc2626' : '#16a34a') : '#e2e8f0',
                color: isDone ? 'white' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '12px',
                flexShrink: 0,
                boxShadow: isCurrent ? '0 0 0 4px rgba(220, 38, 38, 0.2)' : 'none'
              }}>
                {isDone && !isCurrent ? '✓' : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: isCurrent ? 'bold' : '600', color: isCurrent ? '#dc2626' : (isDone ? '#1e293b' : '#94a3b8') }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '12px', color: isDone ? '#64748b' : '#94a3b8' }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="warga-main" style={{ maxWidth: '820px', margin: '0 auto', paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <button 
        onClick={() => onNavigate('beranda')} 
        style={{ marginBottom: '16px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
      >
        ← Kembali ke Beranda
      </button>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'create' ? '#ffffff' : 'transparent',
            color: activeTab === 'create' ? '#dc2626' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: activeTab === 'create' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          🚨 Buat Tiket SOS Baru
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'history' ? '#ffffff' : 'transparent',
            color: activeTab === 'history' ? '#2563eb' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📋 Status & Riwayat Tiket Saya {myTickets.length > 0 && `(${myTickets.length})`}
        </button>
      </div>

      {/* TAB 1: FORM SOS BARU */}
      {activeTab === 'create' && (
        <article className="portal-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#dc2626', margin: 0, fontSize: '1.4rem' }}>
              🚨 Permintaan Evakuasi Darurat (SOS)
            </h2>
            <span style={{ fontSize: '12px', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Prioritas Tinggi
            </span>
          </div>

          {/* STEP 1: GPS & LOKASI */}
          {step === 1 && (
            <div className="sos-step">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Langkah 1: Konfirmasi Lokasi Anda</h3>
              <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '13px' }}>
                Sistem mengunci koordinat GPS perangkat Anda untuk memandu perahu penyelamat dan armada BPBD langsung ke lokasi.
              </p>
              
              {/* Mini Map */}
              <div style={{ height: '240px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #cbd5e1', position: 'relative' }}>
                {gpsLocation ? (
                  <MapContainer center={[gpsLocation.lat, gpsLocation.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[gpsLocation.lat, gpsLocation.lng]} icon={userPinIcon}>
                      <Popup>Posisi Anda Terkunci</Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
                    📡 Mencari sinyal GPS...
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  📍 {address}
                </span>
                <button
                  type="button"
                  onClick={detectGPS}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔄 Refresh GPS
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: '#334155' }}>
                  Patokan / Alamat Lengkap Tambahan (Opsional)
                </label>
                <input 
                  type="text" 
                  placeholder="Contoh: Depan Musala Nurul Huda RT 03 / Rumah atap biru"
                  value={detailPatokan}
                  onChange={(e) => setDetailPatokan(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <button 
                onClick={() => setStep(2)} 
                disabled={!gpsLocation}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: gpsLocation ? 'pointer' : 'not-allowed',
                  fontSize: '14px'
                }}
              >
                Lanjutkan ke Data Evakuasi →
              </button>
            </div>
          )}

          {/* STEP 2: DATA KORBAN */}
          {step === 2 && (
            <div className="sos-step">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Langkah 2: Data Rombongan &amp; Kelompok Rentan</h3>
              <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '13px' }}>
                Data ini menentukan skor prioritas penyelamatan dan kapasitas perahu SAR yang ditugaskan.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Jumlah Anggota Keluarga / Jiwa
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="50"
                  value={familyCount} 
                  onChange={(e) => setFamilyCount(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
                />
              </div>

              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '10px', fontSize: '13px', color: '#1e293b' }}>
                  Kelompok Rentan (Centang jika ada):
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.elderly} onChange={e => setVulnerable({...vulnerable, elderly: e.target.checked})} />
                  <span>👵 Lansia (&gt;60 tahun) (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.toddler} onChange={e => setVulnerable({...vulnerable, toddler: e.target.checked})} />
                  <span>👶 Balita / Anak-anak (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.pregnant} onChange={e => setVulnerable({...vulnerable, pregnant: e.target.checked})} />
                  <span>🤰 Ibu Hamil (+5 poin prioritas)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vulnerable.disability} onChange={e => setVulnerable({...vulnerable, disability: e.target.checked})} />
                  <span>♿ Penyandang Disabilitas / Sakit Parah (+10 poin prioritas)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setStep(1)} 
                  style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ← Kembali
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  style={{ flex: 2, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {loading ? 'Mengirim Data...' : '🚨 KIRIM PERMINTAAN SOS'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: TIKET BERHASIL & TRACKING LIVE */}
          {step === 3 && ticket && (
            <div className="sos-step">
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '4px' }}>✅</div>
                <h3 style={{ color: '#16a34a', margin: 0 }}>Permintaan SOS Terkirim!</h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>Data Anda telah diterima di Pusdalops BPBD Baureno.</p>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Nomor Tiket:</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{ticket.ticket_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Jumlah Korban:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{ticket.family_count} Jiwa</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Status Saat Ini:</span>
                  {getStatusBadge(ticket.status)}
                </div>
              </div>

              {/* Real-time Tracking Stepper */}
              <div style={{ border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px', background: '#eff6ff', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #bfdbfe', paddingBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#1d4ed8', fontSize: '14px' }}>📡 Pelacakan Evakuasi Real-time</h4>
                  <span style={{ fontSize: '11px', color: '#2563eb', animation: 'pulse 2s infinite' }}>● Terhubung WebSocket</span>
                </div>
                {renderTrackerSteps(ticket.status, ticket.assigned_unit)}
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ color: '#dc2626', fontWeight: 700, margin: '0 0 6px 0', fontSize: '13px' }}>
                  Tetap tenang dan amankan diri di tempat tinggi (lantai 2 / atap).
                </p>
                <div style={{ fontSize: '12px', color: '#991b1b' }}>
                  Butuh bantuan langsung via telepon? Hubungi:
                  <a href="tel:112" style={{ display: 'inline-block', marginLeft: '6px', fontWeight: 800, color: '#dc2626', textDecoration: 'underline' }}>
                    📞 Call Center 112
                  </a>
                </div>
              </div>

              <button
                onClick={() => { setStep(1); setTicket(null); }}
                style={{ width: '100%', padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                + Buat Laporan SOS Baru Lainnya
              </button>
            </div>
          )}
        </article>
      )}

      {/* TAB 2: RIWAYAT & STATUS TIKET WARGA */}
      {activeTab === 'history' && (
        <article className="portal-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
              📋 Riwayat &amp; Status Tiket SOS Anda
            </h2>
            <button
              onClick={loadMyTickets}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              🔄 Segarkan
            </button>
          </div>

          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              ⏳ Memuat riwayat tiket...
            </div>
          ) : myTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛡️</div>
              <h3 style={{ color: '#475569', margin: '0 0 4px 0' }}>Belum Ada Tiket SOS</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                Anda belum pernah mengajukan tiket evakuasi darurat.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                style={{ marginTop: '16px', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Buat Permintaan SOS
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myTickets.map((t) => (
                <div 
                  key={t.id} 
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: t.status === 'dispatched' ? '#fffbeb' : '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginRight: '8px' }}>
                        {t.ticket_number}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(t.submitted_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <div style={{ fontSize: '13px', color: '#334155', marginBottom: '8px' }}>
                    <div>📍 <strong>Lokasi:</strong> {t.gps_address}</div>
                    <div>👥 <strong>Jumlah Korban:</strong> {t.family_count} Jiwa {t.has_elderly ? '• Lansia' : ''} {t.has_toddler ? '• Balita' : ''} {t.has_pregnant ? '• Ibu Hamil' : ''} {t.has_disability ? '• Disabilitas' : ''}</div>
                    {t.assigned_unit && (
                      <div style={{ color: '#b45309', fontWeight: 600, marginTop: '4px' }}>
                        🚤 <strong>Armada Ditugaskan:</strong> {t.assigned_unit}
                      </div>
                    )}
                  </div>

                  {/* Tracker Stepper for In-Progress Tickets */}
                  {['submitted', 'verified', 'dispatched', 'arrived'].includes(t.status) && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                      {renderTrackerSteps(t.status, t.assigned_unit)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </div>
  );
}

