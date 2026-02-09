import mapboxgl from 'mapbox-gl';

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

// Zimbabwe bounds for geocoding queries
const ZIMBABWE_BOUNDS = {
  minLng: 25.0,
  maxLng: 33.5,
  minLat: -22.5,
  maxLat: -15.5
};

// Token validation constants
const MAPBOX_TOKEN_MIN_LENGTH = 50;
const MAPBOX_TOKEN_PREFIX = 'pk.';

// Validate Mapbox token format
const isValidTokenFormat = (token: string): boolean => {
  return token.length >= MAPBOX_TOKEN_MIN_LENGTH && token.startsWith(MAPBOX_TOKEN_PREFIX);
};

interface CachedResult<T> {
  data: T;
  timestamp: number;
}

const getMapboxToken = () => {
  const token = process.env.MAPBOX_TOKEN || '';
  
  if (!token) {
    console.error('[Mapbox] MAPBOX_TOKEN environment variable is not set. Please configure it in your .env file or environment variables.');
  } else if (!isValidTokenFormat(token)) {
    console.warn(`[Mapbox] MAPBOX_TOKEN may be invalid. Mapbox tokens typically start with "${MAPBOX_TOKEN_PREFIX}" and are longer than ${MAPBOX_TOKEN_MIN_LENGTH} characters.`);
  }
  
  return token;
};

const BASE_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const BASE_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

export interface GeoResult {
  address: string;
  lat: number;
  lng: number;
}

const geocodeCache = new Map<string, CachedResult<GeoResult[]>>();

// Helper to check if cached data is still valid
const isCacheValid = <T>(cached: CachedResult<T> | undefined): boolean => {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL;
};

// Helper to construct geocoding URL
const buildGeocodingURL = (query: string, token: string): string => {
  const bbox = `${ZIMBABWE_BOUNDS.minLng},${ZIMBABWE_BOUNDS.minLat},${ZIMBABWE_BOUNDS.maxLng},${ZIMBABWE_BOUNDS.maxLat}`;
  return `${BASE_GEOCODING_URL}/${encodeURIComponent(query)}.json?access_token=${token}&country=zw&bbox=${bbox}&limit=3`;
};

// Helper to construct reverse geocoding URL
const buildReverseGeocodingURL = (lng: number, lat: number, token: string): string => {
  return `${BASE_GEOCODING_URL}/${lng},${lat}.json?access_token=${token}&limit=1`;
};

// Helper to construct directions URL
const buildDirectionsURL = (startLng: number, startLat: number, endLng: number, endLat: number, token: string): string => {
  return `${BASE_DIRECTIONS_URL}/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&access_token=${token}`;
};

// Validate that coordinates are within Zimbabwe bounds
const isWithinZimbabweBounds = (lat: number, lng: number): boolean => {
  return lng >= ZIMBABWE_BOUNDS.minLng && 
         lng <= ZIMBABWE_BOUNDS.maxLng && 
         lat >= ZIMBABWE_BOUNDS.minLat && 
         lat <= ZIMBABWE_BOUNDS.maxLat;
};

// Validate coordinate pair object
const isValidCoordinatePair = (coord: { lat: number, lng: number } | null | undefined): boolean => {
  if (!coord) return false;
  return typeof coord.lat === 'number' && typeof coord.lng === 'number' &&
         !isNaN(coord.lat) && !isNaN(coord.lng);
};

