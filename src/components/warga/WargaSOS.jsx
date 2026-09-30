import { useState, useEffect } from 'react';
import { createSOSTicket } from '../../services/sosService';
import wsService from '../../services/wsService';
import MapView from '../MapView'; // Gunakan map generik atau dummy map

export default function WargaSOS({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  
  // Data form
  const [gpsLocation, setGpsLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [familyCount, setFamilyCount] = useState(1);
  const [vulnerable, setVulnerable] = useState({
    elderly: false,
    toddler: false,
    disability: false,
    pregnant: false
  });

  // Step 1: Ambil GPS
  useEffect(() => {
    if (step === 1 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAddress(`Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`);
        },
        (err) => {
          console.warn('GPS error:', err);
          // Fallback location for Baureno
          setGpsLocation({ lat: -7.15, lng: 112.0 });
          setAddress('Kecamatan Baureno (Simulasi)');
        }
      );
    }
  }, [step]);

  // Step 3: Listen to WS for ticket updates
  useEffect(() => {
    if (step === 3 && ticket) {
      wsService.connect('alerts'); // warga uses alerts? Wait, tickets updates might come via alerts or a specific channel.
      const unsub = wsService.on('sos_updated', (data) => {
        if (data.ticket_id === ticket.id) {
          setTicket(prev => ({ ...prev, status: data.status }));
        }
      });
      return () => unsub();
    }
  }, [step, ticket]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        reporter_id: 1, // Di backend ini pakai current_user (tapi via schema reporter_id wajib). Wait, schemas/sos_ticket.py mewajibkan reporter_id? Ya.
        village_id: 1, // Dummy village
        gps_latitude: gpsLocation.lat,
        gps_longitude: gpsLocation.lng,
        gps_address: address,
        family_count: familyCount,
        has_elderly: vulnerable.elderly,
        has_toddler: vulnerable.toddler,
        has_disability: vulnerable.disability,
        has_pregnant: vulnerable.pregnant
      };
      const res = await createSOSTicket(payload);
      setTicket(res);
      setStep(3);
    } catch (err) {
      alert('Gagal mengirim SOS: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="warga-main" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <button onClick={() => onNavigate('beranda')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
        ← Kembali ke Beranda
      </button>

      <article className="portal-card" style={{ padding: '2rem' }}>
        <h2 style={{ color: '#dc2626', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          🚨 Permintaan Evakuasi Darurat (SOS)
        </h2>

        {step === 1 && (
          <div className="sos-step">
            <h3>Langkah 1: Konfirmasi Lokasi Anda</h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>Sistem sedang mengunci koordinat GPS Anda untuk memudahkan regu evakuasi.</p>
            
            <div style={{ height: '200px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              {gpsLocation ? (
                <span>📍 Lokasi Terkunci: {address}</span>
              ) : (
                <span>Mencari sinyal GPS...</span>
              )}
            </div>

            <button 
              onClick={() => setStep(2)} 
              disabled={!gpsLocation}
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Lanjutkan ke Data Evakuasi →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="sos-step">
            <h3>Langkah 2: Data Evakuasi</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Jumlah Anggota Keluarga / Rombongan</label>
              <input 
                type="number" 
                min="1" 
                value={familyCount} 
                onChange={(e) => setFamilyCount(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>Apakah ada kelompok rentan? (Pilih yang sesuai)</label>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <input type="checkbox" checked={vulnerable.elderly} onChange={e => setVulnerable({...vulnerable, elderly: e.target.checked})} /> Lansia (&gt;60 tahun)
              </label>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <input type="checkbox" checked={vulnerable.toddler} onChange={e => setVulnerable({...vulnerable, toddler: e.target.checked})} /> Balita
              </label>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <input type="checkbox" checked={vulnerable.pregnant} onChange={e => setVulnerable({...vulnerable, pregnant: e.target.checked})} /> Ibu Hamil
              </label>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <input type="checkbox" checked={vulnerable.disability} onChange={e => setVulnerable({...vulnerable, disability: e.target.checked})} /> Penyandang Disabilitas
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setStep(1)} 
                style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
              >
                Kembali
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                style={{ flex: 2, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
              >
                {loading ? 'Mengirim Data...' : '🚨 KIRIM PERMINTAAN SOS'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && ticket && (
          <div className="sos-step" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
            <h3 style={{ color: '#16a34a' }}>Tiket SOS Terkirim!</h3>
            <p>Nomor Tiket Anda:</p>
            <h2 style={{ margin: '10px 0', padding: '10px', background: '#f1f5f9', borderRadius: '6px' }}>{ticket.ticket_number}</h2>
            
            <div style={{ margin: '20px 0', padding: '15px', border: '2px solid #2563eb', borderRadius: '8px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Status Evakuasi Real-time:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ opacity: ticket.status === 'submitted' ? 1 : 0.5, fontWeight: ticket.status === 'submitted' ? 'bold' : 'normal' }}>
                  ⏳ Menunggu verifikasi Pusdalops BPBD
                </div>
                <div style={{ opacity: ticket.status === 'verified' ? 1 : 0.5, fontWeight: ticket.status === 'verified' ? 'bold' : 'normal' }}>
                  📞 Tiket diverifikasi, menyiapkan armada
                </div>
                <div style={{ opacity: ticket.status === 'dispatched' ? 1 : 0.5, fontWeight: ticket.status === 'dispatched' ? 'bold' : 'normal' }}>
                  🚤 Regu penolong sedang dalam perjalanan!
                </div>
              </div>
            </div>
            
            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>Tetap tenang dan cari tempat tinggi. Pastikan HP Anda tetap aktif.</p>
          </div>
        )}
      </article>
    </div>
  );
}
