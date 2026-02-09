// Cleaned / consolidated Xano API client for RideIn-Zimbabwe frontend
import { Trip, TripStatus, User, UserRole } from '../types';
import { ablyService } from './ably';

// Logger utility - silent in production
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
  error: (...args: any[]) => isDev && console.error(...args),
};

const PROXY_BASE = '/.netlify/functions/xano';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours (matches backend)
const TOKEN_REFRESH_THRESHOLD = 3600000; // 1 hour before expiry in milliseconds

// Polling intervals for active trip subscription
const ACTIVE_TRIP_POLL_INTERVAL = 12000; // 12 seconds

// Cache TTL constants
const CACHE_TTL = {
  user: 60_000,     // 1 minute
  trips: 10_000,    // 10 seconds
  static: 300_000,  // 5 minutes
};

// ============================================================================
// API Error Class
// ============================================================================
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError(): boolean { return this.statusCode === 401; }
  get isValidationError(): boolean { return this.statusCode === 400 || this.statusCode === 422; }
  get isServerError(): boolean { return this.statusCode >= 500; }
  get isNetworkError(): boolean { return this.statusCode === 0; }
  get isForbiddenError(): boolean { return this.statusCode === 403; }
}

// ============================================================================
// Input Validation Helper
// ============================================================================
function safeParseInt(value: string | number, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new ApiError(`Invalid ${fieldName}: "${value}" is not a valid number`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
}

// ============================================================================
// Typed Request/Response Interfaces
// ============================================================================
export interface SignupRequest {
  name: string;
  phone: string;
  role: UserRole;
  city: string;
  password: string;
  age?: number;
  gender?: string;
  maritalStatus?: string;
  religion?: string;
  personality?: 'Talkative' | 'Quiet';
  vehicle?: { type: string; category: string; photos: string[]; };
}

export interface AuthResponse {
  authToken: string;
  user: User;
  tokenExpiry?: number; // Token expiry duration in seconds (e.g., 86400 for 24 hours)
  refreshToken?: string; // For future implementation
}

export interface CreateTripRequest {
  riderId: string;
  type: string;
  category: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  proposed_price: number;
  distance_km: number;
  duration: string | number;
  isGuestBooking?: boolean;
  guestName?: string;
  guestPhone?: string;
  scheduledTime?: string | null;
  itemDescription?: string;
  requiresAssistance?: boolean;
  cargoPhotos?: string[];
}

export interface SubmitBidRequest {
  tripId: string;
  offerPrice: number;
  driver: User;
}

export interface SubmitReviewRequest {
  tripId: string;
  rating: number;
  tags: string[];
  comment: string;
  isFavorite: boolean;
}

// ============================================================================
// Request Cache
// ============================================================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RequestCache {
  private static readonly MAX_ENTRIES = 100;
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100; // Limit cache size to prevent memory leak

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= RequestCache.MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  invalidate(pattern?: string): void {
    if (!pattern) { this.store.clear(); return; }
    for (const key of Array.from(this.store.keys())) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }
}

// ============================================================================
// Sanitize Response
// ============================================================================
const FORBIDDEN_KEYS = new Set(['email', 'mail', 'user_email', 'reference_email', 'e-mail']);
function sanitizeResponse<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeResponse) as unknown as T;

  const clean: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const k = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(k) || k.includes('reference-email')) continue;
    
    let value = (obj as Record<string, unknown>)[key];
    
    // Normalize id field to string
    if (key === 'id' && typeof value === 'number') {
      value = value.toString();
    }
    
    clean[key] = sanitizeResponse(value);
  }
  return clean as T;
}

// ============================================================================
// Normalize Response - Convert snake_case to camelCase and ensure ID is string
// ============================================================================
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeResponse<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normalizeResponse) as unknown as T;

  const normalized: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    
    const value = (obj as Record<string, unknown>)[key];
    const camelKey = toCamelCase(key);
    
    // Normalize IDs to always be strings (handle null/undefined but allow 0)
    if (camelKey === 'id' || camelKey.endsWith('Id')) {
      normalized[camelKey] = (value !== null && value !== undefined) ? String(value) : value;
    } else {
      normalized[camelKey] = normalizeResponse(value);
    }
  }
  return normalized as T;
}

