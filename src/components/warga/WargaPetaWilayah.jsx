import { useState, useMemo } from 'react'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'
import RiskMap from '../RiskMap'

const initialVillages = [
  // Fallback initial data
  { id: 'tulungrejo', name: 'Tulungrejo', tma: 1.2, status: 'aman' },
  { id: 'baureno', name: 'Baureno', tma: 1.2, status: 'aman', defaultSelected: true },
  { id: 'kedungrejo', name: 'Kedungrejo', tma: 2.2, status: 'waspada' },
]

const poskoData = [
  { name: 'Posko SDN Baureno 2', distance: '1.2 km', capacity: '120 orang', status: 'Standby' },
  { name: 'Balai Desa Gunungsari', distance: '2.8 km', capacity: '80 orang', status: 'Standby' },
  { name: 'Masjid Agung Baureno', distance: '3.1 km', capacity: '200 orang', status: 'Standby' },
]

export default function WargaPetaWilayah() {
  const { data } = useDashboardRealtime()
  
  const displayVillages = useMemo(() => {
    if (!data?.villages) return initialVillages;
    return data.villages.map(v => ({
      id: v.name,
      name: v.name,
      status: v.risk_level === 'rendah' || v.risk_level === 'aman' ? 'aman' : 'waspada',
      tma: v.probability.toFixed(1) + '%'
    }));
  }, [data]);

  const displayPosko = useMemo(() => {
    if (!data?.shelters) return poskoData;
    return data.shelters.map(s => ({
      name: s.name,
      distance: s.address, // Use address as distance fallback for now
      capacity: `${s.capacity_occupied}/${s.capacity_total} orang`,
      status: 'Standby'
    })).slice(0, 3);
  }, [data]);

  const [selectedVillage, setSelectedVillage] = useState(
    displayVillages.find((v) => v.id.toLowerCase() === 'baureno') || displayVillages[0]
  )

  const amanCount = displayVillages.filter(v => v.status === 'aman').length;
  const waspadaCount = displayVillages.filter(v => v.status === 'waspada').length;

  return (
    <section className="warga-section">
      <div className="warga-section-header">
        <span className="warga-tag-pill green">Peta Wilayah</span>
        <div className="warga-title-row">
          <div className="warga-title-col">
            <h1>Sebaran Risiko 25 Desa — Kecamatan Baureno</h1>
            <p>
              Peta spasial interaktif kartografis berbasis pemodelan debit Sungai Bengawan Solo & curah hujan BMKG.
              Diperbarui tiap 60 detik.
            </p>
          </div>
          <button type="button" className="peta-action-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Lapisan: Risiko Banjir
          </button>
        </div>
      </div>

      <div className="peta-grid-layout">
        {/* Left Column: Interactive Map Box */}
        <div className="peta-map-card">
          <div className="peta-map-topbar">
            <div className="peta-status-badge">
              <span className="peta-status-pill">● Status Normal</span>
              <span>upd 08:42 WIB</span>
            </div>
          </div>
          <div className="peta-canvas-container" style={{ padding: '0', backgroundColor: '#e5e7eb', position: 'relative', height: '500px' }}>
            <RiskMap />
            <div className="map-legend-bottom">
              <span><i className="red-dot" /> Tinggi / Awas (8)</span>
              <span><i className="orange-dot" /> Sedang / Siaga (8)</span>
              <span><i className="green-dot" /> Rendah / Aman (9)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Village & Shelters */}
        <div className="peta-sidebar">
          {/* Card 1: Selected Village Details */}
          <div className="peta-selected-card">
            <span className="peta-sel-header">DESA TERPILIH</span>
            <h2 className="peta-sel-title">{selectedVillage.name}</h2>

            <div className="peta-sel-metrics">
              <div className="peta-sel-num-wrap">
                <span className="peta-sel-num">{selectedVillage.tma}</span>
                <span className="peta-sel-unit">TMA (mdpl)</span>
              </div>
              <div className="peta-sel-status-badge">
                <span className="peta-sel-status-pill">{selectedVillage.status === 'aman' ? 'AMAN' : 'WASPADA'}</span>
                <span className="peta-sel-status-sub">Status kini</span>
              </div>
            </div>

            <div className="peta-sel-alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {selectedVillage.status === 'aman'
                  ? 'Debit sungai normal, tidak ada ancaman luapan air.'
                  : 'Kondisi siaga sedang, pemantauan berkala tetap dilakukan.'}
              </span>
            </div>
          </div>

          {/* Card 2: Nearest Shelters */}
          <div className="peta-posko-card">
            <div className="peta-posko-head">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Posko Terdekat
            </div>

            <div className="peta-posko-list">
              {displayPosko.map((posko, idx) => (
                <div key={idx} className="peta-posko-item">
                  <div className="peta-posko-row1">
                    <span className="peta-posko-name">{posko.name}</span>
                    <span className="peta-posko-dist">{posko.distance}</span>
                  </div>
                  <div className="peta-posko-row2">
                    <span>Kapasitas {posko.capacity}</span>
                    <span className="peta-posko-standby">{posko.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Source Note */}
          <div className="peta-datasource-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              Data debit bersumber dari <strong>Open-Meteo GloFAS (Bengawan Solo)</strong> &amp; sensor TMA lokal.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