export const mapboxService = {
  async searchAddress(query: string): Promise<GeoResult[]> {
    // Validate input
    if (!query || typeof query !== 'string') {
      console.warn('[Mapbox] searchAddress called with invalid query');
      return [];
    }
    
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      return [];
    }
    
    const token = getMapboxToken();
    if (!token) {
      console.error('[Mapbox] Cannot perform address search: MAPBOX_TOKEN is not configured');
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Mapbox] Returning empty results in development mode');
        return [];
      }
      throw new Error('Map service is currently unavailable. Please try again later.');
    }
    
    const cacheKey = trimmedQuery.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.data;
    }

    try {
      const url = buildGeocodingURL(trimmedQuery, token);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          console.error('[Mapbox] Authentication failed: Invalid or expired token');
          throw new Error('Map service authentication failed. Please contact support.');
        } else if (res.status === 429) {
          console.warn('[Mapbox] Rate limit exceeded');
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (res.status >= 500) {
          console.error(`[Mapbox] Server error: ${res.status}`);
          throw new Error('Map service is temporarily unavailable. Please try again later.');
        } else if (res.status === 403) {
          console.error('[Mapbox] Access forbidden: Token may lack required permissions');
          throw new Error('Map service access denied. Please contact support.');
        } else {
          console.error(`[Mapbox] Geocoding request failed with status: ${res.status}`);
          throw new Error(`Unable to search address (Error ${res.status})`);
        }
      }
      
      const data = await res.json();

      if (!data.features || !Array.isArray(data.features)) {
        console.warn('[Mapbox] Unexpected API response format');
        return [];
      }

      const results = data.features.map((f: any) => ({
        address: f.place_name,
        lng: f.center[0],
        lat: f.center[1]
      }));

      geocodeCache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (e) {
      console.error("[Mapbox Geocoding] Error:", e);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Address search timed out. Please check your connection and try again.');
      }
      if (e instanceof TypeError && e.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw e;
    }
  },

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      console.warn('[Mapbox] reverseGeocode called with invalid coordinates');
      return "Invalid Location";
    }
    
    if (!isWithinZimbabweBounds(lat, lng)) {
      console.warn(`[Mapbox] Coordinates (${lat}, ${lng}) are outside Zimbabwe bounds`);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    const token = getMapboxToken();
    if (!token) {
      console.warn('[Mapbox] No API token for reverse geocoding, falling back to coordinates');
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    try {
      const url = buildReverseGeocodingURL(lng, lat, token);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          console.error('[Mapbox] Reverse geocoding authentication failed');
        } else if (res.status === 429) {
          console.warn('[Mapbox] Rate limit exceeded for reverse geocoding');
        } else if (res.status >= 500) {
          console.error(`[Mapbox] Server error during reverse geocoding: ${res.status}`);
        } else {
          console.error(`[Mapbox] Reverse geocoding failed with status: ${res.status}`);
        }
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      
      const data = await res.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (e) {
      console.error("[Mapbox Reverse Geocoding] Error:", e);
      if (e instanceof Error && e.name === 'AbortError') {
        console.warn('[Mapbox] Reverse geocoding timed out');
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  },

  async getRoute(start: { lat: number, lng: number }, end: { lat: number, lng: number }) {
    // Validate coordinates
    if (!isValidCoordinatePair(start) || !isValidCoordinatePair(end)) {
      console.error('[Mapbox] getRoute called with invalid coordinates');
      throw new Error('Invalid route coordinates provided');
    }
    
    if (!isWithinZimbabweBounds(start.lat, start.lng)) {
      console.warn(`[Mapbox] Start location (${start.lat}, ${start.lng}) is outside Zimbabwe bounds`);
    }
    
    if (!isWithinZimbabweBounds(end.lat, end.lng)) {
      console.warn(`[Mapbox] End location (${end.lat}, ${end.lng}) is outside Zimbabwe bounds`);
    }
    
    const token = getMapboxToken();
    if (!token) {
      console.error('[Mapbox] Cannot calculate route: MAPBOX_TOKEN is not configured');
      throw new Error('Map service is currently unavailable. Please try again later.');
    }

    try {
      const url = buildDirectionsURL(start.lng, start.lat, end.lng, end.lat, token);

      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000), // 15s timeout for routing
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          console.error('[Mapbox] Route calculation authentication failed');
          throw new Error('Map service authentication failed. Please contact support.');
        } else if (res.status === 422) {
          console.error('[Mapbox] Invalid route coordinates or unreachable destination');
          throw new Error('Unable to find a route between these locations. Please verify the addresses.');
        } else if (res.status === 429) {
          console.warn('[Mapbox] Rate limit exceeded for routing');
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (res.status >= 500) {
          console.error(`[Mapbox] Server error during routing: ${res.status}`);
          throw new Error('Map service is temporarily unavailable. Please try again later.');
        } else {
          console.error(`[Mapbox] Route calculation failed with status: ${res.status}`);
          throw new Error('Unable to calculate route. Please try again.');
        }
      }
      
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn('[Mapbox] No route found between specified locations');
        throw new Error('No route found between these locations. They may be unreachable.');
      }

      const route = data.routes[0];
      
      if (!route.geometry || !route.duration || !route.distance) {
        console.error('[Mapbox] Incomplete route data received from API');
        throw new Error('Received incomplete route information. Please try again.');
      }
      
      return {
        geometry: route.geometry,
        duration: Math.round(route.duration / 60),
        distance: (route.distance / 1000).toFixed(1)
      };
    } catch (e) {
      console.error("[Mapbox Routing] Error:", e);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Route calculation timed out. Please check your connection and try again.');
      }
      if (e instanceof TypeError && e.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw e;
    }
  }
};