// ============================================================================
// Normalize User Response (snake_case to camelCase)
// ============================================================================
function normalizeUser(user: any): User {
  if (!user) return user;
  
  const normalized: any = { ...user };
  
  // Map snake_case fields to camelCase
  const fieldMapping: Record<string, string> = {
    'is_online': 'isOnline',
    'trips_count': 'tripsCount',
    'marital_status': 'maritalStatus',
    'years_experience': 'yearsExperience',
    'service_areas': 'serviceAreas',
    // These fields intentionally keep their snake_case names for backend compatibility
    'driver_profile_exists': 'driver_profile_exists',
    'driver_verified': 'driver_verified',
    'driver_approved': 'driver_approved',
    'driver_status': 'driver_status',
    'force_rider_mode': 'force_rider_mode',
    'account_status': 'account_status',
  };
  
  for (const [snakeKey, camelKey] of Object.entries(fieldMapping)) {
    if (snakeKey in normalized) {
      normalized[camelKey] = normalized[snakeKey];
      // Only delete if we actually changed the key name
      if (snakeKey !== camelKey) {
        delete normalized[snakeKey];
      }
    }
  }
  
  return normalized as User;
}

// ============================================================================
// Normalize Trip Response (snake_case to camelCase and parse numeric fields)
// ============================================================================
function normalizeTrip(trip: any): Trip {
  if (!trip) return trip;
  
  const normalized: any = { ...trip };
  
  // Parse numeric text fields to actual numbers
  if (normalized.distance_km !== undefined && normalized.distance_km !== null) {
    normalized.distance_km = typeof normalized.distance_km === 'string' 
      ? parseFloat(normalized.distance_km) 
      : normalized.distance_km;
  }
  
  if (normalized.duration_mins !== undefined && normalized.duration_mins !== null) {
    normalized.duration_mins = typeof normalized.duration_mins === 'string'
      ? parseInt(normalized.duration_mins, 10)
      : normalized.duration_mins;
  }
  
  if (normalized.proposed_price !== undefined && normalized.proposed_price !== null) {
    normalized.proposed_price = typeof normalized.proposed_price === 'string'
      ? parseFloat(normalized.proposed_price)
      : normalized.proposed_price;
  }
  
  if (normalized.final_price !== undefined && normalized.final_price !== null) {
    normalized.final_price = typeof normalized.final_price === 'string'
      ? parseFloat(normalized.final_price)
      : normalized.final_price;
  }
  
  // Ensure bids array always exists
  if (!normalized.bids) {
    normalized.bids = [];
  }
  
  // Parse offer_price in bids if present
  if (Array.isArray(normalized.bids)) {
    normalized.bids = normalized.bids.map((bid: any) => {
      const normalizedBid = { ...bid };
      if (normalizedBid.offer_price !== undefined && normalizedBid.offer_price !== null) {
        normalizedBid.offer_price = typeof normalizedBid.offer_price === 'string'
          ? parseFloat(normalizedBid.offer_price)
          : normalizedBid.offer_price;
      }
      return normalizedBid;
    });
  }
  
  return normalized as Trip;
}

// ============================================================================
// Utilities (sleep, status messages, retry heuristics)
// ============================================================================
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  if (error.name === 'TypeError' || (typeof error.message === 'string' && error.message.includes('Failed to fetch'))) return true;
  if (error.name === 'AbortError' || (typeof error.message === 'string' && error.message.includes('timeout'))) return true;
  if (typeof error.status === 'number' && error.status >= 500 && error.status < 600) return true;
  if (error.status === 429) return true;
  return false;
}

function getStatusMessage(status: number): string {
  switch (status) {
    case 400: return 'Invalid request. Please check your input.';
    case 403: return 'Access denied. You don\'t have permission for this action.';
    case 404: return 'Resource not found.';
    case 408: return 'Request timeout. Please try again.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 500: return 'Server error. Please try again later.';
    case 502:
    case 503: return 'Service temporarily unavailable. Please try again.';
    case 504: return 'Gateway timeout. Please check your connection and try again.';
    default: return `An error occurred (${status}). Please try again.`;
  }
}

// ============================================================================
// XanoApiClient (single, consistent implementation)
// ============================================================================
class XanoApiClient {
  private cache = new RequestCache();
  private pendingRequests = new Map<string, Promise<unknown>>();
  private healthStatus = new Map<string, { 
    status: 'healthy' | 'degraded' | 'down'; 
    lastChecked: number; 
    responseTime?: number;
  }>();
  private activeTokens = new Set<string>(); // Track active tokens for session invalidation

