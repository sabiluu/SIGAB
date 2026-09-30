const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const fs = require('fs');

async function run() {
  const query = `[out:json];
area["name"="Bojonegoro"]->.searchArea;
(
  relation["admin_level"="8"](area.searchArea);
);
out body;
>;
out skel qt;`;
  
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  const text = await res.text();
  if (text.startsWith('<?xml')) {
    console.log(text);
  } else {
    const geojson = osmtogeojson(JSON.parse(text));
    fs.writeFileSync('src/data/bojonegoro_villages.geojson', JSON.stringify(geojson));
    console.log('Saved. Features:', geojson.features.length);
  }
}
run();
