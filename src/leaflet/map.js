import { Map, TileLayer, CircleMarker, Polygon, Polyline, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllData, getCenter } from '../data/fake-data.js';

// State
let map = null;
const data = getAllData();
const layers = {
  points: null,
  polygons: null,
  lines: null,
  heatmap: null,
  cluster: null
};
let pointMarkers = [];

// Code snippets for each layer type
export const codeSnippets = {
  points: `// Leaflet 2.0 - Points Layer
import L from 'leaflet';

const pointsLayer = L.layerGroup();

pointsGeoJSON.features.forEach(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  const marker = L.circleMarker([lat, lng], {
    radius: 6,
    fillColor: '#e94560',
    fillOpacity: 1,
    color: '#fff',
    weight: 2
  });

  marker.bindPopup(\`
    <strong>\${feature.properties.name}</strong><br>
    Category: \${feature.properties.category}
  \`);

  marker.addTo(pointsLayer);
});

pointsLayer.addTo(map);`,

  polygons: `// Leaflet 2.0 - Polygons Layer
import L from 'leaflet';

const polygonsLayer = L.layerGroup();

polygonsGeoJSON.features.forEach(feature => {
  // Convert [lng, lat] to [lat, lng] for Leaflet
  const coords = feature.geometry.coordinates[0]
    .map(([lng, lat]) => [lat, lng]);

  const polygon = L.polygon(coords, {
    fillColor: feature.properties.color,
    fillOpacity: 0.5,
    color: '#ffffff',
    weight: 2
  });

  polygon.bindPopup(\`
    <strong>\${feature.properties.name}</strong><br>
    Type: \${feature.properties.type}
  \`);

  // Hover effects
  polygon.on('mouseover', function() {
    this.setStyle({ fillOpacity: 0.8, weight: 3 });
  });

  polygon.on('mouseout', function() {
    this.setStyle({ fillOpacity: 0.5, weight: 2 });
  });

  polygon.addTo(polygonsLayer);
});

polygonsLayer.addTo(map);`,

  lines: `// Leaflet 2.0 - Lines Layer
import L from 'leaflet';

const linesLayer = L.layerGroup();

linesGeoJSON.features.forEach(feature => {
  // Convert [lng, lat] to [lat, lng] for Leaflet
  const coords = feature.geometry.coordinates
    .map(([lng, lat]) => [lat, lng]);

  const line = L.polyline(coords, {
    color: feature.properties.color,
    weight: 4,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round'
  });

  line.bindPopup(\`
    <strong>\${feature.properties.name}</strong><br>
    Type: \${feature.properties.type}
  \`);

  line.addTo(linesLayer);
});

linesLayer.addTo(map);`,

  heatmap: `// Leaflet 2.0 - Heatmap Layer
// Note: Not yet implemented for Leaflet 2.0 Alpha
// Requires leaflet.heat plugin compatibility verification

import L from 'leaflet';
import 'leaflet.heat';

const heatPoints = pointsGeoJSON.features.map(f => {
  const [lng, lat] = f.geometry.coordinates;
  const magnitude = f.properties.magnitude;
  return [lat, lng, magnitude];
});

const heatmapLayer = L.heatLayer(heatPoints, {
  radius: 30,
  blur: 15,
  maxZoom: 17,
  gradient: {
    0.2: '#2ecc71',
    0.4: '#f1c40f',
    0.6: '#e67e22',
    0.8: '#e74c3c',
    1.0: '#9b59b6'
  }
});

heatmapLayer.addTo(map);`,

  cluster: `// Leaflet 2.0 - Clustering
// Note: Not yet implemented for Leaflet 2.0 Alpha
// Requires leaflet.markercluster plugin compatibility verification

import L from 'leaflet';
import 'leaflet.markercluster';

const clusterLayer = L.markerClusterGroup({
  maxClusterRadius: 50,
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();
    let className = 'marker-cluster-small';

    if (count > 500) className = 'marker-cluster-large';
    else if (count > 100) className = 'marker-cluster-medium';

    return L.divIcon({
      html: '<div><span>' + count + '</span></div>',
      className: 'marker-cluster ' + className,
      iconSize: L.point(40, 40)
    });
  }
});

pointsGeoJSON.features.forEach(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  const marker = L.circleMarker([lat, lng], {
    radius: 6,
    fillColor: '#e94560',
    fillOpacity: 1,
    color: '#fff',
    weight: 2
  });
  clusterLayer.addLayer(marker);
});

map.addLayer(clusterLayer);`
};

