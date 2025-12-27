import { Deck } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { getAllData, getCenter, getBounds } from '../data/fake-data.js';

let deck = null;
const data = getAllData();
const center = getCenter();

// Layer visibility state
const layerVisibility = {
  points: true,
  polygons: true,
  lines: true,
  heatmap: false,
  cluster: false
};

// Current point data (for animation)
let currentPointData = data.points;

// Code snippets for display
export const codeSnippets = {
  points: `// Deck.gl - Points Layer (ScatterplotLayer)
import { ScatterplotLayer } from '@deck.gl/layers';

const pointsLayer = new ScatterplotLayer({
  id: 'points',
  data: pointsGeoJSON.features,
  getPosition: d => d.geometry.coordinates,
  getRadius: 200,
  getFillColor: [233, 69, 96],
  getLineColor: [255, 255, 255],
  getLineWidth: 2,
  stroked: true,
  pickable: true
});`,

  polygons: `// Deck.gl - Polygons Layer (GeoJsonLayer)
import { GeoJsonLayer } from '@deck.gl/layers';

const polygonsLayer = new GeoJsonLayer({
  id: 'polygons',
  data: polygonsGeoJSON,
  filled: true,
  stroked: true,
  getFillColor: d => hexToRgb(d.properties.color, 128),
  getLineColor: [255, 255, 255],
  getLineWidth: 2,
  pickable: true
});`,

  lines: `// Deck.gl - Lines Layer (GeoJsonLayer)
import { GeoJsonLayer } from '@deck.gl/layers';

const linesLayer = new GeoJsonLayer({
  id: 'lines',
  data: linesGeoJSON,
  stroked: true,
  getLineColor: d => hexToRgb(d.properties.color),
  getLineWidth: 4,
  lineWidthUnits: 'pixels',
  pickable: true
});`,

  heatmap: `// Deck.gl - Heatmap Layer
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

const heatmapLayer = new HeatmapLayer({
  id: 'heatmap',
  data: pointsGeoJSON.features,
  getPosition: d => d.geometry.coordinates,
  getWeight: d => d.properties.magnitude,
  radiusPixels: 30,
  intensity: 1,
  threshold: 0.03,
  colorRange: [
    [46, 204, 113],   // green
    [241, 196, 15],   // yellow
    [230, 126, 34],   // orange
    [231, 76, 60],    // red
    [155, 89, 182]    // purple
  ]
});`,

  cluster: `// Deck.gl - Clustering (placeholder)
// Deck.gl doesn't have built-in clustering like MapLibre.
// Options: use Supercluster library with IconLayer,
// or use H3HexagonLayer for spatial aggregation.

import Supercluster from 'supercluster';

const index = new Supercluster({
  radius: 50,
  maxZoom: 14
});
index.load(pointsGeoJSON.features);

const clusters = index.getClusters(bbox, zoom);
// Then render with ScatterplotLayer + TextLayer`
};

// Convert hex color to RGB array
function hexToRgb(hex, alpha = 255) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), alpha]
    : [128, 128, 128, alpha];
}

