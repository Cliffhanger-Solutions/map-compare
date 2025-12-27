// Fake data generator for map comparison
// Centered around NYC area: lat ~40.7, lng ~-74.0

const NYC_CENTER = { lat: 40.7128, lng: -74.0060 };
const SPREAD = 0.12; // ~12km spread - tighter to fit viewport better

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate random points (for clustering and heatmap)
export function getPoints(count = 1000) {
  const features = [];
  for (let i = 0; i < count; i++) {
    const lng = NYC_CENTER.lng + randomInRange(-SPREAD, SPREAD);
    const lat = NYC_CENTER.lat + randomInRange(-SPREAD, SPREAD);
    const magnitude = randomInRange(1, 10); // For heatmap weight

    features.push({
      type: 'Feature',
      properties: {
        id: i,
        name: `Point ${i}`,
        magnitude,
        category: ['restaurant', 'shop', 'park', 'office'][Math.floor(Math.random() * 4)]
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// Generate random polygons (areas/zones)
export function getPolygons(count = 20) {
  const features = [];

  for (let i = 0; i < count; i++) {
    const centerLng = NYC_CENTER.lng + randomInRange(-SPREAD * 0.8, SPREAD * 0.8);
    const centerLat = NYC_CENTER.lat + randomInRange(-SPREAD * 0.8, SPREAD * 0.8);
    const size = randomInRange(0.005, 0.02);

    // Create a random polygon (4-6 sided)
    const sides = Math.floor(randomInRange(4, 7));
    const coordinates = [];

    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const jitter = randomInRange(0.7, 1.3);
      coordinates.push([
        centerLng + Math.cos(angle) * size * jitter,
        centerLat + Math.sin(angle) * size * jitter * 0.7 // Account for lat/lng ratio
      ]);
    }
    // Close the polygon
    coordinates.push(coordinates[0]);

    features.push({
      type: 'Feature',
      properties: {
        id: i,
        name: `Zone ${i}`,
        color: randomColor(),
        population: Math.floor(randomInRange(1000, 50000)),
        type: ['residential', 'commercial', 'industrial', 'park'][Math.floor(Math.random() * 4)]
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// Generate random polylines (routes/paths)
export function getLines(count = 10) {
  const features = [];

  for (let i = 0; i < count; i++) {
    const startLng = NYC_CENTER.lng + randomInRange(-SPREAD, SPREAD);
    const startLat = NYC_CENTER.lat + randomInRange(-SPREAD, SPREAD);

    // Create a path with 5-15 points
    const pointCount = Math.floor(randomInRange(5, 15));
    const coordinates = [[startLng, startLat]];

    let currentLng = startLng;
    let currentLat = startLat;

    for (let j = 1; j < pointCount; j++) {
      // Move in a somewhat consistent direction with some randomness
      currentLng += randomInRange(-0.02, 0.02);
      currentLat += randomInRange(-0.015, 0.015);
      coordinates.push([currentLng, currentLat]);
    }

    features.push({
      type: 'Feature',
      properties: {
        id: i,
        name: `Route ${i}`,
        color: randomColor(),
        distance: Math.floor(randomInRange(1, 20)), // km
        type: ['highway', 'street', 'bike_path', 'walking'][Math.floor(Math.random() * 4)]
      },
      geometry: {
        type: 'LineString',
        coordinates
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// Get all data at once
export function getAllData() {
  return {
    points: getPoints(1000),
    polygons: getPolygons(50),
    lines: getLines(30)
  };
}

// Get map center
export function getCenter() {
  return [NYC_CENTER.lng, NYC_CENTER.lat];
}

// Get bounding box [minLng, minLat, maxLng, maxLat]
export function getBounds() {
  return [
    NYC_CENTER.lng - SPREAD,  // minLng (west)
    NYC_CENTER.lat - SPREAD,  // minLat (south)
    NYC_CENTER.lng + SPREAD,  // maxLng (east)
    NYC_CENTER.lat + SPREAD   // maxLat (north)
  ];
}
