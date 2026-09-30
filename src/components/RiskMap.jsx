import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
import { Delaunay } from 'd3-delaunay'

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
  // Generate contiguous natural polygons using Voronoi diagram
  const villages = useMemo(() => {
    // 1. Generate jittered grid points as village centers
    const gridSize = 0.025;
    const points = villageNames.map((_, i) => {
      const r = Math.floor(i / 5);
      const c = i % 5;
      // Fixed pseudo-random seed based on index so it doesn't flicker on re-renders, 
      // but Math.random() in useMemo is fine as it runs once per mount.
      const lat = baurenoCenter[0] + (r - 2) * gridSize + (Math.random() - 0.5) * gridSize * 0.9;
      const lng = baurenoCenter[1] + (c - 2) * gridSize + (Math.random() - 0.5) * gridSize * 0.9;
      return [lat, lng];
    });

    // 2. Define bounding box for the region
    const bounds = [
      baurenoCenter[0] - 0.07, baurenoCenter[1] - 0.07, 
      baurenoCenter[0] + 0.07, baurenoCenter[1] + 0.07
    ];

    // 3. Compute Voronoi cells
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi(bounds);

    return villageNames.map((name, index) => {
      // Get the vertices for this cell
      const polygonCoords = voronoi.cellPolygon(index);
      
      // The last point in cellPolygon is the same as the first, Leaflet handles it fine
      
      // Assign status based on name
      let status = 'green';
      let prob = Math.floor(Math.random() * 20);
      
      if (["Kalicari", "Baureno", "Trojalu", "Gajah", "Sraturejo"].includes(name)) {
        status = 'red';
        prob = 80 + Math.floor(Math.random() * 15);
      } else if (["Tanggungan", "Sumuragung", "Banjaranyar", "Bumiayu", "Drajat"].includes(name)) {
        status = 'orange';
        prob = 40 + Math.floor(Math.random() * 30);
      }
      
      return { 
        id: index, 
        name, 
        coords: polygonCoords, 
        center: points[index], 
        status, 
        prob 
      };
    });
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
      <MapContainer center={baurenoCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {villages.map(v => (
          <Polygon 
            key={v.id} 
            positions={v.coords}
            pathOptions={{ 
              color: '#ffffff', // white border between regions
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
