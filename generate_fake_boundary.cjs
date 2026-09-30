const fs = require('fs');

const center = [112.0838, -7.1423]; // Lng, Lat
const numPoints = 60;
const coords = [];

// Generate a bumpy circle
for (let i = 0; i < numPoints; i++) {
  const angle = (i / numPoints) * Math.PI * 2;
  // Base radius approx 0.05 degrees (5-6 km)
  let radius = 0.06;
  
  // Add large features (simulate rivers/roads)
  radius += Math.sin(angle * 3) * 0.015;
  radius += Math.cos(angle * 5) * 0.008;
  radius += Math.sin(angle * 12) * 0.003; // jagged edges
  
  // Flatten the north side slightly to simulate a river (Bengawan Solo is north of Baureno)
  if (angle > Math.PI && angle < 2 * Math.PI) {
    radius -= 0.01;
    radius += Math.sin(angle * 15) * 0.002;
  }
  
  const lng = center[0] + Math.cos(angle) * radius;
  const lat = center[1] + Math.sin(angle) * radius;
  
  coords.push([lng, lat]);
}

// Close the polygon
coords.push(coords[0]);

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Kecamatan Baureno" },
      geometry: {
        type: "Polygon",
        coordinates: [coords]
      }
    }
  ]
};

fs.writeFileSync('src/data/baureno.json', JSON.stringify(geojson));
console.log('Fake Baureno boundary generated.');
