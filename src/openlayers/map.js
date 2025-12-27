import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import HeatmapLayer from 'ol/layer/Heatmap.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import Cluster from 'ol/source/Cluster.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style.js';
import { fromLonLat, transformExtent } from 'ol/proj.js';
import Overlay from 'ol/Overlay.js';
import 'ol/ol.css';

import { getAllData, getBounds } from '../data/fake-data.js';

let map = null;
let popup = null;
let popupOverlay = null;
const data = getAllData();
const layers = {};
let pointsSource = null;
let clusterSource = null;
const format = new GeoJSON();

// Code snippets for display
export const codeSnippets = {
  points: `// OpenLayers - Points Layer
const pointsSource = new VectorSource({
  features: new GeoJSON().readFeatures(
    pointsGeoJSON,
    { featureProjection: 'EPSG:3857' }
  )
});

const pointsLayer = new VectorLayer({
  source: pointsSource,
  style: new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: '#e94560' }),
      stroke: new Stroke({
        color: '#fff',
        width: 2
      })
    })
  })
});

map.addLayer(pointsLayer);`,

  polygons: `// OpenLayers - Polygons Layer
const polygonsSource = new VectorSource({
  features: new GeoJSON().readFeatures(
    polygonsGeoJSON,
    { featureProjection: 'EPSG:3857' }
  )
});

const polygonsLayer = new VectorLayer({
  source: polygonsSource,
  style: (feature) => new Style({
    fill: new Fill({
      color: feature.get('color') + '80'
    }),
    stroke: new Stroke({
      color: '#fff',
      width: 2
    })
  })
});

map.addLayer(polygonsLayer);`,

  lines: `// OpenLayers - Lines Layer
const linesSource = new VectorSource({
  features: new GeoJSON().readFeatures(
    linesGeoJSON,
    { featureProjection: 'EPSG:3857' }
  )
});

const linesLayer = new VectorLayer({
  source: linesSource,
  style: (feature) => new Style({
    stroke: new Stroke({
      color: feature.get('color'),
      width: 4,
      lineCap: 'round',
      lineJoin: 'round'
    })
  })
});

map.addLayer(linesLayer);`,

  heatmap: `// OpenLayers - Heatmap Layer
const heatmapLayer = new HeatmapLayer({
  source: pointsSource,
  blur: 15,
  radius: 20,
  weight: (feature) => {
    const magnitude = feature.get('magnitude');
    return magnitude / 10;
  },
  gradient: [
    '#2ecc71', '#f1c40f',
    '#e67e22', '#e74c3c', '#9b59b6'
  ]
});

map.addLayer(heatmapLayer);`,

  cluster: `// OpenLayers - Clustering
const clusterSource = new Cluster({
  distance: 50,
  source: pointsSource
});

const clusterLayer = new VectorLayer({
  source: clusterSource,
  style: (feature) => {
    const size = feature.get('features').length;
    return new Style({
      image: new Circle({
        radius: 10 + Math.min(size / 10, 30),
        fill: new Fill({
          color: size > 500 ? '#e94560' :
                 size > 100 ? '#f1c40f' : '#2ecc71'
        })
      }),
      text: new Text({
        text: size.toString(),
        fill: new Fill({ color: '#fff' })
      })
    });
  }
});

map.addLayer(clusterLayer);`
};

export function initMap() {
  const bounds = getBounds(); // [minLng, minLat, maxLng, maxLat]

  // Create popup element
  createPopup();

  // Parse GeoJSON data
  const pointFeatures = format.readFeatures(data.points, { featureProjection: 'EPSG:3857' });
  const polygonFeatures = format.readFeatures(data.polygons, { featureProjection: 'EPSG:3857' });
  const lineFeatures = format.readFeatures(data.lines, { featureProjection: 'EPSG:3857' });

  // Create sources
  pointsSource = new VectorSource({ features: pointFeatures });
  const polygonsSource = new VectorSource({ features: polygonFeatures });
  const linesSource = new VectorSource({ features: lineFeatures });

  // Cluster source
  clusterSource = new Cluster({
    distance: 50,
    source: pointsSource
  });

  // Create layers
  layers.polygons = new VectorLayer({
    source: polygonsSource,
    style: (feature) => createPolygonStyle(feature, false)
  });

  layers.lines = new VectorLayer({
    source: linesSource,
    style: (feature) => new Style({
      stroke: new Stroke({
        color: feature.get('color'),
        width: 4,
        lineCap: 'round',
        lineJoin: 'round'
      })
    })
  });

  layers.heatmap = new HeatmapLayer({
    source: pointsSource,
    blur: 15,
    radius: 20,
    weight: (feature) => {
      const magnitude = feature.get('magnitude');
      return magnitude / 10;
    },
    gradient: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'],
    visible: false
  });

  layers.cluster = new VectorLayer({
    source: clusterSource,
    style: (feature) => {
      const features = feature.get('features');
      const size = features.length;

      if (size === 1) {
        // Single point
        return new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#e94560' }),
            stroke: new Stroke({ color: '#fff', width: 2 })
          })
        });
      }

      // Cluster
      let color = '#2ecc71';
      if (size > 500) color = '#e94560';
      else if (size > 100) color = '#f1c40f';

      return new Style({
        image: new CircleStyle({
          radius: 15 + Math.min(size / 20, 25),
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        }),
        text: new Text({
          text: size.toString(),
          font: 'bold 14px sans-serif',
          fill: new Fill({ color: '#fff' })
        })
      });
    },
    visible: false
  });

  layers.points = new VectorLayer({
    source: pointsSource,
    style: new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#e94560' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    })
  });

  // Create map
  map = new Map({
    target: 'map-openlayers',
    layers: [
      new TileLayer({
        source: new OSM()
      }),
      layers.polygons,
      layers.lines,
      layers.heatmap,
      layers.cluster,
      layers.points
    ],
    view: new View(),
    overlays: [popupOverlay]
  });

  // Fit to bounds after map is created
  const extent = transformExtent(bounds, 'EPSG:4326', 'EPSG:3857');
  map.getView().fit(extent, { padding: [20, 20, 20, 20] });

  // Add interactions
  addInteractions();

  return map;
}

