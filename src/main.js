import * as maplibreModule from './maplibre/map.js';
import * as openlayersModule from './openlayers/map.js';
import * as leafletModule from './leaflet/map.js';
import * as deckglModule from './deckgl/map.js';
import { getPoints, getAllData } from './data/fake-data.js';

// Current active library
let activeLib = 'leaflet';
let maplibreMap = null;
let openlayersMap = null;
let leafletMap = null;
let deckglMap = null;

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

// Feature data for counts
const featureData = getAllData();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMaps();
  setupTabs();
  setupLayerControls();
  setupAnimationButton();
  setupPerformanceMonitor();
  setupMobileControls();
  setupCodeModal();
  setupResizeHandler();
  updateCodeSnippet('points');
});

function initMaps() {
  // Initialize all four maps
  maplibreMap = maplibreModule.initMap();
  openlayersMap = openlayersModule.initMap();
  leafletMap = leafletModule.initMap();
  deckglMap = deckglModule.initMap();

  // Store base points for animation (must match getAllData count)
  basePoints = featureData.points;

  // Update feature count
  updateFeatureCount();
}

// Update displayed feature count based on visible layers
function updateFeatureCount() {
  let count = 0;
  if (layerState.points || layerState.cluster) {
    count += featureData.points.features.length;
  }
  if (layerState.polygons) {
    count += featureData.polygons.features.length;
  }
  if (layerState.lines) {
    count += featureData.lines.features.length;
  }
  if (layerState.heatmap) {
    // Heatmap uses points data, don't double count if points already counted
    if (!layerState.points && !layerState.cluster) {
      count += featureData.points.features.length;
    }
  }
  document.getElementById('feature-count').textContent = count.toLocaleString();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const maplibreContainer = document.getElementById('map-maplibre');
  const openlayersContainer = document.getElementById('map-openlayers');
  const leafletContainer = document.getElementById('map-leaflet');
  const deckglContainer = document.getElementById('map-deckgl');

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
      deckglContainer.classList.remove('active');

      if (tabName === 'maplibre') {
        maplibreContainer.classList.add('active');
        activeLib = 'maplibre';
        // Trigger resize to recalculate viewport after becoming visible
        setTimeout(() => maplibreMap.resize(), 0);
      } else if (tabName === 'openlayers') {
        openlayersContainer.classList.add('active');
        activeLib = 'openlayers';
        // Trigger resize to recalculate viewport after becoming visible
        setTimeout(() => openlayersMap.updateSize(), 0);
      } else if (tabName === 'leaflet') {
        leafletContainer.classList.add('active');
        activeLib = 'leaflet';
        // Trigger resize to recalculate viewport after becoming visible
        setTimeout(() => leafletMap.invalidateSize(), 0);
      } else if (tabName === 'deckgl') {
        deckglContainer.classList.add('active');
        activeLib = 'deckgl';
        // Deck.gl handles resize automatically via ResizeObserver
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

      // Update all four maps
      maplibreModule.setLayerVisibility(layerId, visible);
      openlayersModule.setLayerVisibility(layerId, visible);
      leafletModule.setLayerVisibility(layerId, visible);
      deckglModule.setLayerVisibility(layerId, visible);

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
        deckglModule.setLayerVisibility('cluster', false);
      }

      // Update code snippet
      updateCodeSnippet(layerId);

      // Update feature count
      updateFeatureCount();
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

    // Update all four maps
    maplibreModule.updatePointPositions(animatedPoints);
    openlayersModule.updatePointPositions(animatedPoints);
    leafletModule.updatePointPositions(animatedPoints);
    deckglModule.updatePointPositions(animatedPoints);

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
  deckglModule.updatePointPositions(basePoints);
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
  } else if (activeLib === 'deckgl') {
    module = deckglModule;
  }

  if (module && module.codeSnippets[layerId]) {
    codeElement.textContent = module.codeSnippets[layerId];
  }
}

function setupPerformanceMonitor() {
  let frameCount = 0;
  let lastTime = performance.now();
  const fpsElement = document.getElementById('fps');
  const fpsMobile = document.getElementById('fps-mobile');

  function updateFPS() {
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fps = Math.round((frameCount * 1000) / delta);

      // Update both desktop and mobile FPS displays
      fpsElement.textContent = fps;
      if (fpsMobile) fpsMobile.textContent = fps;

      // Color code FPS (apply to both)
      const color = fps >= 55 ? '#2ecc71' : fps >= 30 ? '#f1c40f' : '#e74c3c';
      fpsElement.style.color = color;
      if (fpsMobile) fpsMobile.style.color = color;

      frameCount = 0;
      lastTime = now;
    }

    requestAnimationFrame(updateFPS);
  }

  requestAnimationFrame(updateFPS);
}

function setupMobileControls() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (!isMobile) return;

  const controls = document.querySelector('.controls');
  const drawerToggle = document.getElementById('drawer-toggle');

  if (!drawerToggle) return;

  // Start collapsed on mobile
  controls.classList.add('collapsed');
  drawerToggle.setAttribute('aria-expanded', 'false');

  drawerToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = controls.classList.toggle('collapsed');
    drawerToggle.setAttribute('aria-expanded', !isCollapsed);
  });
}

function setupCodeModal() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;

  const codeSection = document.querySelector('.code-section');
  const codeModal = document.getElementById('code-modal');
  const modalBackdrop = codeModal?.querySelector('.modal-backdrop');
  const modalClose = codeModal?.querySelector('.modal-close');
  const codeSnippetMain = document.getElementById('code-snippet');
  const codeSnippetModal = document.getElementById('code-snippet-modal');

  if (!codeSection || !codeModal) return;

  // Open modal when code section tapped
  codeSection.addEventListener('click', () => {
    // Sync code content to modal
    if (codeSnippetModal && codeSnippetMain) {
      codeSnippetModal.textContent = codeSnippetMain.textContent;
    }
    codeModal.classList.add('active');
  });

  // Close on backdrop tap
  modalBackdrop?.addEventListener('click', () => {
    codeModal.classList.remove('active');
  });

  // Close on X button
  modalClose?.addEventListener('click', () => {
    codeModal.classList.remove('active');
  });
}

function setupResizeHandler() {
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Re-trigger map resize for active library
      if (activeLib === 'maplibre' && maplibreMap) {
        maplibreMap.resize();
      } else if (activeLib === 'openlayers' && openlayersMap) {
        openlayersMap.updateSize();
      } else if (activeLib === 'leaflet' && leafletMap) {
        leafletMap.invalidateSize();
      }
    }, 200);
  });
}