  async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown,
    signal?: AbortSignal,
    options: { retries?: number; timeout?: number } = {}
  ): Promise<T> {
    const isAuthMutation = method === 'POST' && endpoint.startsWith('/auth/');
    const maxRetries = isAuthMutation ? 0 : (options.retries ?? MAX_RETRIES);
    const timeout = options.timeout ?? REQUEST_TIMEOUT;
    const token = localStorage.getItem('ridein_auth_token');
    const url = `${PROXY_BASE}${endpoint}`;
    const requestKey = `${method}:${endpoint}`;

    // Deduplicate GET requests
    if (method === 'GET' && this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey) as Promise<T>;
    }

    const doRequest = (async (): Promise<T> => {
      let lastError: any;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: signal || controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.status === 401) {
            const isAuthEndpoint = endpoint.startsWith('/auth/');
            const data = await response.json().catch(() => ({ message: 'Unauthorized' }));
            
            if (!isAuthEndpoint) {
              logger.warn('[Auth] Session expired or invalid token detected');
              this.logout();
              throw new ApiError(
                data?.message || 'Your session has expired. Please log in again.',
                401,
                'AUTH_EXPIRED'
              );
            }
            
            // Auth endpoints (login, signup) - invalid credentials
            const errorMessage = data?.message || 'Invalid credentials. Please check your phone number and password.';
            logger.warn('[Auth] Authentication failed:', errorMessage);
            throw new ApiError(errorMessage, 401, 'INVALID_CREDENTIALS');
          }

          if (response.status === 403) {
            const data = await response.json().catch(() => ({ message: 'Access denied' }));
            const errorMessage = data?.message || 'You do not have permission to access this resource.';
            logger.warn('[Auth] Access forbidden:', errorMessage);
            throw new ApiError(errorMessage, 403, 'ACCESS_FORBIDDEN');
          }

          const data = await response.json().catch(() => ({ message: 'Invalid response from server' }));

          if (!response.ok) {
            const errMsg = data?.message || data?.error || getStatusMessage(response.status);
            const err: any = new ApiError(errMsg, response.status, data?.code);
            err.data = data;
            throw err;
          }

          // Apply sanitization to remove forbidden keys, then normalize snake_case to camelCase
          const sanitized = sanitizeResponse(data);
          const normalized = normalizeResponse(sanitized);
          return normalized as T;
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err;

          if (err instanceof ApiError) {
            if (err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) throw err;
            if (err.code === 'AUTH_EXPIRED') throw err;
          }

          if (attempt < maxRetries && isRetryableError(err)) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            logger.warn(`[API] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, err?.message || err);
            await sleep(delay);
            continue;
          }

          throw err;
        }
      }

      throw lastError || new Error('Request failed after multiple attempts');
    })();

    if (method === 'GET') this.pendingRequests.set(requestKey, doRequest as Promise<unknown>);
    try {
      return await doRequest;
    } finally {
      if (method === 'GET') this.pendingRequests.delete(requestKey);
    }
  }

  // Cached GET helper
  private async cachedGet<T>(endpoint: string, ttlMs: number, signal?: AbortSignal): Promise<T> {
    const cacheKey = `GET:${endpoint}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) return cached;
    const data = await this.request<T>(endpoint, 'GET', undefined, signal);
    this.cache.set(cacheKey, data, ttlMs);
    return data;
  }

  // Public API methods
  async signup(userData: Partial<User>, pin: string): Promise<User> {
    const payload: SignupRequest = {
      name: userData.name!,
      phone: userData.phone!,
      role: userData.role!,
      city: userData.city!,
      password: pin,
      ...(userData.role === 'driver' && {
        age: userData.age,
        gender: userData.gender,
        maritalStatus: userData.maritalStatus,
        religion: userData.religion,
        personality: userData.personality,
        vehicle: {
          type: userData.vehicle?.type || '',
          category: userData.vehicle?.category || '',
          photos: userData.vehicle?.photos || []
        }
      })
    };

    const res = await this.request<AuthResponse>(`/auth/signup`, 'POST', payload);
    const normalizedUser = normalizeUser(res.user);
    this.saveSession(res.authToken, normalizedUser);
    return normalizedUser;
  }

  async login(phone: string, pin: string): Promise<User> {
    const payload = { phone, password: pin };
    const res = await this.request<AuthResponse>(`/auth/login`, 'POST', payload);
    const normalizedUser = normalizeUser(res.user);
    this.saveSession(res.authToken, normalizedUser);
    return normalizedUser;
  }

  async requestPasswordReset(phone: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/request-password-reset`, 'POST', { phone });
  }

  async completePasswordReset(phone: string, code: string, newPassword: string): Promise<User> {
    const res = await this.request<AuthResponse>(`/auth/complete-password-reset`, 'POST', { phone, code, password: newPassword });
    const normalizedUser = normalizeUser(res.user);
    this.saveSession(res.authToken, normalizedUser);
    return normalizedUser;
  }

  async getMe(signal?: AbortSignal): Promise<User | null> {
    try {
      // Check if token exists before making request
      const token = localStorage.getItem('ridein_auth_token');
      if (!token || token === 'undefined') {
        logger.warn('[Auth] No valid token found, clearing session');
        localStorage.removeItem('ridein_auth_token');
        localStorage.removeItem('ridein_user_cache');
        return null;
      }

      const user = await this.cachedGet<User>(`/auth/me`, CACHE_TTL.user, signal);
      if (user) {
        const normalizedUser = normalizeUser(user);
        // No need to sanitize again — already done in request()
        localStorage.setItem('ridein_user_cache', JSON.stringify(normalizedUser));
        logger.log('[Auth] Session validated successfully');
        return normalizedUser;
      }
      return user;
    } catch (e: any) {
      logger.error('[Auth] Failed to validate session:', e?.message || e);
      // Clear invalid session data on auth errors
      if (e?.isAuthError || e?.statusCode === 401) {
        localStorage.removeItem('ridein_auth_token');
        localStorage.removeItem('ridein_user_cache');
      }
      return null;
    }
  }

  saveSession(token: string, user: User, expirySeconds: number = TOKEN_EXPIRY_SECONDS): void {
    if (!token || typeof token !== 'string' || token === 'undefined') {
      logger.error('[Auth] Invalid token received, not saving session');
      throw new Error('Invalid authentication token received');
    }
    if (!user || !user.id) {
      logger.error('[Auth] Invalid user received, not saving session');
      throw new Error('Invalid user data received');
    }
    // No need to sanitize again — already done in request()
    const tokenExpiry = Date.now() + (expirySeconds * 1000);
    
    localStorage.setItem('ridein_auth_token', token);
    localStorage.setItem('ridein_token_expiry', tokenExpiry.toString());
    localStorage.setItem('ridein_user_cache', JSON.stringify(user));
    
    // Only one token should be active at a time - clear old tokens
    this.activeTokens.clear();
    this.activeTokens.add(token);
  }

  getTokenExpiry(): number | null {
    const expiry = localStorage.getItem('ridein_token_expiry');
    return expiry ? parseInt(expiry, 10) : null;
  }

  isTokenExpired(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() >= expiry;
  }

  isTokenExpiring(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return false;
    return (expiry - Date.now()) <= TOKEN_REFRESH_THRESHOLD && Date.now() < expiry;
  }

  async refreshToken(): Promise<boolean> {
    try {
      const currentToken = localStorage.getItem('ridein_auth_token');
      if (!currentToken) return false;

      // Call refresh endpoint
      const res = await this.request<AuthResponse>('/auth/refresh', 'POST', {});
      const normalizedUser = normalizeUser(res.user);
      
      // Use tokenExpiry (in seconds) from response if provided, otherwise default to 24 hours
      const expirySeconds = res.tokenExpiry || TOKEN_EXPIRY_SECONDS;
      this.saveSession(res.authToken, normalizedUser, expirySeconds);
      
      // Invalidate old token
      this.activeTokens.delete(currentToken);
      
      return true;
    } catch (err) {
      logger.error('[Auth] Token refresh failed:', err);
      return false;
    }
  }

  async revokeToken(token?: string): Promise<void> {
    const tokenToRevoke = token || localStorage.getItem('ridein_auth_token');
    if (!tokenToRevoke) return;

    try {
      // Call revoke endpoint (will be created in backend)
      await this.request('/auth/revoke', 'POST', { token: tokenToRevoke });
      this.activeTokens.delete(tokenToRevoke);
    } catch (err) {
      logger.error('[Auth] Token revocation failed:', err);
    }
  }

  logout(): void {
    const token = localStorage.getItem('ridein_auth_token');
    
    // Revoke token on server
    if (token) {
      this.revokeToken(token).catch(err => 
        logger.error('[Auth] Failed to revoke token on logout:', err)
      );
    }
    
    localStorage.removeItem('ridein_auth_token');
    localStorage.removeItem('ridein_token_expiry');
    localStorage.removeItem('ridein_user_cache');
    this.cache.invalidate();
    ablyService.disconnect();
    window.location.href = '/';
  }

  async switchRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.request<User>(`/switch-role`, 'POST', {
      new_role: role
    });
    const normalizedUser = normalizeUser(user);
    // No need to sanitize again — already done in request()
    localStorage.setItem('ridein_user_cache', JSON.stringify(normalizedUser));
    // Invalidate the /auth/me cache to prevent stale data
    this.cache.invalidate('GET:/auth/me');
    this.cache.invalidate('user');
    return normalizedUser;
  }

  subscribeToActiveTrip(callback: (trip: Trip | null) => void): () => void {
    const controller = new AbortController();
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkActive = async () => {
      if (document.hidden) return; // Skip when tab is hidden
      try {
        const trip = await this.request<Trip>(`/trips/active`, 'GET', undefined, controller.signal);
        const normalized = trip ? normalizeTrip(trip) : null;
        callback(normalized);
      } catch (e: any) {
        if (e instanceof ApiError && e.code === 'ABORTED') return;
        if (e?.message?.includes('Session expired') || e?.message?.includes('401')) {
          if (interval) clearInterval(interval);
          return;
        }
        callback(null);
      }
    };

    const startPolling = () => {
      if (!interval) {
        checkActive();
        interval = setInterval(checkActive, ACTIVE_TRIP_POLL_INTERVAL);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      controller.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  async requestTrip(payload: CreateTripRequest, signal?: AbortSignal): Promise<Trip> {
    const xanoPayload = {
      rider_id: safeParseInt(payload.riderId, 'riderId'),
      vehicle_type: payload.type,
      category: payload.category,
      pickup: { lat: payload.pickup.lat, lng: payload.pickup.lng },
      dropoff: { lat: payload.dropoff.lat, lng: payload.dropoff.lng },
      pickup_address: payload.pickup.address,
      dropoff_address: payload.dropoff.address,
      proposed_price: Number(payload.proposed_price),
      distance_km: Number(payload.distance_km),
      duration_mins: typeof payload.duration === 'string' ? safeParseInt(payload.duration, 'duration') : payload.duration,
      is_guest_booking: !!payload.isGuestBooking,
      guest_name: payload.guestName || '',
      guest_phone: payload.guestPhone || '',
      scheduled_time: payload.scheduledTime || null,
      item_description: payload.itemDescription || '',
      requires_assistance: !!payload.requiresAssistance,
      cargo_photos: payload.cargoPhotos || []
    };
    const trip = await this.request<Trip>(`/trips`, 'POST', xanoPayload, signal);
    this.cache.invalidate('trips');
    return normalizeTrip(trip);
  }

  async cancelTrip(tripId: string): Promise<void> {
    await this.request(`/trips/${tripId}/cancel`, 'POST');
    this.cache.invalidate('trips');
  }

  async submitBid(tripId: string, offer_price: number, driver: User): Promise<void> {
    const res = await this.request<{ id: number }>(`/trips/${tripId}/offers`, 'POST', {
      trip_id: safeParseInt(tripId, 'tripId'),
      driver_id: safeParseInt(driver.id, 'driver.id'),
      offer_price: Number(offer_price)
    });

    ablyService.submitBid(tripId, {
      id: res.id.toString(),
      driverId: driver.id,
      driverName: driver.name,
      driverRating: driver.rating,
      amount: Number(offer_price),
      eta: '5 min',
      vehicleInfo: driver.vehicle?.category || 'Standard'
    });
  }

  async acceptBid(tripId: string, bidId: string): Promise<Trip> {
    const trip = await this.request<Trip>(`/trips/${tripId}/accept`, 'POST', { bid_id: safeParseInt(bidId, 'bidId') });
    this.cache.invalidate('trips');
    return normalizeTrip(trip);
  }

  async updateTripStatus(tripId: string, status: TripStatus): Promise<void> {
    await this.request(`/trips/${tripId}/status`, 'POST', { status });
    this.cache.invalidate('trips');
  }

  async submitReview(tripId: string, rating: number, tags: string[], comment: string, isFavorite: boolean): Promise<void> {
    await this.request(`/trips/${tripId}/review`, 'POST', {
      trip_id: safeParseInt(tripId, 'tripId'),
      rating: Number(rating),
      tags,
      comment,
      is_favorite: isFavorite
    });
  }

  async submitRating(tripId: string, rating: number): Promise<void> {
    await this.request(`/trips/${tripId}/rating`, 'POST', {
      trip_id: safeParseInt(tripId, 'tripId'),
      rating: Number(rating)
    });
  }

  // Health Monitoring
  // NOTE: For production at scale (200K+ users), create a dedicated /health endpoint
  // in Xano that requires no authentication and does minimal work (just returns 200 OK)
  // The current default of /auth/me requires authentication and does database lookups
  async checkHealth(endpoint: string = '/auth/me'): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseTime: number }> {
    const startTime = Date.now();
    try {
      await this.request(endpoint, 'GET', undefined, undefined, { timeout: 5000, retries: 0 });
      const responseTime = Date.now() - startTime;
      const status = responseTime < 1000 ? 'healthy' : 'degraded';
      
      this.healthStatus.set(endpoint, { status, lastChecked: Date.now(), responseTime });
      return { status, responseTime };
    } catch (err) {
      this.healthStatus.set(endpoint, { status: 'down', lastChecked: Date.now() });
      return { status: 'down', responseTime: Date.now() - startTime };
    }
  }

  getHealthStatus(endpoint: string): { status: 'healthy' | 'degraded' | 'down'; lastChecked: number; responseTime?: number } | null {
    return this.healthStatus.get(endpoint) || null;
  }

  // Check if user has required role(s)
  hasRole(user: User | null, roles: UserRole | UserRole[]): boolean {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }

  // Check if user has specific permission (for admin users)
  hasPermission(user: User | null, permission: string): boolean {
    if (!user || user.role !== 'admin') return false;
    return user.permissions?.includes(permission) || false;
  }

  // ============================================================================
  // Admin Methods (Item 15)
  // ============================================================================
  async getAdminUsers(page = 1, perPage = 30): Promise<{ users: User[]; total: number }> {
    const response = await this.request<{ users: User[]; pagination: { total: number } }>(
      `/admin/users?page=${page}&per_page=${perPage}`,
      'GET'
    );
    return {
      users: response.users.map(normalizeUser),
      total: response.pagination.total
    };
  }

  async updateUserAccountStatus(userId: string, status: string): Promise<void> {
    await this.request(`/admin/users/${userId}/status`, 'POST', { status });
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalTrips: number; activeDrivers: number }> {
    return this.request<{ totalUsers: number; totalTrips: number; activeDrivers: number }>(
      '/admin/stats',
      'GET'
    );
  }

  async approveDriver(userId: string): Promise<void> {
    await this.request(`/admin/drivers/${userId}/approve`, 'POST');
  }

  async rejectDriver(userId: string, reason?: string): Promise<void> {
    await this.request(`/admin/drivers/${userId}/reject`, 'POST', { reason });
  }

  // ============================================================================
  // Trip History Methods (Item 19)
  // ============================================================================
  async getTripHistory(page = 1, perPage = 20): Promise<{ trips: Trip[]; total: number }> {
    const response = await this.request<{ trips: Trip[]; pagination?: { total: number } }>(
      `/trips/history?page=${page}&per_page=${perPage}`,
      'GET'
    );
    return {
      trips: response.trips.map(normalizeTrip),
      total: response.pagination?.total || response.trips.length
    };
  }

  // ============================================================================
  // Favourites Methods (Item 21)
  // ============================================================================
  async getFavourites(): Promise<User[]> {
    const response = await this.request<{ favourites: User[] }>('/favourites', 'GET');
    return response.favourites.map(normalizeUser);
  }

  async addFavourite(driverId: string): Promise<void> {
    await this.request('/favourites', 'POST', { driver_id: safeParseInt(driverId, 'driverId') });
  }

  async removeFavourite(favouriteId: string): Promise<void> {
    await this.request(`/favourites/${favouriteId}`, 'DELETE');
  }

  // ============================================================================
  // Profile Methods (Item 20)
  // ============================================================================
  async updateProfile(updates: Partial<User>): Promise<User> {
    const payload: any = {};
    
    // Map camelCase to snake_case for backend
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar;
    if (updates.age !== undefined) payload.age = updates.age;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.maritalStatus !== undefined) payload.marital_status = updates.maritalStatus;
    if (updates.religion !== undefined) payload.religion = updates.religion;
    if (updates.personality !== undefined) payload.personality = updates.personality;
    
    const user = await this.request<User>('/auth/profile', 'PUT', payload);
    const normalizedUser = normalizeUser(user);
    
    // Update cached user - no need to sanitize again as already done in request()
    localStorage.setItem('ridein_user_cache', JSON.stringify(normalizedUser));
    this.cache.invalidate('user');
    
    return normalizedUser;
  }
}

export const xanoService = new XanoApiClient();
