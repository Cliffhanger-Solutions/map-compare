# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A comparison demo app for evaluating four mapping libraries: Leaflet 2.0 Alpha, OpenLayers, MapLibre GL JS, and Deck.gl. Uses fake GeoJSON data to demonstrate layer types, interactivity, and performance differences between Canvas (Leaflet, OpenLayers) and WebGL (MapLibre, Deck.gl) rendering approaches.

## Commands

```bash
npm run dev              # Start dev server on localhost:3000
npm run dev -- --host    # Start dev server with network access for mobile testing
npm run build            # Production build to dist/
npm run preview          # Preview production build
```

**Mobile testing:** Use `npm run dev -- --host` to expose the server to your network (0.0.0.0). Access from mobile device at `http://[your-ip]:[port]/`

## Architecture

```
src/
├── main.js              # Entry point: tab switching, layer controls, animation loop
├── data/fake-data.js    # GeoJSON generators: getPoints(), getPolygons(), getLines()
├── leaflet/map.js       # Leaflet 2.0 Alpha implementation (Canvas)
├── openlayers/map.js    # OpenLayers implementation (Canvas)
├── maplibre/map.js      # MapLibre GL JS implementation (WebGL)
├── deckgl/map.js        # Deck.gl implementation (WebGL)
└── styles/main.css      # Dark theme UI
```

**Key patterns:**
- All map modules export: `initMap()`, `setLayerVisibility(layerId, visible)`, `updatePointPositions(geojson)`, `setPointsData(geojson)`, `getMap()`, `getFeatureCount()`, `codeSnippets`
- Layer IDs: `points`, `polygons`, `lines`, `heatmap`, `cluster`
- Animation updates all four maps simultaneously via `updatePointPositions()` to stress-test rendering
- Dynamic point count selector: 500, 1K, 5K, 10K (default 1K) - updates via `setPointsData()`
- Feature count display is dynamic - updates based on visible layers and point count

**Tab Order** (progressive improvement):
1. **Leaflet approach:** ES6 constructors (`new Map()`, `new CircleMarker()`, etc.), Canvas rendering, coordinate order is `[lat, lng]` (not `[lng, lat]`)
2. **OpenLayers approach:** Class-based (VectorLayer, VectorSource, Style objects), Canvas 2D rendering
3. **MapLibre approach:** Style-spec JSON, `map.addSource()` + `map.addLayer()`, GPU-accelerated WebGL
4. **Deck.gl approach:** Layer-based composition, standalone with TileLayer basemap, GPU-accelerated WebGL, optimized for large datasets

## Mobile-Friendly UI

The app uses a **hybrid bottom sheet + floating FPS badge** design for mobile devices:

### Responsive Breakpoints
- **Desktop (>1024px):** Two-column layout with 280px sidebar
- **Tablet (769-1024px):** Compressed 240px sidebar
- **Mobile (≤768px):** Bottom sheet controls + floating FPS badge
- **Small phones (≤480px):** Additional space optimizations

### Mobile Features
- **Floating FPS Badge:** Always visible in top-right corner for performance testing (primary goal)
- **Bottom Sheet Controls:** Collapsible drawer starting collapsed on mobile, tap red circular button to expand/collapse
- **Touch-Optimized:** 44px minimum touch targets throughout
- **Code Modal:** Tap "Code Comparison (i)" to view code snippets in full-screen modal
- **Stacked Header:** Title and tabs in full-width grid layout

### Mobile JavaScript Functions
- `setupMobileControls()` - Handles bottom sheet toggle, only runs on mobile (≤768px)
- `setupCodeModal()` - Code viewer modal for mobile, syncs content on tap
- `setupResizeHandler()` - Debounced resize handler for orientation changes, triggers map resize methods
- `setupPerformanceMonitor()` - Updates both desktop (#fps) and mobile (#fps-mobile) FPS displays

### Key Mobile Interactions
- Bottom sheet starts collapsed to maximize map visibility
- FPS badge color-coded: green (≥55 FPS), yellow (≥30 FPS), red (<30 FPS)
- Desktop performance stats hidden on mobile (use floating badge instead)
- Code panel hidden in sidebar on mobile (use modal overlay instead)

## Implementation Notes

### Leaflet 2.0 Alpha
- Uses ES6 module syntax with named imports: `import { Map, TileLayer, CircleMarker } from 'leaflet'`
- Constructor-based API (not factory functions): use `new Map()` instead of `L.map()`
- Coordinate transformation required: Leaflet uses `[lat, lng]`, GeoJSON uses `[lng, lat]`
- Heatmap and clustering layers are placeholders (plugins not yet compatible with Leaflet 2.0 alpha)
- Points layer implements efficient animation via `marker.setLatLng()` without recreating markers

### Deck.gl
- Uses standalone rendering with TileLayer + BitmapLayer for OSM basemap tiles (pure Deck.gl, no MapLibre overlay)
- Layer types: ScatterplotLayer (points), GeoJsonLayer (polygons/lines), HeatmapLayer
- Coordinate order: `[lng, lat]` (standard GeoJSON)
- Animation updates via `deck.setProps({ layers: [...] })` - Deck.gl efficiently diffs layer data
- Clustering is a placeholder (would require Supercluster library for proper implementation)
- Click popups implemented via custom DOM overlay (Deck.gl has no built-in popup component)
