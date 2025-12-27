import * as maplibreModule from './maplibre/map.js';
import * as openlayersModule from './openlayers/map.js';
import * as leafletModule from './leaflet/map.js';
import * as deckglModule from './deckgl/map.js';
import { getPoints, getAllData } from './data/fake-data.js';
import Chart from 'chart.js/auto';
import {
  runBenchmark,
  cancelBenchmark,
  resetBenchmark,
  getBenchmarkResults,
  LIBRARIES,
  POINT_COUNTS,
  LIBRARY_NAMES,
  LIBRARY_COLORS
} from './benchmark.js';

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

// Feature data for counts (mutable for dynamic point count)
let featureData = getAllData();
let currentPointCount = 1000;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMaps();
  setupTabs();
  setupLayerControls();
  setupPointCountPills();
  setupAnimationButton();
  setupPerformanceMonitor();
  setupMobileControls();
  setupCodeModal();
  setupResizeHandler();
  setupBenchmark();
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

function setupPointCountPills() {
  const pills = document.querySelectorAll('.pill');
  const pointCountLabel = document.getElementById('point-count-label');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const count = parseInt(pill.dataset.count, 10);
      if (count === currentPointCount) return;

      // Stop animation if running
      if (isAnimating) {
        stopAnimation();
        document.getElementById('animate-btn').textContent = 'Start Animation';
        document.getElementById('animate-btn').classList.remove('active');
      }

      // Update active pill
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      // Generate new points
      currentPointCount = count;
      const newPoints = getPoints(count);
      featureData.points = newPoints;
      basePoints = newPoints;

      // Update all maps
      maplibreModule.setPointsData(newPoints);
      openlayersModule.setPointsData(newPoints);
      leafletModule.setPointsData(newPoints);
      deckglModule.setPointsData(newPoints);

      // Update UI
      pointCountLabel.textContent = count.toLocaleString();
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
  let lastFrameTime = performance.now();
  const frameTimes = []; // Rolling window of frame times
  const FRAME_WINDOW = 60; // Track last 60 frames for variance calculation

  const fpsElement = document.getElementById('fps');
  const fpsMobile = document.getElementById('fps-mobile');
  const frameTimeElement = document.getElementById('frame-time');
  const jitterElement = document.getElementById('jitter');
  const jitterMobile = document.getElementById('jitter-mobile');

  function calculateJitter(times) {
    if (times.length < 2) return 0;

    // Calculate standard deviation of frame times
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const squaredDiffs = times.map(t => Math.pow(t - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
    return Math.sqrt(avgSquaredDiff);
  }

  function updateFPS() {
    const now = performance.now();
    const frameTime = now - lastFrameTime;
    lastFrameTime = now;

    // Track frame times in rolling window
    frameTimes.push(frameTime);
    if (frameTimes.length > FRAME_WINDOW) {
      frameTimes.shift();
    }

    frameCount++;
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fps = Math.round((frameCount * 1000) / delta);
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const jitter = calculateJitter(frameTimes);

      // Update FPS displays
      fpsElement.textContent = fps;
      if (fpsMobile) fpsMobile.textContent = fps;

      // Update frame time
      if (frameTimeElement) {
        frameTimeElement.textContent = avgFrameTime.toFixed(1);
      }

      // Update jitter displays
      if (jitterElement) {
        jitterElement.textContent = jitter.toFixed(1);
        // Color code jitter: green (<2ms), yellow (2-5ms), red (>5ms)
        const jitterColor = jitter < 2 ? '#2ecc71' : jitter < 5 ? '#f1c40f' : '#e74c3c';
        jitterElement.style.color = jitterColor;
      }
      if (jitterMobile) {
        jitterMobile.textContent = jitter.toFixed(1);
        const jitterColor = jitter < 2 ? '#2ecc71' : jitter < 5 ? '#f1c40f' : '#e74c3c';
        jitterMobile.style.color = jitterColor;
      }

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

// ==========================================
// BENCHMARK FEATURE
// ==========================================

let benchmarkChart = null;

function setupBenchmark() {
  const benchmarkBtn = document.getElementById('benchmark-btn');
  const benchmarkModal = document.getElementById('benchmark-modal');
  const cancelBtn = document.getElementById('benchmark-cancel-btn');
  const closeModalBtn = document.getElementById('benchmark-close');
  const closeResultsBtn = document.getElementById('close-results');
  const progressSection = document.getElementById('benchmark-progress');
  const resultsSection = document.getElementById('benchmark-results');
  const metricBtns = document.querySelectorAll('.metric-btn');

  if (!benchmarkBtn || !benchmarkModal) return;

  // Start benchmark
  benchmarkBtn.addEventListener('click', async () => {
    // Stop any running animation
    if (isAnimating) {
      stopAnimation();
      document.getElementById('animate-btn').textContent = 'Start Animation';
      document.getElementById('animate-btn').classList.remove('active');
    }

    // Disable controls
    disableControls(true);

    // Show modal with progress
    benchmarkModal.classList.add('active');
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';

    try {
      const results = await runBenchmark(updateProgress);

      // Show results
      progressSection.style.display = 'none';
      resultsSection.style.display = 'block';

      // Initialize chart
      initBenchmarkChart(results, 'fps');

    } catch (error) {
      if (error.message !== 'Benchmark cancelled') {
        console.error('Benchmark error:', error);
      }
      closeBenchmarkModal();
    }
  });

  // Cancel benchmark
  cancelBtn.addEventListener('click', () => {
    cancelBenchmark();
  });

  // Close modal (X button)
  closeModalBtn.addEventListener('click', () => {
    cancelBenchmark();
    closeBenchmarkModal();
  });

  // Close results
  closeResultsBtn.addEventListener('click', () => {
    closeBenchmarkModal();
  });

  // Metric toggle buttons
  metricBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      metricBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const metric = btn.dataset.metric;
      const results = getBenchmarkResults();
      updateChartMetric(results, metric);
    });
  });

  // Backdrop click to close (only if results showing)
  benchmarkModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    if (resultsSection.style.display !== 'none') {
      closeBenchmarkModal();
    }
  });
}

