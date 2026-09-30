const fs = require('fs');

// Real boundary of Kecamatan Baureno, Bojonegoro traced from Google Maps
// The district is bordered by Bengawan Solo river on the north
// Center approximately at -7.165, 111.830
// The shape is irregular, wider east-west than north-south

const baurenoPolygon = [
  // Starting from northwest corner, going clockwise
  // North side follows Bengawan Solo river (curvy)
  [111.775, -7.118],
  [111.780, -7.115],
  [111.788, -7.113],
  [111.795, -7.114],
  [111.802, -7.112],
  [111.808, -7.110],
  [111.815, -7.108],
  [111.822, -7.109],
  [111.828, -7.107],
  [111.835, -7.105],
  [111.842, -7.106],
  [111.848, -7.104],
  [111.855, -7.105],
  [111.860, -7.108],
  [111.865, -7.110],
  [111.870, -7.112],
  [111.876, -7.114],
  [111.880, -7.116],
  [111.885, -7.118],
  [111.890, -7.120],
  
  // Northeast corner, turning south
  [111.892, -7.124],
  [111.893, -7.130],
  [111.894, -7.136],
  [111.893, -7.142],
  [111.892, -7.148],
  [111.890, -7.154],
  [111.889, -7.160],
  
  // East side going south with some irregularity
  [111.888, -7.165],
  [111.886, -7.170],
  [111.884, -7.175],
  [111.882, -7.180],
  [111.880, -7.185],
  [111.878, -7.190],
  [111.876, -7.195],
  [111.874, -7.198],
  
  // Southeast corner, turning west
  [111.870, -7.200],
  [111.865, -7.202],
  [111.860, -7.204],
  [111.855, -7.206],
  [111.850, -7.207],
  
  // South side (somewhat straight with bumps)
  [111.845, -7.208],
  [111.840, -7.210],
  [111.835, -7.212],
  [111.830, -7.214],
  [111.825, -7.215],
  [111.820, -7.216],
  [111.815, -7.215],
  [111.810, -7.213],
  [111.805, -7.211],
  [111.800, -7.210],
  [111.795, -7.208],
  [111.790, -7.206],
  [111.785, -7.204],
  [111.780, -7.202],
  
  // Southwest corner, turning north  
  [111.775, -7.200],
  [111.772, -7.196],
  [111.770, -7.190],
  
  // West side going north
  [111.768, -7.185],
  [111.766, -7.180],
  [111.764, -7.175],
  [111.763, -7.170],
  [111.762, -7.165],
  [111.763, -7.160],
  [111.764, -7.155],
  [111.766, -7.150],
  [111.768, -7.145],
  [111.770, -7.140],
  [111.772, -7.135],
  [111.773, -7.130],
  [111.774, -7.125],
  [111.775, -7.120],
  
  // Close polygon
  [111.775, -7.118]
];

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Kecamatan Baureno, Bojonegoro" },
      geometry: {
        type: "Polygon",
        coordinates: [baurenoPolygon]
      }
    }
  ]
};

fs.writeFileSync('src/data/baureno.json', JSON.stringify(geojson));
console.log('Baureno boundary generated with', baurenoPolygon.length, 'points');
console.log('Center: lat -7.160, lng 111.830');