// Create points layer
function createPointsLayer() {
  layers.points = new LayerGroup();
  pointMarkers = [];

  data.points.features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = new CircleMarker([lat, lng], {
      radius: 6,
      fillColor: '#e94560',
      fillOpacity: 1,
      color: '#fff',
      weight: 2
    });

    marker.bindPopup(`
      <strong>${feature.properties.name}</strong><br>
      Category: ${feature.properties.category}<br>
      Magnitude: ${feature.properties.magnitude.toFixed(1)}
    `);

    marker.addTo(layers.points);
    pointMarkers.push({ marker, feature });
  });
}

// Create polygons layer
function createPolygonsLayer() {
  layers.polygons = new LayerGroup();

  data.polygons.features.forEach(feature => {
    // Convert [lng, lat] to [lat, lng] for Leaflet
    const coords = feature.geometry.coordinates[0].map(
      ([lng, lat]) => [lat, lng]
    );

    const polygon = new Polygon(coords, {
      fillColor: feature.properties.color,
      fillOpacity: 0.5,
      color: '#ffffff',
      weight: 2
    });

    polygon.bindPopup(`
      <strong>${feature.properties.name}</strong><br>
      Type: ${feature.properties.type}<br>
      Population: ${feature.properties.population.toLocaleString()}
    `);

    // Hover effects
    polygon.on('mouseover', function() {
      this.setStyle({ fillOpacity: 0.8, weight: 3 });
    });

    polygon.on('mouseout', function() {
      this.setStyle({ fillOpacity: 0.5, weight: 2 });
    });

    polygon.addTo(layers.polygons);
  });
}

// Create lines layer
function createLinesLayer() {
  layers.lines = new LayerGroup();

  data.lines.features.forEach(feature => {
    // Convert [lng, lat] to [lat, lng] for Leaflet
    const coords = feature.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    const line = new Polyline(coords, {
      color: feature.properties.color,
      weight: 4,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    });

    line.bindPopup(`
      <strong>${feature.properties.name}</strong><br>
      Type: ${feature.properties.type}<br>
      Distance: ${feature.properties.distance} km
    `);

    line.addTo(layers.lines);
  });
}

// Create placeholder layers for heatmap and cluster
function createPlaceholderLayers() {
  // Create empty layer groups for heatmap and cluster
  // These will be implemented once plugins are confirmed compatible with Leaflet 2.0
  layers.heatmap = new LayerGroup();
  layers.cluster = new LayerGroup();
}

// Initialize map
export function initMap() {
  const [lng, lat] = getCenter();

  // Create map - Leaflet uses [lat, lng] order
  map = new Map('map-leaflet', {
    center: [lat, lng],
    zoom: 11
  });

  // Add base tile layer
  new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Initialize all layers
  createPointsLayer();
  createPolygonsLayer();
  createLinesLayer();
  createPlaceholderLayers();

  // Add visible layers to map (points, polygons, lines visible by default)
  layers.points.addTo(map);
  layers.polygons.addTo(map);
  layers.lines.addTo(map);

  return map;
}

// Toggle layer visibility
export function setLayerVisibility(layerId, visible) {
  const layer = layers[layerId];
  if (!layer || !map) return;

  if (visible) {
    layer.addTo(map);

    // Hide regular points when clustering is on
    if (layerId === 'cluster' && layers.points) {
      map.removeLayer(layers.points);
    }
  } else {
    map.removeLayer(layer);
  }
}

// Get map instance
export function getMap() {
  return map;
}

// Get total feature count
export function getFeatureCount() {
  return data.points.features.length +
         data.polygons.features.length +
         data.lines.features.length;
}

// Update point positions for animation
export function updatePointPositions(animatedData) {
  if (!map || !layers.points) return;

  // Update regular points
  animatedData.features.forEach((feature, index) => {
    if (pointMarkers[index]) {
      const [lng, lat] = feature.geometry.coordinates;
      pointMarkers[index].marker.setLatLng([lat, lng]);
    }
  });
}
