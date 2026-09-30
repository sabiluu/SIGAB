import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
import * as turf from '@turf/turf'
import baurenoVillagesData from '../data/baureno_villages_real.json'

// Center coordinate for map view - Kecamatan Baureno, Bojonegoro
const baurenoCenter = [-7.160, 111.830]

const colorMap = {
  awas: '#ef4444',     // Red (Bahaya/Awas)
  siaga: '#f97316',    // Orange (Siaga)
  aman: '#10b981'      // Green (Aman)
}

// Simple hash function to generate consistent pseudo-random numbers from strings
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function RiskMap() {
  const villages = useMemo(() => {
    const finalVillages = [];
    
    // Parse the real geojson data
    baurenoVillagesData.features.forEach((feature, i) => {
      const geom = feature.geometry;
      if (!geom) return;

      const name = feature.properties.adm4_name || feature.properties.name || `Desa ${i+1}`;
      
      // Generate consistent dummy data based on the village name
      const seed = hashString(name);
      
      let status = 'aman';
      let prob = 10 + (seed % 20); // 10-30% baseline
      
      // Determine fake status based on name for a realistic presentation visualization
      const nameUpper = name.toUpperCase();
      
      // Desa yang dekat Bengawan Solo atau rawan (Merah/Awas)
      if (["BAURENO", "PASINAN", "BUMIAYU", "NGEMPLAK", "SEMBUNGLOR", "TROJALU", "GAJAH", "SRATUREJO"].some(n => nameUpper.includes(n))) {
        status = 'awas';
        prob = 80 + (seed % 15); // 80-95%
      } 
      // Desa penyangga / siaga (Oranye/Siaga)
      else if (["TANGGUNGAN", "SUMURAGUNG", "BANJARANYAR", "DRAJAT", "GUNUNGSARI", "KARANGDAYU", "KADUNGREJO", "LEBAKSARI"].some(n => nameUpper.includes(n))) {
        status = 'siaga';
        prob = 40 + (seed % 30); // 40-70%
      }
      
      // GeoJSON is [lng, lat], Leaflet Polygon expects [lat, lng]
      const mapCoords = (coords) => coords.map(c => [c[1], c[0]]);
      
      let polygonCoords = [];
      if (geom.type === 'Polygon') {
        polygonCoords = geom.coordinates.map(mapCoords);
      } else if (geom.type === 'MultiPolygon') {
        polygonCoords = geom.coordinates.map(poly => poly.map(mapCoords));
      }
      
      // Calculate Centroid for the Tooltip
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
        prob 
      });
    });
    
    return finalVillages;
  }, []);

  return (
    <div className="leaflet-map-wrapper" style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', zIndex: 1, marginTop: '16px' }}>
      <style>{`
        .leaflet-tooltip.bg-transparent {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-tooltip.bg-transparent::before {
          display: none !important;
        }
      `}</style>
      <MapContainer center={baurenoCenter} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {villages.map(v => (
          <Polygon 
            key={v.id} 
            positions={v.coords}
            pathOptions={{ 
              color: '#ffffff',
              weight: 1.5, 
              fillColor: colorMap[v.status] || '#10b981', 
              fillOpacity: 0.65 
            }}
          >
            <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none text-center">
              <div style={{ color: '#fff', textShadow: '0px 1px 3px rgba(0,0,0,0.8)', fontWeight: 800, fontSize: '10px', textAlign: 'center', lineHeight: '1.2' }}>
                {v.name.toUpperCase()}<br/>
                <span style={{ 
                  display: 'inline-block', 
                  backgroundColor: v.status === 'awas' ? '#991b1b' : (v.status === 'siaga' ? '#9a3412' : '#065f46'), 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '18px', 
                  height: '18px', 
                  lineHeight: '18px', 
                  marginTop: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                }}>
                  {Math.floor(v.prob)}
                </span>
              </div>
            </Tooltip>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  )
}
