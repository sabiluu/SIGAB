import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useMemo, useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import * as turf from '@turf/turf'
import baurenoVillagesData from '../data/baureno_villages_real.json'
import { apiFetch } from '../services/api'
import { getVillages } from '../services/floodService'

// Center coordinate & boundary bounds for map view - Kecamatan Baureno, Bojonegoro
export const baurenoCenter = [-7.118, 112.102]
export const baurenoBounds = [
  [-7.185, 112.025], // South-West (wider margin showing surrounding districts)
  [-7.050, 112.180]  // North-East (wider margin showing Bandungrejo, Babat)
]

const colorMap = {
  awas: '#ef4444',     // Red (Sangat Tinggi/Awas)
  tinggi: '#f97316',   // Orange (Tinggi/Siaga)
  siaga: '#f97316',    // Fallback if needed
  sedang: '#eab308',   // Yellow (Sedang/Waspada)
  waspada: '#eab308',  // Fallback if needed
  rendah: '#10b981',   // Green (Rendah/Aman)
  aman: '#10b981'      // Fallback if needed
}

// Fallback baselines for 25 Baureno villages matching real database calculation
const fallbackBaselines = {
  pucangarum: { prob: 31.8, level: 'sedang' },
  kalisari: { prob: 30.3, level: 'sedang' },
  lebaksari: { prob: 29.1, level: 'sedang' },
  bumiayu: { prob: 28.7, level: 'sedang' },
  kadungrejo: { prob: 28.4, level: 'sedang' },
  karangdayu: { prob: 27.0, level: 'sedang' },
  sembunglor: { prob: 26.7, level: 'sedang' },
  tanggungan: { prob: 26.4, level: 'sedang' },
  selorejo: { prob: 25.4, level: 'sedang' },
  tlogoagung: { prob: 24.6, level: 'rendah' },
  drajat: { prob: 23.1, level: 'rendah' },
  ngemplak: { prob: 22.8, level: 'rendah' },
  banjaran: { prob: 22.1, level: 'rendah' },
  gunungsari: { prob: 21.6, level: 'rendah' },
  kauman: { prob: 21.0, level: 'rendah' },
  pomahan: { prob: 20.1, level: 'rendah' },
  banjaranyar: { prob: 19.5, level: 'rendah' },
  tulungagung: { prob: 18.9, level: 'rendah' },
  trojalu: { prob: 18.6, level: 'rendah' },
  pasinan: { prob: 15.6, level: 'rendah' },
  baureno: { prob: 15.2, level: 'rendah' },
  blongsong: { prob: 13.8, level: 'rendah' },
  gajah: { prob: 12.5, level: 'rendah' },
  sraturejo: { prob: 11.9, level: 'rendah' },
  sumuragung: { prob: 5.0, level: 'rendah' }
}

function findMatchingVillage(featureName, villageList) {
  if (!villageList || !villageList.length) return null;
  const cleanFeature = featureName.replace(/^Desa\s+/i, '').trim().toLowerCase();
  
  // 1. Exact clean name match
  let found = villageList.find(v => {
    const cleanV = v.name.replace(/^Desa\s+/i, '').trim().toLowerCase();
    return cleanV === cleanFeature;
  });
  if (found) return found;

  // 2. Kadungrejo / Kedungrejo spelling alias
  if (cleanFeature === 'kadungrejo') {
    found = villageList.find(v => v.name.toLowerCase().includes('kedungrejo'));
    if (found) return found;
  }

  // 3. Substring match
  found = villageList.find(v => {
    const cleanV = v.name.replace(/^Desa\s+/i, '').trim().toLowerCase();
    return cleanV.startsWith(cleanFeature) || cleanFeature.startsWith(cleanV);
  });
  return found || null;
}

