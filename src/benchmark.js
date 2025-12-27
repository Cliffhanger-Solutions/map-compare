// benchmark.js - Core benchmark functionality

import { getPoints } from './data/fake-data.js';
import * as leafletModule from './leaflet/map.js';
import * as openlayersModule from './openlayers/map.js';
import * as maplibreModule from './maplibre/map.js';
import * as deckglModule from './deckgl/map.js';

// Configuration
export const LIBRARIES = ['leaflet', 'openlayers', 'maplibre', 'deckgl'];
export const POINT_COUNTS = [500, 1000, 5000, 10000];
const TEST_DURATION_MS = 5000;

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

// Create empty results structure
function createEmptyResults() {
  const results = {};
  LIBRARIES.forEach(lib => {
    results[lib] = {};
    POINT_COUNTS.forEach(count => {
      results[lib][count] = {
        avgFps: 0,
        minFps: 0,
        maxFps: 0,
        avgFrameTime: 0,
        jitter: 0
      };
    });
  });
  return results;
}

// Helper: delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Collect metrics during a single test run
function collectMetrics(durationMs, signal) {
  return new Promise((resolve, reject) => {
    const frameTimes = [];
    let lastFrameTime = performance.now();
    let animationId = null;
    const startTime = performance.now();

    function measureFrame() {
      if (signal.aborted) {
        if (animationId) cancelAnimationFrame(animationId);
        reject(new Error('Benchmark cancelled'));
        return;
      }

      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;

      // Only record valid frame times (skip first frame and outliers)
      if (frameTime > 0 && frameTime < 500) {
        frameTimes.push(frameTime);
      }

      // Check if we've collected enough time
      if (now - startTime < durationMs) {
        animationId = requestAnimationFrame(measureFrame);
      } else {
        // Calculate metrics
        if (frameTimes.length < 10) {
          resolve({
            avgFps: 0,
            minFps: 0,
            maxFps: 0,
            avgFrameTime: 0,
            jitter: 0
          });
          return;
        }

        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const avgFps = Math.round(1000 / avgFrameTime);

        const fpsValues = frameTimes.map(ft => 1000 / ft);
        const minFps = Math.round(Math.min(...fpsValues));
        const maxFps = Math.round(Math.max(...fpsValues));

        // Jitter = standard deviation of frame times
        const mean = avgFrameTime;
        const squaredDiffs = frameTimes.map(t => Math.pow(t - mean, 2));
        const jitter = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / frameTimes.length);

        resolve({
          avgFps,
          minFps,
          maxFps,
          avgFrameTime: Math.round(avgFrameTime * 10) / 10,
          jitter: Math.round(jitter * 10) / 10
        });
      }
    }

    // Start measuring
    animationId = requestAnimationFrame(measureFrame);
  });
}

// Run animation for a specific library
function startLibraryAnimation(lib, basePoints) {
  const startTime = performance.now();
  let animationId = null;
  let isRunning = true;

  function animate() {
    if (!isRunning) return;

    const elapsed = (performance.now() - startTime) / 1000;

    const animatedPoints = {
      type: 'FeatureCollection',
      features: basePoints.features.map((feature, i) => {
        const [baseLng, baseLat] = feature.geometry.coordinates;
        const phase = i * 0.1;
        const speed = 0.5 + (i % 5) * 0.2;
        const radius = 0.002 + (i % 10) * 0.0005;

        return {
          ...feature,
          geometry: {
            type: 'Point',
            coordinates: [
              baseLng + Math.cos(elapsed * speed + phase) * radius,
              baseLat + Math.sin(elapsed * speed + phase) * radius
            ]
          }
        };
      })
    };

    // Update only the specific library being tested
    MODULES[lib].updatePointPositions(animatedPoints);
    animationId = requestAnimationFrame(animate);
  }

  animate();

  // Return stop function
  return () => {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };
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
  return new Promise(resolve => {
    setTimeout(() => {
      const map = MODULES[lib].getMap();
      if (lib === 'maplibre' && map) {
        map.resize();
        // Reset view to ensure consistent bounds
        map.jumpTo({ center: VIEW_CENTER, zoom: VIEW_ZOOM_WEBGL });
      } else if (lib === 'openlayers' && map) {
        map.updateSize();
      } else if (lib === 'leaflet' && map) {
        map.invalidateSize();
      } else if (lib === 'deckgl' && map) {
        // Deck.gl needs explicit view state reset
        map.setProps({
          initialViewState: {
            longitude: VIEW_CENTER[0],
            latitude: VIEW_CENTER[1],
            zoom: VIEW_ZOOM_WEBGL,
            pitch: 0,
            bearing: 0
          }
        });
      }
      resolve();
    }, 100); // Allow time for CSS transition
  });
}

// Set point count for a specific library
function setPointCountForLib(lib, points) {
  MODULES[lib].setPointsData(points);
}

// Main benchmark runner
export async function runBenchmark(onProgress) {
  benchmarkState = 'running';
  abortController = new AbortController();
  benchmarkResults = createEmptyResults();

  const totalTests = LIBRARIES.length * POINT_COUNTS.length;
  let currentTest = 0;

  try {
    for (const lib of LIBRARIES) {
      // Switch to this library's tab
      await switchToTab(lib);

      for (const count of POINT_COUNTS) {
        if (abortController.signal.aborted) {
          throw new Error('Benchmark cancelled');
        }

        currentTest++;

        // Update progress
        onProgress({
          library: LIBRARY_NAMES[lib],
          pointCount: count,
          testNumber: currentTest,
          totalTests,
          progress: (currentTest / totalTests) * 100
        });

        // Generate points for this test
        const basePoints = getPoints(count);

        // Set point data for this library only
        setPointCountForLib(lib, basePoints);

        // Allow time for rendering to stabilize
        await delay(500);

        // Start animation and collect metrics simultaneously
        const stopAnimation = startLibraryAnimation(lib, basePoints);

        try {
          const metrics = await collectMetrics(
            TEST_DURATION_MS,
            abortController.signal
          );

          benchmarkResults[lib][count] = metrics;
        } finally {
          stopAnimation();
        }

        // Reset points to static position
        MODULES[lib].updatePointPositions(basePoints);

        // Brief pause between tests
        await delay(200);
      }
    }

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
}
