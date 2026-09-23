import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

// Generate 25 mock villages around Baureno
const baurenoCenter = [-7.1423, 112.0838]
const villages = [
  "Kalicari", "Baureno", "Trojalu", "Gajah", "Sraturejo", 
  "Tanggungan", "Sumuragung", "Banjaranyar", "Bumiayu", 
  "Blongsong", "Drajat", "Gunungsari", "Kauman", "Leran", "Poman",
  "Ngraho", "Selorejo", "Tulungagung", "Banjaran", "Karangdayu",
  "Pasaran", "Sroyo", "Pucangarum", "Kadungrejo", "Lebaksari"
].map((name, index) => {
  // Mock coordinate offset for visual spread
  const lat = baurenoCenter[0] + (Math.random() - 0.5) * 0.08
  const lng = baurenoCenter[1] + (Math.random() - 0.5) * 0.08
  
  // Assign status
  let status = 'green'
  let prob = Math.floor(Math.random() * 20)
  
  if (["Kalicari", "Baureno", "Trojalu", "Gajah", "Sraturejo"].includes(name)) {
    status = 'red'
    prob = 80 + Math.floor(Math.random() * 15)
  } else if (["Tanggungan", "Sumuragung", "Banjaranyar", "Bumiayu"].includes(name)) {
    status = 'orange'
    prob = 40 + Math.floor(Math.random() * 30)
  }
  
  return { id: index, name, lat, lng, status, prob }
})

const colorMap = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#10b981'
}

export default function RiskMap() {
  return (
    <div className="leaflet-map-wrapper" style={{ height: '350px', width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', zIndex: 1, marginTop: '16px' }}>
      <MapContainer center={baurenoCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {villages.map(v => (
          <CircleMarker 
            key={v.id} 
            center={[v.lat, v.lng]} 
            pathOptions={{ 
              color: 'white',
              weight: 1, 
              fillColor: colorMap[v.status], 
              fillOpacity: 0.8 
            }}
            radius={12}
          >
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <strong style={{ display: 'block', fontSize: '1.1em', marginBottom: '4px' }}>Desa {v.name}</strong>
                <span style={{ 
                  display: 'inline-block', 
                  padding: '4px 10px', 
                  borderRadius: '12px',
                  backgroundColor: colorMap[v.status],
                  color: 'white',
                  fontSize: '0.8em',
                  fontWeight: 'bold'
                }}>
                  {v.status === 'red' ? 'AWAS' : v.status === 'orange' ? 'SIAGA' : 'AMAN'} ({v.prob}%)
                </span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
