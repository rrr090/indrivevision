import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Area, AreaChart
} from 'recharts';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const App = () => {
  const [cleanData, setCleanData] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [bottlenecks, setBottlenecks] = useState([]);
  const [safetyScore, setSafetyScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('upload');
  const [realTimeMode, setRealTimeMode] = useState(false);
  const [showAllAnomalies, setShowAllAnomalies] = useState(false);

  const processData = (raw) => {
    const cleaned = raw
      .map(row => ({
        randomized_id: row.randomized_id,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        alt: parseFloat(row.alt) || 0,
        spd: parseFloat(row.spd) * 3.6,
        azm: parseFloat(row.azm) || 0
      }))
      .filter(row =>
        !isNaN(row.lat) &&
        !isNaN(row.lng) &&
        !isNaN(row.alt) &&
        !isNaN(row.spd) &&
        !isNaN(row.azm) &&
        row.spd >= 0 && row.spd <= 200
      );

    if (cleaned.length === 0) {
      setError('No valid data points after cleaning. Check data format.');
      return;
    }

    setCleanData(cleaned);

    const clusterData = [];
    const visited = new Set();
    cleaned.forEach((point, i) => {
      if (visited.has(i)) return;
      const cluster = [point];
      visited.add(i);
      cleaned.forEach((other, j) => {
        if (i !== j && !visited.has(j)) {
          const dist = Math.sqrt(Math.pow(point.lat - other.lat, 2) + Math.pow(point.lng - other.lng, 2));
          if (dist < 0.005) {
            cluster.push(other);
            visited.add(j);
          }
        }
      });
      if (cluster.length > 5) clusterData.push(cluster);
    });
    setClusters(clusterData);

    const clusterMetrics = clusterData.map((cluster, id) => ({
      id: `Cluster ${id + 1}`,
      points: cluster.length,
      avgSpeed: Math.round(cluster.reduce((sum, p) => sum + p.spd, 0) / cluster.length),
      density: Math.round((cluster.length / cleaned.length) * 100)
    }));
    setMetrics(clusterMetrics);

    const meanSpd = cleaned.reduce((sum, r) => sum + r.spd, 0) / cleaned.length;
    const variance = cleaned.reduce((sum, r) => sum + Math.pow(r.spd - meanSpd, 2), 0) / cleaned.length;
    const stdDev = Math.sqrt(variance);
    setAnomalies(cleaned.filter(r => r.spd > meanSpd + 2 * stdDev));

    setBottlenecks(cleaned.filter(r => r.spd < 10));

    const safetyMetric = 100 - (anomalies.length / cleaned.length * 100);
    setSafetyScore(Math.round(safetyMetric > 0 ? safetyMetric : 0));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      setError('Invalid file type. Please upload a JSON file.');
      return;
    }

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!Array.isArray(jsonData)) {
          throw new Error('JSON file must contain an array of data points.');
        }
        processData(jsonData);
        setActiveView('dashboard');
      } catch (err) {
        setError(`Error parsing JSON: ${err.message}. Please ensure the file is a valid JSON array.`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setLoading(false);
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (realTimeMode && cleanData.length > 0) {
      const interval = setInterval(() => {
        const lastPoint = cleanData[cleanData.length - 1];
        const newPoint = {
          randomized_id: `rt_${Date.now()}`,
          lat: lastPoint.lat + (Math.random() - 0.5) * 0.001,
          lng: lastPoint.lng + (Math.random() - 0.5) * 0.001,
          alt: lastPoint.alt + (Math.random() - 0.5) * 10,
          spd: Math.random() * 50 + 10,
          azm: Math.random() * 360
        };
        setCleanData(prev => [...prev.slice(-999), newPoint]);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [realTimeMode, cleanData]);

  if (loading) {
    return React.createElement(
      'div',
      { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('h2', null, 'Loading Geotrack Analyzer'),
      React.createElement('p', null, 'Processing geotrack data...')
    );
  }

  if (error) return React.createElement('div', { className: 'error' }, error);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return React.createElement(
    'div',
    { className: 'app-container' },
    activeView === 'upload'
      ? React.createElement(
          'div',
          { className: 'upload-screen' },
          React.createElement(
            'div',
            { className: 'upload-box' },
            React.createElement(
              'div',
              { className: 'logo-section' },
              React.createElement(
                'div',
                { className: 'logo' },
                React.createElement('span', { className: 'logo-text' }, 'inDrive'),
                React.createElement('span', { className: 'logo-tag' }, 'Geotrack Analyzer')
              )
            ),
            React.createElement(
              'div',
              { className: 'shit' },
              React.createElement('h2', null, 'Загрузите файл с данными'),
              React.createElement('p', null, 'Для начала работы, пожалуйста, выберите файл в формате JSON.'),
              React.createElement(
                'div',
                { className: 'file-input-wrapper' },
                React.createElement('input', {
                  type: 'file',
                  accept: '.json',
                  onChange: handleFileUpload,
                  className: 'file-input',
                }),
                React.createElement('button', { className: 'upload-btn' }, 'Выбрать файл')
              )
            ),
            error && React.createElement('div', { className: 'error-message' }, error)
          )
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'header',
            { className: 'app-header' },
            React.createElement(
              'div',
              { className: 'header-content' },
              React.createElement(
                'div',
                { className: 'logo-section' },
                React.createElement(
                  'div',
                  { className: 'logo' },
                  React.createElement('span', { className: 'logo-text' }, 'inDrive'),
                  React.createElement('span', { className: 'logo-tag' }, 'Geotrack Analyzer')
                )
              ),
              React.createElement(
                'nav',
                { className: 'nav-menu' },
                React.createElement(
                  'button',
                  {
                    className: `nav-btn ${activeView === 'dashboard' ? 'active' : ''}`,
                    onClick: () => setActiveView('dashboard'),
                  },
                  React.createElement('span', { className: 'nav-icon' }, '📊'),
                  ' Dashboard'
                ),
                React.createElement(
                  'button',
                  {
                    className: `nav-btn ${activeView === 'heatmap' ? 'active' : ''}`,
                    onClick: () => setActiveView('heatmap'),
                  },
                  React.createElement('span', { className: 'nav-icon' }, '🗺️'),
                  ' Heatmap'
                ),
                React.createElement(
                  'button',
                  {
                    className: `nav-btn ${activeView === 'safety' ? 'active' : ''}`,
                    onClick: () => setActiveView('safety'),
                  },
                  React.createElement('span', { className: 'nav-icon' }, '🛡️'),
                  ' Safety'
                )
              ),
              React.createElement(
                'div',
                { className: 'header-actions' },
                React.createElement(
                  'button',
                  {
                    className: `realtime-btn ${realTimeMode ? 'active' : ''}`,
                    onClick: () => setRealTimeMode(!realTimeMode),
                  },
                  realTimeMode ? '🔴 Live' : '⏸️ Static'
                )
              )
            )
          ),
          React.createElement(
            'main',
            { className: 'main-content' },
            activeView === 'dashboard' &&
              React.createElement(
                'div',
                { className: 'dashboard-view' },
                React.createElement('p', { className: 'explanation' }, 'The dashboard shows key metrics from the geotrack data. \'Active Trips\' is the number of data points (each point represents a location update during a trip). \'Avg Speed\' is the average speed across all points in km/h. \'Safety Score\' is the percentage of points with normal speeds (not anomalies).'),
                React.createElement(
                  'div',
                  { className: 'kpi-grid' },
                  React.createElement(
                    'div',
                    { className: 'kpi-card gradient-1' },
                    React.createElement('div', { className: 'kpi-icon' }, '🚗'),
                    React.createElement(
                      'div',
                      { className: 'kpi-content' },
                      React.createElement('h3', null, 'Active Trips'),
                      React.createElement('div', { className: 'kpi-value' }, cleanData.length.toLocaleString()),
                      React.createElement('div', { className: 'kpi-change' }, 'Number of geotrack points')
                    )
                  ),
                  React.createElement(
                    'div',
                    { className: 'kpi-card gradient-2' },
                    React.createElement('div', { className: 'kpi-icon' }, '⚡'),
                    React.createElement(
                      'div',
                      { className: 'kpi-content' },
                      React.createElement('h3', null, 'Avg Speed'),
                      React.createElement(
                        'div',
                        { className: 'kpi-value' },
                        cleanData.length > 0 ? `${Math.round(cleanData.reduce((s, d) => s + d.spd, 0) / cleanData.length)} km/h` : '0 km/h'
                      ),
                      React.createElement('div', { className: 'kpi-change' }, 'Average across all points')
                    )
                  ),
                  React.createElement(
                    'div',
                    { className: 'kpi-card gradient-3' },
                    React.createElement('div', { className: 'kpi-icon' }, '🛡️'),
                    React.createElement(
                      'div',
                      { className: 'kpi-content' },
                      React.createElement('h3', null, 'Safety Score'),
                      React.createElement('div', { className: 'kpi-value' }, `${safetyScore}%`),
                      React.createElement('div', { className: 'kpi-change' }, `${anomalies.length} anomalies detected`)
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'charts-grid' },
                  React.createElement(
                    'div',
                    { className: 'chart-card' },
                    React.createElement('h3', null, 'Cluster Density'),
                    React.createElement('p', { className: 'explanation' }, 'This bar chart shows the density of each cluster as a percentage of total points. Higher density means more activity in that area.'),
                    React.createElement(
                      ResponsiveContainer,
                      { width: '100%', height: 300 },
                      React.createElement(
                        BarChart,
                        { data: metrics },
                        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#e2e8f0' }),
                        React.createElement(XAxis, { dataKey: 'id', stroke: '#64748b' }),
                        React.createElement(YAxis, { stroke: '#64748b' }),
                        React.createElement(RechartsTooltip, { contentStyle: { backgroundColor: '#ffffff', border: 'none' } }),
                        React.createElement(Bar, { dataKey: 'density', fill: '#00C49F' })
                      )
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'insights-section' },
                  React.createElement('h2', null, 'Key Insights'),
                  React.createElement(
                    'div',
                    { className: 'insights-grid' },
                    React.createElement(
                      'div',
                      { className: 'insight-card' },
                      React.createElement('div', { className: 'insight-icon' }, '🗺️'),
                      React.createElement('h4', null, 'High-Density Areas'),
                      React.createElement('p', null, 'Clusters with high point counts indicate areas of high activity or demand based on location density.'),
                      React.createElement(
                        'div',
                        { className: 'insight-action', onClick: () => setActiveView('heatmap') },
                        'Explore Map →'
                      )
                    ),
                    React.createElement(
                      'div',
                      { className: 'insight-card' },
                      React.createElement('div', { className: 'insight-icon' }, '⚠️'),
                      React.createElement('h4', null, 'Bottleneck Zones'),
                      React.createElement('p', null, `${bottlenecks.length} points with speeds below 10 km/h, indicating potential slow-moving or congested areas.`),
                      React.createElement(
                        'div',
                        { className: 'insight-action', onClick: () => setActiveView('safety') },
                        'View Details →'
                      )
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'social-links' },
                  React.createElement('p', null, 'Follow inDrive:'),
                  React.createElement('a', { href: 'https://twitter.com/inDrive', target: '_blank', rel: 'noopener noreferrer' }, 'Twitter'),
                  ' | ',
                  React.createElement('a', { href: 'https://facebook.com/inDrive', target: '_blank', rel: 'noopener noreferrer' }, 'Facebook'),
                  ' | ',
                  React.createElement('a', { href: 'https://instagram.com/inDrive', target: '_blank', rel: 'noopener noreferrer' }, 'Instagram')
                )
              ),
            activeView === 'heatmap' &&
              React.createElement(
                'div',
                { className: 'map-view' },
                React.createElement(
                  'div',
                  { className: 'map-controls' },
                  React.createElement('h2', null, 'Demand Heatmap')
                ),
                React.createElement('p', { className: 'explanation' }, 'The heatmap shows density of geotrack points. Red areas have high concentration of points (high demand/activity). Blue circles represent clusters of close points. Hover on clusters for details.'),
                React.createElement(
                  'div',
                  { className: 'map-container' },
                  React.createElement(
                    MapContainer,
                    {
                      center: cleanData.length > 0 ? [cleanData[0].lat, cleanData[0].lng] : [51.1, 71.4],
                      zoom: 12,
                      style: { height: '600px', width: '100%' },
                    },
                    React.createElement(TileLayer, {
                      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    }),
                    React.createElement(HeatmapLayer, { data: cleanData }),
                    clusters.map((cluster, i) =>
                      React.createElement(
                        CircleMarker,
                        {
                          key: i,
                          center: [
                            cluster.reduce((s, p) => s + p.lat, 0) / cluster.length,
                            cluster.reduce((s, p) => s + p.lng, 0) / cluster.length,
                          ],
                          radius: Math.min(cluster.length / 20, 10),
                          fillColor: COLORS[i % COLORS.length],
                          fillOpacity: 0.6,
                          stroke: true,
                          weight: 2,
                          color: '#ffffff',
                        },
                        React.createElement(
                          Popup,
                          null,
                          React.createElement(
                            'div',
                            { className: 'popup-content' },
                            React.createElement('h4', null, `Cluster ${i + 1}`),
                            React.createElement('p', null, `Points: ${cluster.length} (group of close locations)`),
                            React.createElement(
                              'p',
                              null,
                              `Avg Speed: ${Math.round(cluster.reduce((s, p) => s + p.spd, 0) / cluster.length)} km/h`
                            )
                          )
                        )
                      )
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'map-legend' },
                  React.createElement('h4', null, 'Legend'),
                  React.createElement(
                    'div',
                    { className: 'legend-item' },
                    React.createElement('span', { className: 'legend-color', style: { background: COLORS[0], width: '8px', height: '8px' } }),
                    React.createElement('span', null, 'High Density Cluster')
                  ),
                  React.createElement(
                    'div',
                    { className: 'legend-item' },
                    React.createElement('span', { className: 'legend-color', style: { background: COLORS[1], width: '8px', height: '8px' } }),
                    React.createElement('span', null, 'Medium Density Cluster')
                  ),
                  React.createElement(
                    'div',
                    { className: 'legend-item' },
                    React.createElement('span', { className: 'legend-color', style: { background: COLORS[2], width: '8px', height: '8px' } }),
                    React.createElement('span', null, 'Low Density Cluster')
                  )
                )
              ),
            activeView === 'safety' &&
              React.createElement(
                'div',
                { className: 'safety-view' },
                React.createElement('h2', null, 'Safety Monitoring'),
                React.createElement('p', { className: 'explanation' }, 'Safety Score is the percentage of points with normal speeds (within 2 standard deviations of average). Anomalies are points with unusually high speeds. Bottlenecks are points with speeds below 10 km/h.'),
                React.createElement(
                  'div',
                  { className: 'safety-score-display' },
                  React.createElement(
                    'div',
                    { className: 'score-circle' },
                    React.createElement(
                      'svg',
                      { width: '200', height: '200' },
                      React.createElement('circle', { cx: '100', cy: '100', r: '90', fill: 'none', stroke: '#e2e8f0', strokeWidth: '10' }),
                      React.createElement('circle', {
                        cx: '100',
                        cy: '100',
                        r: '90',
                        fill: 'none',
                        stroke: safetyScore > 50 ? '#00C49F' : '#FF8042',
                        strokeWidth: '10',
                        strokeDasharray: `${safetyScore * 5.65} 565`,
                        transform: 'rotate(-90 100 100)',
                      })
                    ),
                    React.createElement(
                      'div',
                      { className: 'score-text' },
                      React.createElement('span', { className: 'score-value' }, `${safetyScore}%`),
                      React.createElement('span', { className: 'score-label' }, 'Safety Score')
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'safety-metrics' },
                  React.createElement(
                    'div',
                    { className: 'safety-card' },
                    React.createElement('h4', null, 'Speed Anomalies'),
                    React.createElement('div', { className: 'violation-count' }, anomalies.length),
                    React.createElement('p', null, 'Points with unusually high speeds')
                  ),
                  React.createElement(
                    'div',
                    { className: 'safety-card' },
                    React.createElement('h4', null, 'Bottlenecks'),
                    React.createElement('div', { className: 'violation-count' }, bottlenecks.length),
                    React.createElement('p', null, 'Points with low speeds (10 km/h)')
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'incident-list' },
                  React.createElement('h3', null, 'All Anomalies'),
                  React.createElement('p', { className: 'explanation' }, 'List of detected speed anomalies (high speeds). Each entry shows the point ID and speed in km/h. Showing first 10; click \'Show All\' to see complete list.'),
                  React.createElement(
                    'div',
                    { className: 'incident-table' },
                    anomalies
                      .slice(0, showAllAnomalies ? anomalies.length : 10)
                      .map((incident, i) =>
                        React.createElement(
                          'div',
                          { key: i, className: 'incident-row' },
                          React.createElement('span', { className: 'incident-type' }, '⚡ Speed Anomaly'),
                          React.createElement('span', { className: 'incident-speed' }, `${Math.round(incident.spd)} km/h`)
                        )
                      )
                  ),
                  !showAllAnomalies &&
                    anomalies.length > 10 &&
                    React.createElement('button', { className: 'show-more-btn', onClick: () => setShowAllAnomalies(true) }, 'Show All Anomalies')
                )
              )
          )
        )
  );
};

const HeatmapLayer = ({ data }) => {
  const map = useMap();
  useEffect(() => {
    if (!data || data.length === 0) return;
    const heat = L.heatLayer(
      data.map(d => [d.lat, d.lng, d.spd / 100]),
      { radius: 25, blur: 15, maxZoom: 17 }
    );
    heat.addTo(map);
    return () => map.removeLayer(heat);
  }, [data, map]);
  return null;
};

export default App;