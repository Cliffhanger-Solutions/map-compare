// benchmark.js - Core benchmark functionality with improved methodology

import { getPoints } from './data/fake-data.js';
import * as leafletModule from './leaflet/map.js';
import * as openlayersModule from './openlayers/map.js';
import * as maplibreModule from './maplibre/map.js';
import * as deckglModule from './deckgl/map.js';

// Configuration
export const LIBRARIES = ['leaflet', 'openlayers', 'maplibre', 'deckgl'];
export const POINT_COUNTS = [500, 1000, 5000, 10000];

// Timing configuration
const WARMUP_MS = 2000;           // 2 second warmup (discarded)
const TEST_DURATION_MS = 10000;   // 10 second measurement phase
const ITERATIONS = 3;             // 3 runs per configuration
const THROTTLE_THRESHOLD_MS = 100; // Frame gap indicating tab throttling
const BENCHMARK_SEED = 42;        // Fixed seed for reproducible data

// Shared view configuration (matching all maps)
const VIEW_CENTER = [-74.0060, 40.7128]; // [lng, lat]
const VIEW_ZOOM_CANVAS = 11; // Leaflet, OpenLayers (Canvas)
const VIEW_ZOOM_WEBGL = 10;  // MapLibre, Deck.gl (WebGL renders 1 level deeper)

// Library display names
export const LIBRARY_NAMES = {
  leaflet: 'Leaflet 2.0',
  openlayers: 'OpenLayers',
  maplibre: 'MapLibre GL',
  deckgl: 'Deck.gl'
};

// Chart colors (matching app theme)
export const LIBRARY_COLORS = {
  leaflet: '#e94560',      // Primary red
  openlayers: '#3498db',   // Blue
  maplibre: '#2ecc71',     // Green
  deckgl: '#f39c12'        // Orange
};

// Module mapping
const MODULES = {
  leaflet: leafletModule,
  openlayers: openlayersModule,
  maplibre: maplibreModule,
  deckgl: deckglModule
};

// Benchmark state
let benchmarkState = 'idle';
let abortController = null;
let benchmarkResults = {};

// Create empty results structure with iteration support
function createEmptyResults() {
  const results = {};
  LIBRARIES.forEach(lib => {
    results[lib] = {};
    POINT_COUNTS.forEach(count => {
      results[lib][count] = {
        iterations: [],  // Array of per-iteration metrics
        combined: null   // Combined stats calculated after all iterations
      };
    });
  });
  return results;
}

// Helper: delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fisher-Yates shuffle for randomized test order
function generateTestOrder() {
  const tests = [];
  for (const lib of LIBRARIES) {
    for (const count of POINT_COUNTS) {
      tests.push({ lib, count });
    }
  }
  // Shuffle
  for (let i = tests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tests[i], tests[j]] = [tests[j], tests[i]];
  }
  return tests;
}

// Animation buffer cache to avoid GC pressure during benchmarks
// Key: point count, Value: { baseCoords, animatedPoints }
const animationBuffers = new Map();

// Pre-allocate animation buffer for a given point set
function getAnimationBuffer(basePoints) {
  const count = basePoints.features.length;

  if (!animationBuffers.has(count)) {
    // Cache base coordinates and create reusable GeoJSON structure
    const baseCoords = basePoints.features.map(f => [...f.geometry.coordinates]);
    const animatedPoints = {
      type: 'FeatureCollection',
      features: basePoints.features.map((feature, i) => ({
        type: 'Feature',
        properties: feature.properties,
        geometry: {
          type: 'Point',
          coordinates: [baseCoords[i][0], baseCoords[i][1]] // Will be mutated in place
        }
      }))
    };
    animationBuffers.set(count, { baseCoords, animatedPoints });
  }

  return animationBuffers.get(count);
}

// Update animated points in place (no allocations per frame)
function updateAnimatedPoints(basePoints, elapsed) {
  const { baseCoords, animatedPoints } = getAnimationBuffer(basePoints);
  const features = animatedPoints.features;

  for (let i = 0; i < features.length; i++) {
    const [baseLng, baseLat] = baseCoords[i];
    const phase = i * 0.1;
    const speed = 0.5 + (i % 5) * 0.2;
    const radius = 0.002 + (i % 10) * 0.0005;

    // Mutate coordinates in place - no new object allocation
    const coords = features[i].geometry.coordinates;
    coords[0] = baseLng + Math.cos(elapsed * speed + phase) * radius;
    coords[1] = baseLat + Math.sin(elapsed * speed + phase) * radius;
  }

  return animatedPoints;
}

