const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const fs = require('fs');

async function run() {
  // Use the Russian Overpass mirror which tends to be more available
  const query = `[out:json][timeout:180];
// Bojonegoro relation ID is 9676650
// Find all admin_level 7 (kecamatan) within Bojonegoro that match Baureno
rel(9676650);
map_to_area->.bojonegoro;
(
  relation["admin_level"="7"]["name"="Baureno"](area.bojonegoro);
);
out body;
>;
out skel qt;`;

  const mirrors = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const mirror of mirrors) {
    console.log(`Trying ${mirror}...`);
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
      });
      const text = await res.text();
      
      if (text.startsWith('<?xml') || text.startsWith('<html') || text.startsWith('<!')) {
        console.log('  Got HTML/error, trying next...');
        continue;
      }
      
      const osmData = JSON.parse(text);
      console.log('  Elements:', osmData.elements?.length);
      
      if (!osmData.elements || osmData.elements.length === 0) {
        console.log('  No elements, trying next...');
        continue;
      }
      
      const geojson = osmtogeojson(osmData);
      console.log('  Features:', geojson.features.length);
      
      const polygons = geojson.features.filter(f => 
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
      
      if (polygons.length > 0) {
        for (const p of polygons) {
          console.log(`  Found: ${p.properties.name} (${p.geometry.type})`);
          const bbox = getBbox(p);
          console.log(`  Bbox: ${bbox}`);
        }
        
        const result = { type: "FeatureCollection", features: polygons };
        fs.writeFileSync('src/data/baureno.json', JSON.stringify(result));
        console.log('Saved kecamatan boundary!');
        return true;
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
  return false;
}

function getBbox(feature) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const coords = feature.geometry.type === 'Polygon' 
    ? feature.geometry.coordinates[0] 
    : feature.geometry.coordinates[0][0];
  for (const [lng, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return `lat: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)}, lng: ${minLng.toFixed(4)} to ${maxLng.toFixed(4)}`;
}

run().then(success => {
  if (!success) {
    console.log('\nAll Overpass mirrors failed. Will try Nominatim reverse lookup...');
    // Try individual village lookups via Nominatim
  }
}).catch(console.error);
