const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const fs = require('fs');

async function run() {
  // Try fetching Kecamatan Baureno boundary using bbox around known center
  // Baureno, Bojonegoro center is approximately -7.128, 112.104
  // Try to find admin boundaries in that area
  
  const query = `[out:json][timeout:60];
(
  relation["boundary"="administrative"]["admin_level"~"6|7"]["name"~"Baureno"](around:20000,-7.128,112.104);
);
out body;
>;
out skel qt;`;

  console.log('Fetching admin boundaries near Baureno, Bojonegoro...');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  
  const text = await res.text();
  console.log('Response length:', text.length);
  
  if (text.startsWith('<?xml') || text.startsWith('<html')) {
    console.log('Server returned error/HTML. Trying alternative...');
    console.log(text.substring(0, 500));
    return;
  }
  
  const osmData = JSON.parse(text);
  console.log('Elements count:', osmData.elements?.length);
  
  const geojson = osmtogeojson(osmData);
  console.log('Features:', geojson.features.length);
  
  for (const f of geojson.features) {
    console.log(`  - ${f.properties.name} | admin_level: ${f.properties.admin_level} | type: ${f.geometry.type}`);
  }
  
  // Find the Baureno boundary specifically in Bojonegoro
  const baureno = geojson.features.find(f => 
    f.properties.name === 'Baureno' && 
    (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );
  
  if (baureno) {
    const result = { type: "FeatureCollection", features: [baureno] };
    fs.writeFileSync('src/data/baureno.json', JSON.stringify(result));
    console.log('Saved Baureno boundary!');
  } else {
    console.log('Baureno polygon not found in results');
  }
}

run().catch(console.error);