// Calculate metrics from frame times with IQR outlier detection
// Frame time = time between consecutive rAF callbacks = inverse of actual FPS
function calculateMetrics(frameTimes) {
  if (frameTimes.length < 10) {
    return {
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      avgFrameTime: 0,
      jitter: 0,
      outliersExcluded: 0
    };
  }

  // Sort for percentile calculations
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const len = sorted.length;

  // IQR for outlier detection
  const q1Index = Math.floor(len * 0.25);
  const q3Index = Math.floor(len * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Filter outliers
  let filtered = frameTimes.filter(t => t >= lowerBound && t <= upperBound);
  const outliersExcluded = frameTimes.length - filtered.length;

  if (filtered.length < 10) {
    // If too many outliers, fall back to original data (replace, don't append)
    filtered = [...frameTimes];
  }

  // Calculate stats on filtered data
  const avgFrameTime = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const avgFps = Math.round(1000 / avgFrameTime);

  const fpsValues = filtered.map(ft => 1000 / ft);
  const minFps = Math.round(Math.min(...fpsValues));
  const maxFps = Math.round(Math.max(...fpsValues));

  // Jitter = standard deviation
  const mean = avgFrameTime;
  const variance = filtered.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / filtered.length;
  const jitter = Math.sqrt(variance);

  // Calculate median (average two middle values for even-length arrays)
  const sortedFiltered = [...filtered].sort((a, b) => a - b);
  const mid = sortedFiltered.length / 2;
  const medianFrameTime = sortedFiltered.length % 2 === 0
    ? (sortedFiltered[mid - 1] + sortedFiltered[mid]) / 2
    : sortedFiltered[Math.floor(mid)];
  const medianFps = Math.round(1000 / medianFrameTime);

  return {
    avgFps,
    minFps,
    maxFps,
    medianFps,
    avgFrameTime: Math.round(avgFrameTime * 100) / 100,
    jitter: Math.round(jitter * 100) / 100,
    outliersExcluded
  };
}

// Unified animation + measurement loop
// NOTE: We measure FRAME TIME (time between rAF callbacks), not API call time.
// This is critical for WebGL libraries where the actual GPU work is async.
// Frame time = how fast the system can produce frames = true throughput.
function runMeasuredAnimation(lib, basePoints, { warmupMs, durationMs, signal }) {
  return new Promise((resolve, reject) => {
    const frameTimes = [];
    let animationId = null;
    const startTime = performance.now();
    const animationStart = performance.now();
    let isWarmup = true;
    let lastFrameTime = performance.now();
    let maxFrameGap = 0;
    let throttleWarnings = 0;

    // Visibility change listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn('Tab hidden during benchmark - results may be affected');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    function cleanup() {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationId) cancelAnimationFrame(animationId);
    }

    function animate() {
      if (signal.aborted) {
        cleanup();
        reject(new Error('Benchmark cancelled'));
        return;
      }

      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;

      // Track max frame gap for throttle detection (after warmup)
      if (!isWarmup && frameTime > maxFrameGap) {
        maxFrameGap = frameTime;
      }

      // Count throttle events (only after warmup to match maxFrameGap tracking)
      if (!isWarmup && frameTime > THROTTLE_THRESHOLD_MS) {
        throttleWarnings++;
      }

      // Check warmup phase
      if (isWarmup && (now - startTime) >= warmupMs) {
        isWarmup = false;
      }

      // Calculate elapsed time for animation
      const elapsed = (now - animationStart) / 1000;

      // Update animated points in place (zero allocations per frame)
      const animatedPoints = updateAnimatedPoints(basePoints, elapsed);

      // Update the map (async for WebGL, sync for Canvas)
      MODULES[lib].updatePointPositions(animatedPoints);

      // Record frame time (interval between consecutive rAF callbacks)
      // This captures true throughput: includes previous frame's render work + compositor time
      // Valid range: 1ms (1000fps) to 200ms (5fps) - pre-filters extreme stalls before IQR
      if (!isWarmup && frameTime > 1 && frameTime < 200) {
        frameTimes.push(frameTime);
      }

      // Check if measurement phase complete
      if ((now - startTime) < (warmupMs + durationMs)) {
        animationId = requestAnimationFrame(animate);
      } else {
        cleanup();
        // Calculate metrics from frame times
        const metrics = calculateMetrics(frameTimes);
        resolve({
          ...metrics,
          maxFrameGap: Math.round(maxFrameGap),
          throttleWarnings
        });
      }
    }

    animationId = requestAnimationFrame(animate);
  });
}