// Marker Icon Generators
const createShelterIcon = (isSelected, isFull) => L.divIcon({
  className: 'custom-shelter-marker',
  html: `
    <div style="
      background-color: ${isFull ? '#dc2626' : isSelected ? '#1d4ed8' : '#059669'};
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      cursor: pointer;
      ${isSelected ? 'transform: scale(1.15); outline: 3px solid #60a5fa;' : ''}
    ">
      🏠
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(37,99,235,0.4); animation: mapPulse 1.8s infinite ease-out;"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

function MapController({ bounds, recenterTrigger, targetCenter }) {
  const map = useMap();
  const initialFitDone = useRef(false);

  // Initial fit to Baureno bounds on mount so all 25 villages are nicely visible
  useEffect(() => {
    try {
      map.invalidateSize();
    } catch (e) {
      // ignore
    }
    if (!initialFitDone.current) {
      try {
        map.fitBounds(baurenoBounds, { padding: [15, 15] });
        initialFitDone.current = true;
      } catch (e) {
        console.error("Initial fitBounds error:", e);
      }
    }
  }, [map]);

  // Route bounds fit (highest priority when route is active)
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (e) {
        console.error("Route fitBounds error:", e);
      }
    }
  }, [bounds, map]);

  // Target village center selection - pan gently without overzooming
  useEffect(() => {
    if (targetCenter && targetCenter[0] && targetCenter[1]) {
      try {
        // Keep overview zoom so all 25 villages remain visible in context
        map.panTo(targetCenter, { duration: 0.8 });
      } catch (e) {
        console.error("PanTo error:", e);
      }
    }
  }, [targetCenter, map]);

  // Recenter trigger (button "Tampilkan Seluruh Baureno")
  useEffect(() => {
    if (recenterTrigger) {
      try {
        map.fitBounds(baurenoBounds, { padding: [15, 15] });
      } catch (e) {
        map.setView(baurenoCenter, 12);
      }
    }
  }, [recenterTrigger, map]);

  return null;
}

export default function RiskMap({ 
  onSelectVillage, 
  selectedVillageName, 
  shelters = [], 
  villagesData = [],
  onSelectShelter, 
  selectedShelterId,
  userLocation,
  routeCoordinates,
  height = '500px'
}) {
  const [dbVillages, setDbVillages] = useState([]);
  
  useEffect(() => {
    let active = true;
    async function fetchVillageData() {
      // 1. Try real-time dashboard endpoint
      try {
        const realtime = await apiFetch('/dashboard/realtime');
        if (active && realtime && Array.isArray(realtime.villages) && realtime.villages.length > 0) {
          setDbVillages(realtime.villages);
          return;
        }
      } catch (e) {
        // Fallback to /villages
      }

      // 2. Try villages endpoint
      try {
        const vList = await getVillages();
        if (active && Array.isArray(vList) && vList.length > 0) {
          setDbVillages(vList);
        }
      } catch (e) {
        console.warn("Could not fetch villages data:", e);
      }
    }

    fetchVillageData();
    return () => { active = false; };
  }, []);

  const villages = useMemo(() => {
    const finalVillages = [];
    const activeList = (villagesData && villagesData.length > 0) ? villagesData : dbVillages;
    
    baurenoVillagesData.features.forEach((feature, i) => {
      const geom = feature.geometry;
      if (!geom) return;

      const name = feature.properties.adm4_name || feature.properties.name || `Desa ${i+1}`;
      const cleanName = name.replace(/^Desa\s+/i, '').trim().toLowerCase();
      
      let status = 'rendah';
      let prob = 0;
      
      const realVillage = findMatchingVillage(name, activeList);
      
      if (realVillage) {
        const rawProb = realVillage.current_probability != null 
          ? Number(realVillage.current_probability) 
          : (realVillage.probability != null ? Number(realVillage.probability) : 0);
        prob = rawProb;
        status = realVillage.current_risk_level || realVillage.risk_level || (rawProb >= 76 ? 'awas' : (rawProb >= 51 ? 'tinggi' : (rawProb >= 25 ? 'sedang' : 'rendah')));
      } else {
        // Fallback baseline for this specific Baureno village if API is still loading or offline
        const fallback = fallbackBaselines[cleanName];
        if (fallback) {
          prob = fallback.prob;
          status = fallback.level;
        }
      }
      
      const mapCoords = (coords) => coords.map(c => [c[1], c[0]]);
      
      let polygonCoords = [];
      if (geom.type === 'Polygon') {
        polygonCoords = geom.coordinates.map(mapCoords);
      } else if (geom.type === 'MultiPolygon') {
        polygonCoords = geom.coordinates.map(poly => poly.map(mapCoords));
      }
      
      let centerLat = baurenoCenter[0];
      let centerLng = baurenoCenter[1];
      try {
        const centroid = turf.centroid(feature);
        centerLat = centroid.geometry.coordinates[1];
        centerLng = centroid.geometry.coordinates[0];
      } catch (e) {
        console.error("Centroid failed for", name, e);
      }

      finalVillages.push({ 
        id: feature.properties.adm4_pcode || i, 
        name, 
        coords: polygonCoords, 
        center: [centerLat, centerLng], 
        status: status, 
        prob,
        raw: realVillage || null 
      });
    });
    
    return finalVillages;
  }, [dbVillages, villagesData]);

  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Compute bounding box if route is active
  const mapBounds = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length > 1) {
      return routeCoordinates;
    }
    return null;
  }, [routeCoordinates]);

  // Find center of selected village to smoothly fly to it
  const targetVillageCenter = useMemo(() => {
    if (!selectedVillageName) return null;
    const clean = selectedVillageName.replace(/^Desa\s+/i, '').trim().toLowerCase();
    const found = villages.find(v => {
      const vClean = v.name.replace(/^Desa\s+/i, '').trim().toLowerCase();
      return vClean === clean || vClean.includes(clean) || clean.includes(vClean);
    });
    return found ? found.center : null;
  }, [villages, selectedVillageName]);

  return (
    <div className="leaflet-map-wrapper" style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', zIndex: 1, marginTop: '0px' }}>
      <style>{`
        .leaflet-tooltip.bg-transparent {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-tooltip.bg-transparent::before {
          display: none !important;
        }
        .leaflet-control-attribution {
          font-size: 10px !important;
          background: rgba(255, 255, 255, 0.85) !important;
          padding: 2px 8px !important;
          border-top-left-radius: 6px !important;
          backdrop-filter: blur(2px) !important;
        }
        @keyframes mapPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Quick action button: Recenter Baureno */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
        <button
          type="button"
          onClick={() => setRecenterTrigger(prev => prev + 1)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#1e3a8a',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.15s ease'
          }}
          title="Pusatkan kembali peta ke seluruh wilayah Kecamatan Baureno"
        >
          <span>🎯</span> Tampilkan Seluruh Baureno
        </button>
      </div>

      <MapContainer 
        center={baurenoCenter} 
        zoom={12} 
        bounds={baurenoBounds}
        boundsOptions={{ padding: [15, 15] }}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController bounds={mapBounds} recenterTrigger={recenterTrigger} targetCenter={targetVillageCenter} />

        {/* 1. Village Risk Polygons */}
        {villages.map(v => {
          const isSelected = selectedVillageName && v.name.toLowerCase().includes(selectedVillageName.toLowerCase());
          return (
            <Polygon 
              key={v.id} 
              positions={v.coords}
              eventHandlers={{
                click: () => onSelectVillage && onSelectVillage(v)
              }}
              pathOptions={{ 
                color: isSelected ? '#1e40af' : '#ffffff',
                weight: isSelected ? 3.5 : 1.5, 
                fillColor: colorMap[v.status] || '#10b981', 
                fillOpacity: isSelected ? 0.85 : 0.65 
              }}
            >
              <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none text-center">
                <div style={{ color: '#fff', textShadow: '0px 1px 3px rgba(0,0,0,0.8)', fontWeight: 800, fontSize: '10px', textAlign: 'center', lineHeight: '1.2' }}>
                  {v.name.toUpperCase()}<br/>
                  <span style={{ 
                    display: 'inline-block', 
                    backgroundColor: v.status === 'awas' ? '#dc2626' : (v.status === 'tinggi' || v.status === 'siaga' ? '#ea580c' : (v.status === 'sedang' || v.status === 'waspada' ? '#ca8a04' : '#059669')), 
                    color: 'white', 
                    borderRadius: '10px', 
                    padding: '1px 6px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    marginTop: '3px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    letterSpacing: '0.02em'
                  }}>
                    {Math.round(v.prob)}%
                  </span>
                </div>
              </Tooltip>
            </Polygon>
          )
        })}

        {/* 2. Route Polyline (Evacuation Path) */}
        {routeCoordinates && routeCoordinates.length > 1 && (
          <>
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#1e3a8a',
                weight: 7,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#38bdf8',
                weight: 4,
                dashArray: '8, 8',
                opacity: 1,
              }}
            />
          </>
        )}

        {/* 3. User GPS Marker */}
        {userLocation && userLocation[0] && userLocation[1] && (
          <Marker 
            position={[userLocation[0], userLocation[1]]} 
            icon={userLocationIcon}
          >
            <Popup>
              <div style={{ fontSize: '12px', textAlign: 'center' }}>
                <strong style={{ color: '#2563eb' }}>📍 Lokasi Anda Saat Ini</strong>
                <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>
                  {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 4. Shelter Markers */}
        {shelters.map(s => {
          if (!s.latitude || !s.longitude) return null;
          const isSelected = selectedShelterId === s.id;
          const isFull = s.capacity_total > 0 && s.capacity_occupied >= s.capacity_total;

          return (
            <Marker
              key={s.id}
              position={[parseFloat(s.latitude), parseFloat(s.longitude)]}
              icon={createShelterIcon(isSelected, isFull)}
              eventHandlers={{
                click: () => onSelectShelter && onSelectShelter(s)
              }}
            >
              <Popup>
                <div style={{ fontSize: '12px', minWidth: '160px' }}>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px', color: '#0f172a' }}>
                    🏠 {s.name}
                  </strong>
                  <div style={{ color: '#64748b', marginBottom: '6px' }}>{s.address}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Kapasitas:</span>
                    <strong style={{ color: isFull ? '#ef4444' : '#059669' }}>
                      {s.capacity_occupied || 0} / {s.capacity_total} ({isFull ? 'Penuh' : 'Tersedia'})
                    </strong>
                  </div>
                  {s.contact_phone && (
                    <div style={{ color: '#64748b', marginBottom: '6px' }}>
                      📞 Kontak: {s.contact_phone} ({s.contact_person || 'Petugas'})
                    </div>
                  )}
                  {onSelectShelter && (
                    <button 
                      onClick={() => onSelectShelter(s)}
                      style={{
                        width: '100%',
                        marginTop: '6px',
                        padding: '6px 10px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: '600',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      🗺️ Hitung Rute Evakuasi
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  )
}

