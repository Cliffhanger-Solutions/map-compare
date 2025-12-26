import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllData, getCenter } from '../data/fake-data.js';

let map = null;
let popup = null;
const data = getAllData();

// Code snippets for display
export const codeSnippets = {
  points: `// MapLibre GL JS - Points Layer
map.addSource('points', {
  type: 'geojson',
  data: pointsGeoJSON
});

map.addLayer({
  id: 'points-layer',
  type: 'circle',
  source: 'points',
  paint: {
    'circle-radius': 6,
    'circle-color': '#e94560',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff'
  }
});`,

  polygons: `// MapLibre GL JS - Polygons Layer
map.addSource('polygons', {
  type: 'geojson',
  data: polygonsGeoJSON
});

map.addLayer({
  id: 'polygons-fill',
  type: 'fill',
  source: 'polygons',
  paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': 0.5
  }
});

map.addLayer({
  id: 'polygons-outline',
  type: 'line',
  source: 'polygons',
  paint: {
    'line-color': '#fff',
    'line-width': 2
  }
});`,

  lines: `// MapLibre GL JS - Lines Layer
map.addSource('lines', {
  type: 'geojson',
  data: linesGeoJSON
});

map.addLayer({
  id: 'lines-layer',
  type: 'line',
  source: 'lines',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 4,
    'line-opacity': 0.8
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round'
  }
});`,

  heatmap: `// MapLibre GL JS - Heatmap Layer
map.addLayer({
  id: 'heatmap-layer',
  type: 'heatmap',
  source: 'points',
  paint: {
    'heatmap-weight': ['get', 'magnitude'],
    'heatmap-intensity': 1,
    'heatmap-radius': 30,
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'transparent',
      0.2, '#2ecc71',
      0.4, '#f1c40f',
      0.6, '#e67e22',
      0.8, '#e74c3c',
      1, '#9b59b6'
    ]
  }
});`,

  cluster: `// MapLibre GL JS - Clustering
map.addSource('points-clustered', {
  type: 'geojson',
  data: pointsGeoJSON,
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50
});

map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'points-clustered',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#e94560',
    'circle-radius': [
      'step', ['get', 'point_count'],
      20, 100, 30, 750, 40
    ]
  }
});`
};

export function initMap() {
  const center = getCenter();

  map = new maplibregl.Map({
    container: 'map-maplibre',
    style: {
      version: 8,
      sources: {
        'osm': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [{
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19
      }]
    },
    center: center,
    zoom: 11
  });

  popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.on('load', () => {
    addSources();
    addLayers();
    addInteractions();
  });

  return map;
}

function addSources() {
  // Points source (for regular points)
  map.addSource('points', {
    type: 'geojson',
    data: data.points
  });

  // Points source with clustering enabled
  map.addSource('points-clustered', {
    type: 'geojson',
    data: data.points,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // Polygons source
  map.addSource('polygons', {
    type: 'geojson',
    data: data.polygons
  });

  // Lines source
  map.addSource('lines', {
    type: 'geojson',
    data: data.lines
  });
}

function addLayers() {
  // Polygons fill layer
  map.addLayer({
    id: 'polygons-fill',
    type: 'fill',
    source: 'polygons',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.5
      ]
    }
  });

  // Polygons outline layer
  map.addLayer({
    id: 'polygons-outline',
    type: 'line',
    source: 'polygons',
    paint: {
      'line-color': '#ffffff',
      'line-width': 2
    }
  });

  // Lines layer
  map.addLayer({
    id: 'lines-layer',
    type: 'line',
    source: 'lines',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 4,
      'line-opacity': 0.8
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  });

  // Heatmap layer (hidden by default)
  map.addLayer({
    id: 'heatmap-layer',
    type: 'heatmap',
    source: 'points',
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'magnitude'], 1, 0, 10, 1],
      'heatmap-intensity': 1,
      'heatmap-radius': 30,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'transparent',
        0.2, '#2ecc71',
        0.4, '#f1c40f',
        0.6, '#e67e22',
        0.8, '#e74c3c',
        1, '#9b59b6'
      ]
    },
    layout: {
      visibility: 'none'
    }
  });

  // Cluster circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'points-clustered',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#2ecc71',
        100,
        '#f1c40f',
        500,
        '#e94560'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,
        100,
        30,
        500,
        40
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    },
    layout: {
      visibility: 'none'
    }
  });

  // Cluster count labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'points-clustered',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 14,
      visibility: 'none'
    },
    paint: {
      'text-color': '#fff'
    }
  });

  // Unclustered points (for cluster mode)
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'points-clustered',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#e94560',
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    },
    layout: {
      visibility: 'none'
    }
  });

  // Regular points layer
  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-color': '#e94560',
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });
}

