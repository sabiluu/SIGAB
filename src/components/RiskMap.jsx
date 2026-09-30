import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'

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
  // Generate contiguous polygons that look like administrative boundaries
  const villages = useMemo(() => {
    const gridRows = 5;
    const gridCols = 5;
    const gridSize = 0.015;
    
    // Generate jittered vertices
    const vertices = [];
    // Use seeded-like random for consistent shapes on re-renders, or just let it randomize once via useMemo
    for (let r = 0; r <= gridRows; r++) {
      const rowVertices = [];
      for (let c = 0; c <= gridCols; c++) {
        let lat = baurenoCenter[0] + (r - 2.5) * gridSize;
        let lng = baurenoCenter[1] + (c - 2.5) * gridSize;
        
        // Jitter inner vertices to make them look like natural borders
        if (r > 0 && r < gridRows && c > 0 && c < gridCols) {
          lat += (Math.random() - 0.5) * gridSize * 0.7;
          lng += (Math.random() - 0.5) * gridSize * 0.7;
        }
        rowVertices.push([lat, lng]);
      }
      vertices.push(rowVertices);
    }

    return villageNames.map((name, index) => {
      const r = Math.floor(index / gridCols);
      const c = index % gridCols;
      
      const polygonCoords = [
        vertices[r][c],
        vertices[r][c+1],
        vertices[r+1][c+1],
        vertices[r+1][c]
      ];

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
      
      // Calculate center for text label
      const centerLat = (polygonCoords[0][0] + polygonCoords[1][0] + polygonCoords[2][0] + polygonCoords[3][0]) / 4;
      const centerLng = (polygonCoords[0][1] + polygonCoords[1][1] + polygonCoords[2][1] + polygonCoords[3][1]) / 4;

      return { id: index, name, coords: polygonCoords, center: [centerLat, centerLng], status, prob };
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