function createPopup() {
  popup = document.createElement('div');
  popup.className = 'ol-popup';
  popup.innerHTML = `
    <a href="#" class="ol-popup-closer">&times;</a>
    <div class="ol-popup-content"></div>
  `;
  document.body.appendChild(popup);

  popupOverlay = new Overlay({
    element: popup,
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
  });

  // Close button
  popup.querySelector('.ol-popup-closer').addEventListener('click', (e) => {
    e.preventDefault();
    popupOverlay.setPosition(undefined);
  });
}

function createPolygonStyle(feature, hover) {
  const color = feature.get('color');
  const opacity = hover ? 'cc' : '80'; // hex opacity

  return new Style({
    fill: new Fill({
      color: color + opacity
    }),
    stroke: new Stroke({
      color: '#ffffff',
      width: hover ? 3 : 2
    })
  });
}

function addInteractions() {
  let hoveredFeature = null;

  // Pointer move for hover effects
  map.on('pointermove', (e) => {
    // Reset previous hover
    if (hoveredFeature) {
      const layer = layers.polygons;
      if (layer.getSource().hasFeature(hoveredFeature)) {
        hoveredFeature.setStyle(createPolygonStyle(hoveredFeature, false));
      }
      hoveredFeature = null;
    }

    // Check for feature under cursor
    const feature = map.forEachFeatureAtPixel(e.pixel, (f, layer) => {
      return { feature: f, layer };
    });

    if (feature && feature.layer === layers.polygons) {
      hoveredFeature = feature.feature;
      hoveredFeature.setStyle(createPolygonStyle(hoveredFeature, true));
    }

    // Cursor style
    map.getTargetElement().style.cursor = feature ? 'pointer' : '';
  });

  // Click for popups
  map.on('click', (e) => {
    const hit = map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
      return { feature, layer };
    });

    if (!hit) {
      popupOverlay.setPosition(undefined);
      return;
    }

    const { feature, layer } = hit;
    let content = '';

    if (layer === layers.points) {
      const props = feature.getProperties();
      content = `
        <strong>${props.name}</strong><br>
        Category: ${props.category}<br>
        Magnitude: ${props.magnitude.toFixed(1)}
      `;
    } else if (layer === layers.polygons) {
      const props = feature.getProperties();
      content = `
        <strong>${props.name}</strong><br>
        Type: ${props.type}<br>
        Population: ${props.population.toLocaleString()}
      `;
    } else if (layer === layers.lines) {
      const props = feature.getProperties();
      content = `
        <strong>${props.name}</strong><br>
        Type: ${props.type}<br>
        Distance: ${props.distance} km
      `;
    } else if (layer === layers.cluster) {
      const features = feature.get('features');
      if (features.length === 1) {
        const props = features[0].getProperties();
        content = `
          <strong>${props.name}</strong><br>
          Category: ${props.category}<br>
          Magnitude: ${props.magnitude.toFixed(1)}
        `;
      } else {
        // Zoom into cluster
        const extent = feature.getGeometry().getExtent();
        map.getView().fit(extent, {
          duration: 500,
          maxZoom: map.getView().getZoom() + 2
        });
        return;
      }
    }

    if (content) {
      popup.querySelector('.ol-popup-content').innerHTML = content;
      popupOverlay.setPosition(e.coordinate);
    }
  });
}

export function setLayerVisibility(layerId, visible) {
  if (!layers[layerId]) return;

  layers[layerId].setVisible(visible);

  // Hide regular points when clustering is on
  if (layerId === 'cluster' && visible) {
    layers.points.setVisible(false);
  }
}

export function getMap() {
  return map;
}

export function getFeatureCount() {
  return data.points.features.length +
         data.polygons.features.length +
         data.lines.features.length;
}

// Animation support - update all point positions
export function updatePointPositions(animatedData) {
  if (!pointsSource) return;

  // Clear existing features and add new ones
  const newFeatures = format.readFeatures(animatedData, { featureProjection: 'EPSG:3857' });
  pointsSource.clear();
  pointsSource.addFeatures(newFeatures);

  // Refresh cluster source
  if (clusterSource) {
    clusterSource.refresh();
  }
}
