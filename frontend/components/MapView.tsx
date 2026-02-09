import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { Trip } from '../types'; // Import the Trip type

// Dynamic import of mapbox-gl to improve initial bundle size
type MapboxGL = typeof import('mapbox-gl');
let mapboxgl: MapboxGL | null = null;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type?: 'driver' | 'default' | 'pickup' | 'dropoff' | 'request';
  rotation?: number;
}

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeGeometry?: any;
  trip?: Trip; // Added the trip property to the interface
  driverLocation?: { lat: number; lng: number; rotation: number } | null; // Added driverLocation property
}

const MapView: React.FC<MapViewProps> = ({ 
  center = [31.0335, -17.8252], zoom = 13, markers = [], routeGeometry, trip, driverLocation 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const driverMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  // Load mapbox-gl dynamically
  useEffect(() => {
    if (!mapboxgl) {
      import('mapbox-gl').then((module) => {
        mapboxgl = module.default || module;
        setMapboxLoaded(true);
      });
    } else {
      setMapboxLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxLoaded || !mapboxgl) return;
    mapboxgl.accessToken = process.env.MAPBOX_TOKEN || '';
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center, zoom, pitch: 45, antialias: true
    });

    map.current.on('load', () => {
      setIsLoaded(true);
      if (map.current) {
        map.current.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
        map.current.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#0056E0', 'line-width': 4, 'line-opacity': 0.8 } });
      }
    });

    return () => { map.current?.remove(); };
  }, [mapboxLoaded]);

  useEffect(() => {
    if (!isLoaded || !map.current || !routeGeometry || !mapboxgl) return;
    const source = map.current.getSource('route') as import('mapbox-gl').GeoJSONSource;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: routeGeometry });
  }, [routeGeometry, isLoaded]);

  // Add/update driver marker when driverLocation changes
  useEffect(() => {
    if (!isLoaded || !map.current || !driverLocation || !mapboxgl) {
      // Remove driver marker if location is null
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    // Create or update driver marker
    if (!driverMarkerRef.current) {
      // Create a custom driver marker element
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0iIzAwNTZFMCIvPjxwYXRoIGQ9Ik0yMCAxMkMxNi42ODYzIDEyIDEzLjUgMTQuNSAxMy41IDE4QzEzLjUgMjEuNSAyMCAyOCAyMCAyOEMyMCAyOCAyNi41IDIxLjUgMjYuNSAxOEMyNi41IDE0LjUgMjMuMzEzNyAxMiAyMCAxMloiIGZpbGw9IndoaXRlIi8+PC9zdmc+)';
      el.style.backgroundSize = 'contain';
      el.style.transform = `rotate(${driverLocation.rotation || 0}deg)`;
      
      driverMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    } else {
      // Update existing marker position
      driverMarkerRef.current.setLngLat([driverLocation.lng, driverLocation.lat]);
      
      // Update rotation if provided
      const el = driverMarkerRef.current.getElement();
      if (el && driverLocation.rotation !== undefined) {
        el.style.transform = `rotate(${driverLocation.rotation}deg)`;
      }
    }

    // Auto-fit map bounds to show pickup, dropoff, and driver
    if (trip && trip.pickup && trip.dropoff && mapboxgl) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([trip.pickup.lng, trip.pickup.lat]);
      bounds.extend([trip.dropoff.lng, trip.dropoff.lat]);
      bounds.extend([driverLocation.lng, driverLocation.lat]);
      
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15
      });
    }
  }, [driverLocation, isLoaded, trip]);

  return <div ref={mapContainer} className="w-full h-full" />;
};

export default React.memo(MapView);