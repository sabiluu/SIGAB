import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
import * as turf from '@turf/turf'
import baurenoData from '../data/baureno.json'

// Center coordinate for map view
const baurenoCenter = [-7.1423, 112.0838]

const villageNames = [
  "Kalicari", "Baureno", "Trojalu", "Gajah", "Sraturejo", 
  "Tanggungan", "Sumuragung", "Banjaranyar", "Bumiayu", 
  "Blongsong", "Drajat", "Gunungsari", "Kauman", "Leran", "Poman",
  "Ngraho", "Selorejo", "Tulungagung", "Banjaran", "Karangdayu",
  "Pasaran", "Sroyo", "Pucangarum", "Kadungrejo", "Lebaksari"
];

const colorMap = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#10b981'
}

export default function RiskMap() {
  const villages = useMemo(() => {
    // 1. Extract the actual Baureno district polygon from GeoJSON
    const districtFeature = baurenoData.features[0];
    
    // Calculate bounding box of the district
    const bbox = turf.bbox(districtFeature);
    
    // 2. Generate village center points spread within the bounding box
    const xRange = bbox[2] - bbox[0];
    const yRange = bbox[3] - bbox[1];
    const pointsArray = [];
    
    for (let i = 0; i < villageNames.length; i++) {
      const r = Math.floor(i / 5);
      const c = i % 5;
      
      const lng = bbox[0] + (c + 0.5) * (xRange / 5) + (Math.random() - 0.5) * (xRange / 6);
      const lat = bbox[1] + (r + 0.5) * (yRange / 5) + (Math.random() - 0.5) * (yRange / 6);
      
      const pt = turf.point([lng, lat]);
      if (turf.booleanPointInPolygon(pt, districtFeature)) {
        pointsArray.push(pt);
      } else {
        pointsArray.push(turf.point([bbox[0] + xRange/2, bbox[1] + yRange/2]));
      }
    }
    
    const points = turf.featureCollection(pointsArray);

    // 3. Compute Voronoi polygons bounded by the district bbox
    const voronoiPolygons = turf.voronoi(points, { bbox });

    // 4. Intersect each Voronoi polygon with the real district polygon!
    const finalVillages = [];
    
    for (let i = 0; i < villageNames.length; i++) {
      const name = villageNames[i];
      let status = 'green';
      let prob = Math.floor(Math.random() * 20);
      
      if (["Kalicari", "Baureno", "Trojalu", "Gajah", "Sraturejo"].includes(name)) {
        status = 'red';
        prob = 80 + Math.floor(Math.random() * 15);
      } else if (["Tanggungan", "Sumuragung", "Banjaranyar", "Bumiayu", "Drajat"].includes(name)) {
        status = 'orange';
        prob = 40 + Math.floor(Math.random() * 30);
      }
      
      let polygonCoords = [];
      let centerLat = baurenoCenter[0];
      let centerLng = baurenoCenter[1];

      try {
        const voronoiCell = voronoiPolygons.features[i];
        if (voronoiCell) {
          const intersection = turf.intersect(turf.featureCollection([voronoiCell, districtFeature]));
          if (intersection) {
            const geom = intersection.geometry;
            if (geom.type === 'Polygon') {
              polygonCoords = geom.coordinates[0].map(coord => [coord[1], coord[0]]);
            } else if (geom.type === 'MultiPolygon') {
              polygonCoords = geom.coordinates[0][0].map(coord => [coord[1], coord[0]]);
            }
            
            const centroid = turf.centroid(intersection);
            centerLat = centroid.geometry.coordinates[1];
            centerLng = centroid.geometry.coordinates[0];
          }
        }
      } catch (e) {
        console.error("Intersection failed for", name, e);
      }
      
      if (polygonCoords.length > 0) {
        finalVillages.push({ 
          id: i, 
          name, 
          coords: polygonCoords, 
          center: [centerLat, centerLng], 
          status, 
          prob 
        });
      }
    }
    
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
              weight: 2, 
              fillColor: colorMap[v.status], 
              fillOpacity: 0.7 
            }}
          >
            <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none text-center">
              <div style={{ color: '#fff', textShadow: '0px 1px 3px rgba(0,0,0,0.8)', fontWeight: 800, fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>
                {v.name.toUpperCase()}<br/>
                <span style={{ 
                  display: 'inline-block', 
                  backgroundColor: '#0284c7', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '20px', 
                  height: '20px', 
                  lineHeight: '20px', 
                  marginTop: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                }}>
                  {Math.floor(v.prob / 10)}
                </span>
              </div>
            </Tooltip>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  )
}