function addInteractions() {
  let hoveredPolygonId = null;

  // Polygon hover effect
  map.on('mousemove', 'polygons-fill', (e) => {
    if (e.features.length > 0) {
      if (hoveredPolygonId !== null) {
        map.setFeatureState(
          { source: 'polygons', id: hoveredPolygonId },
          { hover: false }
        );
      }
      hoveredPolygonId = e.features[0].properties.id;
      map.setFeatureState(
        { source: 'polygons', id: hoveredPolygonId },
        { hover: true }
      );
    }
  });

  map.on('mouseleave', 'polygons-fill', () => {
    if (hoveredPolygonId !== null) {
      map.setFeatureState(
        { source: 'polygons', id: hoveredPolygonId },
        { hover: false }
      );
    }
    hoveredPolygonId = null;
  });

  // Point click popup
  map.on('click', 'points-layer', (e) => {
    const feature = e.features[0];
    const coords = feature.geometry.coordinates.slice();
    const props = feature.properties;

    popup
      .setLngLat(coords)
      .setHTML(`
        <strong>${props.name}</strong><br>
        Category: ${props.category}<br>
        Magnitude: ${props.magnitude.toFixed(1)}
      `)
      .addTo(map);
  });

  // Cluster click - zoom in
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource('points-clustered').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
      });
    });
  });

  // Polygon click popup
  map.on('click', 'polygons-fill', (e) => {
    const feature = e.features[0];
    const props = feature.properties;

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${props.name}</strong><br>
        Type: ${props.type}<br>
        Population: ${props.population.toLocaleString()}
      `)
      .addTo(map);
  });

  // Line click popup
  map.on('click', 'lines-layer', (e) => {
    const feature = e.features[0];
    const props = feature.properties;

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${props.name}</strong><br>
        Type: ${props.type}<br>
        Distance: ${props.distance} km
      `)
      .addTo(map);
  });

  // Cursor changes
  map.on('mouseenter', 'points-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'points-layer', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'polygons-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'polygons-fill', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'lines-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'lines-layer', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
}

export function setLayerVisibility(layerId, visible) {
  if (!map || !map.isStyleLoaded()) return;

  const visibility = visible ? 'visible' : 'none';

  switch (layerId) {
    case 'points':
      map.setLayoutProperty('points-layer', 'visibility', visibility);
      break;
    case 'polygons':
      map.setLayoutProperty('polygons-fill', 'visibility', visibility);
      map.setLayoutProperty('polygons-outline', 'visibility', visibility);
      break;
    case 'lines':
      map.setLayoutProperty('lines-layer', 'visibility', visibility);
      break;
    case 'heatmap':
      map.setLayoutProperty('heatmap-layer', 'visibility', visibility);
      break;
    case 'cluster':
      map.setLayoutProperty('clusters', 'visibility', visibility);
      map.setLayoutProperty('cluster-count', 'visibility', visibility);
      map.setLayoutProperty('unclustered-point', 'visibility', visibility);
      // Hide regular points when clustering is on
      if (visible) {
        map.setLayoutProperty('points-layer', 'visibility', 'none');
      }
      break;
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
  if (!map || !map.isStyleLoaded()) return;

  const source = map.getSource('points');
  const clusteredSource = map.getSource('points-clustered');

  if (source) {
    source.setData(animatedData);
  }
  if (clusteredSource) {
    clusteredSource.setData(animatedData);
  }
}