// Switch to a specific tab
function switchToTab(lib) {
  const tabs = document.querySelectorAll('.tab');
  const mapContainers = {
    leaflet: document.getElementById('map-leaflet'),
    openlayers: document.getElementById('map-openlayers'),
    maplibre: document.getElementById('map-maplibre'),
    deckgl: document.getElementById('map-deckgl')
  };

  // Update tab UI
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === lib);
  });

  // Switch map visibility
  Object.entries(mapContainers).forEach(([key, container]) => {
    container.classList.toggle('active', key === lib);
  });

  // Trigger resize and reset view for the active map
  // Allow 250ms for WebGL context initialization and resize
  return new Promise(resolve => {
    setTimeout(() => {
      const map = MODULES[lib].getMap();
      if (lib === 'maplibre' && map) {
        map.resize();
        map.jumpTo({ center: VIEW_CENTER, zoom: VIEW_ZOOM_WEBGL });
      } else if (lib === 'openlayers' && map) {
        map.updateSize();
      } else if (lib === 'leaflet' && map) {
        map.invalidateSize();
      } else if (lib === 'deckgl' && map) {
        const container = document.getElementById('map-deckgl');
        const { clientWidth, clientHeight } = container;
        map.setProps({
          width: clientWidth,
          height: clientHeight,
          initialViewState: {
            longitude: VIEW_CENTER[0],
            latitude: VIEW_CENTER[1],
            zoom: VIEW_ZOOM_WEBGL,
            pitch: 0,
            bearing: 0
          }
        });
        map.redraw(true);
      }
      resolve();
    }, 250);
  });
}

// Set point count for a specific library
function setPointCountForLib(lib, points) {
  MODULES[lib].setPointsData(points);
}

// Hide non-essential layers during benchmark
function hideNonEssentialLayers(lib) {
  MODULES[lib].setLayerVisibility('polygons', false);
  MODULES[lib].setLayerVisibility('lines', false);
  MODULES[lib].setLayerVisibility('heatmap', false);
  MODULES[lib].setLayerVisibility('cluster', false);
}

// Restore layers after benchmark
function restoreLayers(lib) {
  MODULES[lib].setLayerVisibility('polygons', true);
  MODULES[lib].setLayerVisibility('lines', true);
}

