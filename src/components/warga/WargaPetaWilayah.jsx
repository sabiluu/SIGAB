import { useState, useMemo } from 'react'
import useDashboardRealtime from '../../hooks/useDashboardRealtime'

const initialVillages = [
  // Row 1 (Near River)
  { id: 'tulungrejo', name: 'Tulungrejo', tma: 1.2, status: 'aman', row: 1 },
  { id: 'kalisari', name: 'Kalisari', tma: 1.0, status: 'aman', row: 1 },
  { id: 'baureno', name: 'Baureno', tma: 1.2, status: 'aman', row: 1, defaultSelected: true },
  { id: 'trojalu', name: 'Trojalu', tma: 1.1, status: 'aman', row: 1 },
  { id: 'gajah', name: 'Gajah', tma: 1.3, status: 'aman', row: 1 },
  { id: 'sraturejo', name: 'Sraturejo', tma: 0.9, status: 'aman', row: 1 },

  // Row 2 (Middle Belt)
  { id: 'kedungrejo', name: 'Kedungrejo', tma: 2.2, status: 'waspada', row: 2 },
  { id: 'pasinan', name: 'Pasinan', tma: 2.1, status: 'waspada', row: 2 },
  { id: 'tanggungan', name: 'Tanggungan', tma: 1.4, status: 'waspada', row: 2 },
  { id: 'karangdayu', name: 'Karangdayu', tma: 1.9, status: 'waspada', row: 2 },
  { id: 'ngemplak', name: 'Ngemplak', tma: 1.8, status: 'waspada', row: 2 },
  { id: 'sumberagung', name: 'Sumberagung', tma: 1.4, status: 'aman', row: 2 },
  { id: 'banjaranyar', name: 'Banjaranyar', tma: 1.3, status: 'aman', row: 2 },

  // Row 3 (South Belt)
  { id: 'gunungsari', name: 'Gunungsari', tma: 1.1, status: 'aman', row: 3 },
  { id: 'drajat', name: 'Drajat', tma: 1.0, status: 'aman', row: 3 },
  { id: 'blongsong', name: 'Blongsong', tma: 1.1, status: 'aman', row: 3 },
  { id: 'kauman', name: 'Kauman', tma: 0.9, status: 'aman', row: 3 },
  { id: 'leran', name: 'Leran', tma: 1.0, status: 'aman', row: 3 },
  { id: 'sembung', name: 'Sembung', tma: 0.8, status: 'aman', row: 3 },
  { id: 'bumiayu', name: 'Bumiayu', tma: 2.0, status: 'waspada', row: 3 },

  // Row 4 (South Basin)
  { id: 'pomahan', name: 'Pomahan', tma: 0.8, status: 'aman', row: 4 },
  { id: 'semenpinggir', name: 'Semenpinggir', tma: 0.9, status: 'aman', row: 4 },
  { id: 'tlogoagung', name: 'Tlogoagung', tma: 1.0, status: 'aman', row: 4 },
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
    return initialVillages.map(v => {
      const live = data.villages.find(lv => lv.name.toLowerCase() === v.id.toLowerCase());
      if (live) {
        return { ...v, status: live.risk_level === 'rendah' ? 'aman' : 'waspada', tma: live.probability.toFixed(1) + '%' };
      }
      return v;
    });
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
    displayVillages.find((v) => v.id === 'baureno') || displayVillages[2]
  )
  const [zoomLevel, setZoomLevel] = useState(100)

  const amanCount = displayVillages.filter(v => v.status === 'aman').length;
  const waspadaCount = displayVillages.filter(v => v.status === 'waspada').length;
  const bahayaCount = displayVillages.filter(v => v.status === 'bahaya').length;

  return (
    <section className="warga-section">
      <div className="warga-section-header">
        <span className="warga-tag-pill green">Peta Wilayah</span>
        <div className="warga-title-row">
          <div className="warga-title-col">
            <h1>Sebaran Risiko 23 Desa — Kecamatan Baureno</h1>
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
              <span className="peta-status-pill">● Status Normal</span>
              <span>upd 08:42 WIB</span>
            </div>
          </div>

          <div className="peta-canvas-container">
            {/* Top Floating Badge */}
            <div className="peta-layer-badge">
              <span style={{ color: '#10b981' }}>●</span>
              Lapisan: Status Normal (Kondisi Terkini)
            </div>

            {/* Floating Image-like Legend */}
            <div className="peta-image-legend">
              <div className="legend-row-img">
                <div className="legend-pill-img waspada">WASPADA</div>
                <div className="legend-circle-img waspada">{waspadaCount}</div>
              </div>
              <div className="legend-row-img">
                <div className="legend-pill-img aman">AMAN</div>
                <div className="legend-circle-img aman">{amanCount}</div>
              </div>
              <div className="legend-row-img">
                <div className="legend-pill-img bahaya">BAHAYA</div>
                <div className="legend-circle-img bahaya">{bahayaCount}</div>
              </div>
            </div>

            {/* Floating Navigation Controls */}
            <div className="peta-map-controls">
              <button
                type="button"
                className="peta-ctrl-btn"
                title="Perbesar"
                onClick={() => setZoomLevel((z) => Math.min(z + 10, 130))}
              >
                +
              </button>
              <button
                type="button"
                className="peta-ctrl-btn"
                title="Perkecil"
                onClick={() => setZoomLevel((z) => Math.max(z - 10, 80))}
              >
                −
              </button>
              <button type="button" className="peta-ctrl-btn peta-ctrl-compass" title="Arah Utara">
                <span>▲</span>
                <span>N</span>
              </button>
              <button
                type="button"
                className="peta-ctrl-btn"
                title="Pusatkan"
                onClick={() => {
                  setSelectedVillage(displayVillages.find((v) => v.id === 'baureno'))
                  setZoomLevel(100)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
              </button>
            </div>

            {/* River Section */}
            <div className="peta-river-section">
              <div className="peta-tuban-label">KABUPATEN TUBAN (SEBERANG BENGAWAN SOLO)</div>
              <div className="peta-river-band">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6c4-2 6 2 10 0s6 2 10 0" />
                  <path d="M2 12c4-2 6 2 10 0s6 2 10 0" />
                  <path d="M2 18c4-2 6 2 10 0s6 2 10 0" />
                </svg>
                ALIRAN SUNGAI BENGAWAN SOLO &nbsp;|&nbsp; [KONDISI AIR TENANG]
              </div>
            </div>

            {/* Village Grid (Zoomable container) */}
            <div
              className="peta-villages-grid"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              {/* Row 1: 6 Villages */}
              <div className="peta-row peta-row-6">
                {displayVillages
                  .filter((v) => v.row === 1)
                  .map((v) => {
                    const isSel = selectedVillage.id === v.id
                    return (
                      <div
                        key={v.id}
                        className={`peta-village-cell ${v.status === 'aman' ? 'green' : 'orange'} ${
                          isSel ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedVillage(v)}
                      >
                        {isSel && (
                          <div className="peta-selected-tooltip">
                            <span>★</span> {v.name.toUpperCase()} TMA {v.tma} mdpl
                          </div>
                        )}
                        <span className="peta-v-name">{v.name}</span>
                        <span className="peta-v-tma">TMA {v.tma}</span>
                      </div>
                    )
                  })}
              </div>

              {/* Row 2: 7 Villages */}
              <div className="peta-row peta-row-7">
                {displayVillages
                  .filter((v) => v.row === 2)
                  .map((v) => {
                    const isSel = selectedVillage.id === v.id
                    return (
                      <div
                        key={v.id}
                        className={`peta-village-cell ${v.status === 'aman' ? 'green' : 'orange'} ${
                          isSel ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedVillage(v)}
                      >
                        {isSel && (
                          <div className="peta-selected-tooltip">
                            <span>★</span> {v.name.toUpperCase()} TMA {v.tma} mdpl
                          </div>
                        )}
                        <span className="peta-v-name">{v.name}</span>
                        <span className="peta-v-tma">TMA {v.tma}</span>
                      </div>
                    )
                  })}
              </div>

              {/* Road Divider across map */}
              <div className="peta-road-divider">
                <span className="peta-road-label">JALAN NASIONAL BABAT - BOJONEGORO (LAJUR AMAN)</span>
              </div>

              {/* Row 3: 7 Villages */}
              <div className="peta-row peta-row-7">
                {displayVillages
                  .filter((v) => v.row === 3)
                  .map((v) => {
                    const isSel = selectedVillage.id === v.id
                    return (
                      <div
                        key={v.id}
                        className={`peta-village-cell ${v.status === 'aman' ? 'green' : 'orange'} ${
                          isSel ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedVillage(v)}
                      >
                        {isSel && (
                          <div className="peta-selected-tooltip">
                            <span>★</span> {v.name.toUpperCase()} TMA {v.tma} mdpl
                          </div>
                        )}
                        <span className="peta-v-name">{v.name}</span>
                        <span className="peta-v-tma">TMA {v.tma}</span>
                      </div>
                    )
                  })}
              </div>

              {/* Row 4: 3 Villages */}
              <div className="peta-row peta-row-3">
                {displayVillages
                  .filter((v) => v.row === 4)
                  .map((v) => {
                    const isSel = selectedVillage.id === v.id
                    return (
                      <div
                        key={v.id}
                        className={`peta-village-cell ${v.status === 'aman' ? 'green' : 'orange'} ${
                          isSel ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedVillage(v)}
                      >
                        {isSel && (
                          <div className="peta-selected-tooltip">
                            <span>★</span> {v.name.toUpperCase()} TMA {v.tma} mdpl
                          </div>
                        )}
                        <span className="peta-v-name">{v.name}</span>
                        <span className="peta-v-tma">TMA {v.tma}</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Bottom Bar on Map */}
            <div className="peta-map-bottombar">
              <div className="peta-scale-box">
                <span>1 : 25.000</span>
                <span className="peta-scale-line">
                  <span className="peta-scale-bar" /> 1 km
                </span>
                <span>EPSG:4326 Bojonegoro</span>
              </div>
              <div className="peta-avg-tma-badge">
                <span style={{ color: '#34d399' }}>●</span>
                Tinggi Muka Air (TMA) Rata-rata: 1.12 mdpl (Aman)
              </div>
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