function createLayers() {
  const layers = [];

  // OSM Tile basemap
  layers.push(
    new TileLayer({
      id: 'osm-tiles',
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const { boundingBox } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]]
        });
      }
    })
  );

  // Polygons layer
  if (layerVisibility.polygons) {
    layers.push(
      new GeoJsonLayer({
        id: 'polygons',
        data: data.polygons,
        filled: true,
        stroked: true,
        getFillColor: d => hexToRgb(d.properties.color, 128),
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        onClick: ({ object }) => {
          if (object) {
            showPopup(object.properties.name, `
              Type: ${object.properties.type}<br>
              Population: ${object.properties.population.toLocaleString()}
            `);
          }
        }
      })
    );
  }

  // Lines layer
  if (layerVisibility.lines) {
    layers.push(
      new GeoJsonLayer({
        id: 'lines',
        data: data.lines,
        stroked: true,
        getLineColor: d => hexToRgb(d.properties.color),
        getLineWidth: 4,
        lineWidthUnits: 'pixels',
        pickable: true,
        onClick: ({ object }) => {
          if (object) {
            showPopup(object.properties.name, `
              Type: ${object.properties.type}<br>
              Distance: ${object.properties.distance} km
            `);
          }
        }
      })
    );
  }

  // Heatmap layer
  if (layerVisibility.heatmap) {
    layers.push(
      new HeatmapLayer({
        id: 'heatmap',
        data: currentPointData.features,
        getPosition: d => d.geometry.coordinates,
        getWeight: d => d.properties.magnitude,
        radiusPixels: 30,
        intensity: 1,
        threshold: 0.03,
        colorRange: [
          [46, 204, 113],   // green
          [241, 196, 15],   // yellow
          [230, 126, 34],   // orange
          [231, 76, 60],    // red
          [155, 89, 182]    // purple
        ]
      })
    );
  }

  // Points layer (or placeholder cluster layer)
  if (layerVisibility.cluster) {
    // Simplified clustering visualization using larger circles grouped by position
    // For real clustering, use Supercluster library
    layers.push(
      new ScatterplotLayer({
        id: 'cluster-placeholder',
        data: currentPointData.features,
        getPosition: d => d.geometry.coordinates,
        getRadius: 300,
        getFillColor: [46, 204, 113, 180],
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        pickable: true
      })
    );
  } else if (layerVisibility.points) {
    layers.push(
      new ScatterplotLayer({
        id: 'points',
        data: currentPointData.features,
        getPosition: d => d.geometry.coordinates,
        getRadius: 200,
        radiusUnits: 'meters',
        getFillColor: [233, 69, 96],
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        pickable: true,
        onClick: ({ object }) => {
          if (object) {
            showPopup(object.properties.name, `
              Category: ${object.properties.category}<br>
              Magnitude: ${object.properties.magnitude.toFixed(1)}
            `);
          }
        }
      })
    );
  }

  return layers;
}

// Simple popup implementation
let popupElement = null;

function showPopup(title, content) {
  if (!popupElement) {
    popupElement = document.createElement('div');
    popupElement.className = 'deckgl-popup';
    popupElement.innerHTML = `
      <button class="popup-close">&times;</button>
      <div class="popup-content"></div>
    `;
    popupElement.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: white;
      padding: 10px 15px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      max-width: 200px;
      font-size: 13px;
      display: none;
    `;
    document.getElementById('map-deckgl').appendChild(popupElement);

    popupElement.querySelector('.popup-close').addEventListener('click', () => {
      popupElement.style.display = 'none';
    });
    popupElement.querySelector('.popup-close').style.cssText = `
      position: absolute;
      top: 5px;
      right: 8px;
      border: none;
      background: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
    `;
  }

  popupElement.querySelector('.popup-content').innerHTML = `<strong>${title}</strong><br>${content}`;
  popupElement.style.display = 'block';
}

function updateLayers() {
  if (deck) {
    deck.setProps({ layers: createLayers() });
  }
}

export function initMap() {
  const bounds = getBounds(); // [minLng, minLat, maxLng, maxLat]

  // Calculate zoom to fit bounds (approximate)
  const latDiff = bounds[3] - bounds[1];
  const lngDiff = bounds[2] - bounds[0];
  const maxDiff = Math.max(latDiff, lngDiff);
  const zoom = Math.floor(Math.log2(360 / maxDiff)) - 1;

  deck = new Deck({
    parent: document.getElementById('map-deckgl'),
    initialViewState: {
      longitude: center[0],
      latitude: center[1],
      zoom: zoom,
      pitch: 0,
      bearing: 0
    },
    controller: true,
    layers: createLayers(),
    getTooltip: ({ object }) => {
      if (!object) return null;
      const props = object.properties;
      if (!props) return null;
      return {
        html: `<strong>${props.name}</strong>`,
        style: {
          backgroundColor: '#1a1a2e',
          color: '#eee',
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '4px'
        }
      };
    }
  });

  return deck;
}

export function setLayerVisibility(layerId, visible) {
  layerVisibility[layerId] = visible;

  // Special handling: clustering replaces regular points
  if (layerId === 'cluster' && visible) {
    layerVisibility.points = false;
  }

  updateLayers();
}

export function getMap() {
  return deck;
}

export function getFeatureCount() {
  return data.points.features.length +
         data.polygons.features.length +
         data.lines.features.length;
}

// Animation support - update all point positions
export function updatePointPositions(animatedData) {
  currentPointData = animatedData;
  updateLayers();
}
