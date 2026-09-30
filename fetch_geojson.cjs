const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const fs = require('fs');

async function run() {
  const query = `[out:json];
relation["name"="Baureno"]["admin_level"="6"];
out body;
>;
out skel qt;`;
  
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  const text = await res.text();
  const geojson = osmtogeojson(JSON.parse(text));
  fs.writeFileSync('src/data/baureno.json', JSON.stringify(geojson));
  console.log('Saved. Features:', geojson.features.length);
  console.log(geojson.features.map(f => f.properties));
}
run();
