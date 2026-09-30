const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const fs = require('fs');

async function run() {
  const query = `[out:json];
area["name"="Baureno"]->.searchArea;
(
  relation["admin_level"="7"](area.searchArea);
  relation["admin_level"="8"](area.searchArea);
  way["admin_level"="7"](area.searchArea);
  way["admin_level"="8"](area.searchArea);
);
out body;
>;
out skel qt;`;
  
  console.log('Fetching villages...');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  const osmData = await res.json();
  const geojson = osmtogeojson(osmData);
  fs.writeFileSync('src/data/baureno_villages.geojson', JSON.stringify(geojson));
  console.log('Saved. Features:', geojson.features.length);
}
run().catch(console.error);