function updateProgress({ library, pointCount, testNumber, totalTests, progress }) {
  document.getElementById('benchmark-library').textContent = library;
  document.getElementById('benchmark-points').textContent =
    pointCount.toLocaleString() + ' points';
  document.getElementById('benchmark-status').textContent =
    `Test ${testNumber} of ${totalTests}`;
  document.getElementById('benchmark-progress-fill').style.width = `${progress}%`;
}

function disableControls(disabled) {
  const controls = document.querySelector('.controls');
  const tabs = document.querySelector('.tabs');
  const benchmarkBtn = document.getElementById('benchmark-btn');

  if (disabled) {
    controls.classList.add('disabled');
    tabs.classList.add('disabled');
    benchmarkBtn.disabled = true;
  } else {
    controls.classList.remove('disabled');
    tabs.classList.remove('disabled');
    benchmarkBtn.disabled = false;
  }
}

function closeBenchmarkModal() {
  const benchmarkModal = document.getElementById('benchmark-modal');
  benchmarkModal.classList.remove('active');
  disableControls(false);
  resetBenchmark();

  // Destroy chart to free memory
  if (benchmarkChart) {
    benchmarkChart.destroy();
    benchmarkChart = null;
  }

  // Reset metric buttons
  const metricBtns = document.querySelectorAll('.metric-btn');
  metricBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.metric === 'fps');
  });
}

function initBenchmarkChart(results, metric) {
  const ctx = document.getElementById('benchmark-chart').getContext('2d');

  // Destroy existing chart if any
  if (benchmarkChart) {
    benchmarkChart.destroy();
  }

  const datasets = LIBRARIES.map(lib => ({
    label: LIBRARY_NAMES[lib],
    data: POINT_COUNTS.map(count => getMetricValue(results, lib, count, metric)),
    borderColor: LIBRARY_COLORS[lib],
    backgroundColor: LIBRARY_COLORS[lib] + '33', // 20% opacity
    borderWidth: 3,
    pointRadius: 6,
    pointHoverRadius: 8,
    tension: 0.3,
    fill: false
  }));

  benchmarkChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: POINT_COUNTS.map(c => c >= 1000 ? `${c / 1000}K` : c.toString()),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#eee',
            font: { size: 12 },
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: '#16213e',
          titleColor: '#eee',
          bodyColor: '#eee',
          borderColor: '#0f3460',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const lib = LIBRARIES[context.datasetIndex];
              const count = POINT_COUNTS[context.dataIndex];
              const data = results[lib][count];

              if (metric === 'fps') {
                return `${context.dataset.label}: ${data.avgFps} FPS (min: ${data.minFps}, max: ${data.maxFps})`;
              } else if (metric === 'frameTime') {
                return `${context.dataset.label}: ${data.avgFrameTime}ms`;
              } else {
                return `${context.dataset.label}: ${data.jitter}ms`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Point Count',
            color: '#888'
          },
          ticks: { color: '#888' },
          grid: { color: '#0f3460' }
        },
        y: {
          title: {
            display: true,
            text: getYAxisLabel(metric),
            color: '#888'
          },
          ticks: { color: '#888' },
          grid: { color: '#0f3460' },
          beginAtZero: metric !== 'fps'
        }
      }
    }
  });
}

function updateChartMetric(results, metric) {
  if (!benchmarkChart) return;

  benchmarkChart.data.datasets.forEach((dataset, index) => {
    const lib = LIBRARIES[index];
    dataset.data = POINT_COUNTS.map(count =>
      getMetricValue(results, lib, count, metric)
    );
  });

  benchmarkChart.options.scales.y.title.text = getYAxisLabel(metric);
  benchmarkChart.options.scales.y.beginAtZero = metric !== 'fps';
  benchmarkChart.update();
}

function getMetricValue(results, lib, count, metric) {
  const data = results[lib][count];
  switch (metric) {
    case 'fps': return data.avgFps;
    case 'frameTime': return data.avgFrameTime;
    case 'jitter': return data.jitter;
    default: return data.avgFps;
  }
}

function getYAxisLabel(metric) {
  switch (metric) {
    case 'fps': return 'Frames Per Second';
    case 'frameTime': return 'Frame Time (ms)';
    case 'jitter': return 'Jitter (ms)';
    default: return 'Value';
  }
}
