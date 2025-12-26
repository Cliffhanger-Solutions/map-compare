# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A comparison demo app for evaluating three mapping libraries: MapLibre GL JS, OpenLayers, and Leaflet 2.0 Alpha. Uses fake GeoJSON data to demonstrate layer types, interactivity, and performance differences between WebGL (MapLibre) and Canvas (OpenLayers, Leaflet) rendering approaches.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

```
src/
├── main.js              # Entry point: tab switching, layer controls, animation loop
├── data/fake-data.js    # GeoJSON generators: getPoints(), getPolygons(), getLines()
├── maplibre/map.js      # MapLibre GL JS implementation
├── openlayers/map.js    # OpenLayers implementation
├── leaflet/map.js       # Leaflet 2.0 Alpha implementation
└── styles/main.css      # Dark theme UI
```

**Key patterns:**
- All map modules export: `initMap()`, `setLayerVisibility(layerId, visible)`, `updatePointPositions(geojson)`, `getMap()`, `getFeatureCount()`, `codeSnippets`
- Layer IDs: `points`, `polygons`, `lines`, `heatmap`, `cluster`
- Animation updates all three maps simultaneously via `updatePointPositions()` to stress-test rendering

**MapLibre approach:** Style-spec JSON, `map.addSource()` + `map.addLayer()`, GPU-accelerated WebGL
**OpenLayers approach:** Class-based (VectorLayer, VectorSource, Style objects), Canvas 2D rendering
**Leaflet approach:** ES6 constructors (`new Map()`, `new CircleMarker()`, etc.), Canvas rendering, coordinate order is `[lat, lng]` (not `[lng, lat]`)

## Implementation Notes

### Leaflet 2.0 Alpha
- Uses ES6 module syntax with named imports: `import { Map, TileLayer, CircleMarker } from 'leaflet'`
- Constructor-based API (not factory functions): use `new Map()` instead of `L.map()`
- Coordinate transformation required: Leaflet uses `[lat, lng]`, GeoJSON uses `[lng, lat]`
- Heatmap and clustering layers are placeholders (plugins not yet compatible with Leaflet 2.0 alpha)
- Points layer implements efficient animation via `marker.setLatLng()` without recreating markers
