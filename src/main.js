import * as maplibreModule from './maplibre/map.js';
import * as openlayersModule from './openlayers/map.js';
import * as leafletModule from './leaflet/map.js';
import { getPoints, getCenter } from './data/fake-data.js';

// Current active library
let activeLib = 'maplibre';
let maplibreMap = null;
let openlayersMap = null;
let leafletMap = null;

// Layer state
const layerState = {
  points: true,
  polygons: true,
  lines: true,
  heatmap: false,
  cluster: false
};

// Animation state
let isAnimating = false;
let animationId = null;
let basePoints = null; // Store original point positions
const NYC_CENTER = getCenter();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMaps();
  setupTabs();
  setupLayerControls();
  setupAnimationButton();
  setupPerformanceMonitor();
  updateCodeSnippet('points');
});

function initMaps() {
  // Initialize all three maps
  maplibreMap = maplibreModule.initMap();
  openlayersMap = openlayersModule.initMap();
  leafletMap = leafletModule.initMap();

  // Store base points for animation
  basePoints = getPoints(1000);

  // Update feature count
  const count = maplibreModule.getFeatureCount();
  document.getElementById('feature-count').textContent = count.toLocaleString();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const maplibreContainer = document.getElementById('map-maplibre');
  const openlayersContainer = document.getElementById('map-openlayers');
  const leafletContainer = document.getElementById('map-leaflet');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Switch map visibility
      maplibreContainer.classList.remove('active');
      openlayersContainer.classList.remove('active');
      leafletContainer.classList.remove('active');

      if (tabName === 'maplibre') {
        maplibreContainer.classList.add('active');
        activeLib = 'maplibre';
      } else if (tabName === 'openlayers') {
        openlayersContainer.classList.add('active');
        activeLib = 'openlayers';
      } else if (tabName === 'leaflet') {
        leafletContainer.classList.add('active');
        activeLib = 'leaflet';
      }

      // Update code snippet for current layer selection
      updateCodeSnippetForActiveLayer();
    });
  });
}

function setupLayerControls() {
  const controls = {
    'layer-points': 'points',
    'layer-polygons': 'polygons',
    'layer-lines': 'lines',
    'layer-heatmap': 'heatmap',
    'layer-cluster': 'cluster'
  };

  Object.entries(controls).forEach(([elementId, layerId]) => {
    const checkbox = document.getElementById(elementId);
    if (!checkbox) return;

    checkbox.addEventListener('change', (e) => {
      const visible = e.target.checked;
      layerState[layerId] = visible;

      // Update all three maps
      maplibreModule.setLayerVisibility(layerId, visible);
      openlayersModule.setLayerVisibility(layerId, visible);
      leafletModule.setLayerVisibility(layerId, visible);

      // Special handling: clustering replaces regular points
      if (layerId === 'cluster') {
        const pointsCheckbox = document.getElementById('layer-points');
        if (visible) {
          pointsCheckbox.checked = false;
          layerState.points = false;
        }
      }

      if (layerId === 'points' && visible) {
        const clusterCheckbox = document.getElementById('layer-cluster');
        clusterCheckbox.checked = false;
        layerState.cluster = false;
        maplibreModule.setLayerVisibility('cluster', false);
        openlayersModule.setLayerVisibility('cluster', false);
        leafletModule.setLayerVisibility('cluster', false);
      }

      // Update code snippet
      updateCodeSnippet(layerId);
    });
  });
}

function setupAnimationButton() {
  const btn = document.getElementById('animate-btn');

  btn.addEventListener('click', () => {
    if (isAnimating) {
      stopAnimation();
      btn.textContent = 'Start Animation';
      btn.classList.remove('active');
    } else {
      startAnimation();
      btn.textContent = 'Stop Animation';
      btn.classList.add('active');
    }
  });
}

function startAnimation() {
  isAnimating = true;
  const startTime = performance.now();

  function animate() {
    if (!isAnimating) return;

    const elapsed = (performance.now() - startTime) / 1000; // seconds

    // Create animated points by moving them in circular patterns
    const animatedPoints = {
      type: 'FeatureCollection',
      features: basePoints.features.map((feature, i) => {
        const [baseLng, baseLat] = feature.geometry.coordinates;

        // Each point moves in a small circle with different phase
        const phase = i * 0.1;
        const speed = 0.5 + (i % 5) * 0.2; // Vary speed
        const radius = 0.002 + (i % 10) * 0.0005; // Vary radius

        const newLng = baseLng + Math.cos(elapsed * speed + phase) * radius;
        const newLat = baseLat + Math.sin(elapsed * speed + phase) * radius;

        return {
          ...feature,
          geometry: {
            type: 'Point',
            coordinates: [newLng, newLat]
          }
        };
      })
    };

    // Update all three maps
    maplibreModule.updatePointPositions(animatedPoints);
    openlayersModule.updatePointPositions(animatedPoints);
    leafletModule.updatePointPositions(animatedPoints);

    animationId = requestAnimationFrame(animate);
  }

  animate();
}

function stopAnimation() {
  isAnimating = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Reset to original positions
  maplibreModule.updatePointPositions(basePoints);
  openlayersModule.updatePointPositions(basePoints);
  leafletModule.updatePointPositions(basePoints);
}

function updateCodeSnippetForActiveLayer() {
  // Find first enabled layer to show code for
  const enabledLayers = Object.entries(layerState)
    .filter(([_, enabled]) => enabled)
    .map(([layer]) => layer);

  if (enabledLayers.length > 0) {
    updateCodeSnippet(enabledLayers[0]);
  }
}

function updateCodeSnippet(layerId) {
  const codeElement = document.getElementById('code-snippet');
  let module;

  if (activeLib === 'maplibre') {
    module = maplibreModule;
  } else if (activeLib === 'openlayers') {
    module = openlayersModule;
  } else if (activeLib === 'leaflet') {
    module = leafletModule;
  }

  if (module && module.codeSnippets[layerId]) {
    codeElement.textContent = module.codeSnippets[layerId];
  }
}

function setupPerformanceMonitor() {
  let frameCount = 0;
  let lastTime = performance.now();
  const fpsElement = document.getElementById('fps');

  function updateFPS() {
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fps = Math.round((frameCount * 1000) / delta);
      fpsElement.textContent = fps;

      // Color code FPS
      if (fps >= 55) {
        fpsElement.style.color = '#2ecc71'; // Green
      } else if (fps >= 30) {
        fpsElement.style.color = '#f1c40f'; // Yellow
      } else {
        fpsElement.style.color = '#e74c3c'; // Red
      }

      frameCount = 0;
      lastTime = now;
    }

    requestAnimationFrame(updateFPS);
  }

  requestAnimationFrame(updateFPS);
}