// Calculate combined statistics from all iterations
function calculateCombinedStats(results) {
  for (const lib of LIBRARIES) {
    for (const count of POINT_COUNTS) {
      const iterations = results[lib][count].iterations;

      if (iterations.length === 0) continue;

      // Extract values from all iterations
      const allFps = iterations.map(i => i.avgFps);
      const allMedianFps = iterations.map(i => i.medianFps || i.avgFps);
      const allFrameTimes = iterations.map(i => i.avgFrameTime);
      const allJitter = iterations.map(i => i.jitter);
      const allMinFps = iterations.map(i => i.minFps);
      const allMaxFps = iterations.map(i => i.maxFps);

      // Sort for median calculation
      const sortedFps = [...allMedianFps].sort((a, b) => a - b);
      const sortedJitter = [...allJitter].sort((a, b) => a - b);

      const medianIndex = Math.floor(sortedFps.length / 2);

      // Calculate FPS IQR (or range for small sample sizes)
      let fpsIqr = 0;
      if (sortedFps.length >= 4) {
        const q1 = sortedFps[Math.floor(sortedFps.length * 0.25)];
        const q3 = sortedFps[Math.floor(sortedFps.length * 0.75)];
        fpsIqr = q3 - q1;
      } else if (sortedFps.length >= 2) {
        // For small samples (e.g., 3 iterations), use range as variability measure
        fpsIqr = sortedFps[sortedFps.length - 1] - sortedFps[0];
      }

      results[lib][count].combined = {
        // Primary metrics (median across iterations)
        medianFps: sortedFps[medianIndex],
        avgFps: Math.round(allFps.reduce((a, b) => a + b, 0) / allFps.length),
        minFps: Math.min(...allMinFps),
        maxFps: Math.max(...allMaxFps),

        // Frame time
        avgFrameTime: Math.round(allFrameTimes.reduce((a, b) => a + b, 0) / allFrameTimes.length * 100) / 100,

        // Jitter (median)
        jitter: sortedJitter[medianIndex],

        // IQR for FPS (measure of consistency)
        fpsIqr,

        // Outliers excluded across all iterations
        totalOutliersExcluded: iterations.reduce((sum, i) => sum + (i.outliersExcluded || 0), 0),

        // Individual iteration data for detailed view
        iterationDetails: iterations
      };
    }
  }
}

// Main benchmark runner
export async function runBenchmark(onProgress) {
  benchmarkState = 'running';
  abortController = new AbortController();
  benchmarkResults = createEmptyResults();

  // Pre-generate seeded point data for each count (reproducible)
  const pointDataCache = {};
  for (const count of POINT_COUNTS) {
    pointDataCache[count] = getPoints(count, BENCHMARK_SEED);
  }

  const totalTests = LIBRARIES.length * POINT_COUNTS.length * ITERATIONS;
  let currentTest = 0;

  try {
    // Run multiple iterations
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      // Randomize test order each iteration
      const testOrder = generateTestOrder();

      for (const { lib, count } of testOrder) {
        if (abortController.signal.aborted) {
          throw new Error('Benchmark cancelled');
        }

        currentTest++;

        // Update progress
        onProgress({
          library: LIBRARY_NAMES[lib],
          pointCount: count,
          iteration: iteration + 1,
          totalIterations: ITERATIONS,
          testNumber: currentTest,
          totalTests,
          progress: (currentTest / totalTests) * 100
        });

        // Switch to this library's tab
        await switchToTab(lib);

        // Hide non-essential layers for focused testing
        hideNonEssentialLayers(lib);

        // Use cached seeded points (same data every time)
        const basePoints = pointDataCache[count];
        setPointCountForLib(lib, basePoints);

        // Allow time for rendering to stabilize (500ms for large buffer uploads on WebGL)
        await delay(500);

        // Run measured animation with warmup
        const metrics = await runMeasuredAnimation(lib, basePoints, {
          warmupMs: WARMUP_MS,
          durationMs: TEST_DURATION_MS,
          signal: abortController.signal
        });

        // Check for tab throttling
        if (metrics.throttleWarnings > 0) {
          console.warn(`Tab throttling detected for ${lib}@${count}: ${metrics.throttleWarnings} events, max gap ${metrics.maxFrameGap}ms`);
        }

        // Store iteration result
        benchmarkResults[lib][count].iterations.push(metrics);

        // Restore layers
        restoreLayers(lib);

        // Reset points to static position
        MODULES[lib].updatePointPositions(basePoints);

        // Brief pause between tests
        await delay(200);
      }
    }

    // Calculate combined stats for each lib/count
    calculateCombinedStats(benchmarkResults);

    benchmarkState = 'complete';
    return benchmarkResults;

  } catch (error) {
    benchmarkState = error.message === 'Benchmark cancelled' ? 'cancelled' : 'error';
    throw error;
  }
}

// Cancel running benchmark
export function cancelBenchmark() {
  if (abortController) {
    abortController.abort();
  }
}

// Get results
export function getBenchmarkResults() {
  return benchmarkResults;
}

// Get state
export function getBenchmarkState() {
  return benchmarkState;
}

// Reset state
export function resetBenchmark() {
  benchmarkState = 'idle';
  abortController = null;
  benchmarkResults = {};
  animationBuffers.clear(); // Free animation buffer memory
}
