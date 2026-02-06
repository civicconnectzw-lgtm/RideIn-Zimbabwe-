import { Trip, TripStatus, User, UserRole } from '../types';
import { ablyService } from './ably';

const PROXY_BASE = '/.netlify/functions/xano';

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
  private store = new Map<string, CacheEntry<unknown>>();

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
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  invalidate(pattern?: string): void {
    if (!pattern) { this.store.clear(); return; }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }
}

// ============================================================================
// Sanitize Response (replaces cleanResponse)
// ============================================================================

const FORBIDDEN_KEYS = new Set(['email', 'mail', 'user_email', 'reference-email', 'reference_email', 'e-mail']);

function sanitizeResponse<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeResponse) as T;
  
  const clean: Record<string, unknown> = {};
  
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const k = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(k) || k.includes('reference-email')) continue;
    clean[key] = sanitizeResponse((obj as Record<string, unknown>)[key]);
  }
  return clean as T;
}

// ============================================================================
// XanoApiClient Class
// ============================================================================

class XanoApiClient {
  private cache = new RequestCache();
  private pendingRequests = new Map<string, Promise<unknown>>();

  /**
   * Core request method with AbortSignal support, error handling, and deduplication
   */
  private async request<T>(
    endpoint: string, 
    method: string = 'GET', 
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const token = localStorage.getItem('ridein_auth_token');
    const url = `${PROXY_BASE}${endpoint}`;
    const requestKey = `${method}:${endpoint}`;
    
    // Request deduplication for GET requests
    if (method === 'GET' && this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey) as Promise<T>;
    }
    
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });

        if (response.status === 401) {
          this.logout();
          throw new ApiError("Session Expired: Please log in again.", 401, 'AUTH_EXPIRED');
        }

        const data = await response.json().catch(() => ({ message: "Malformed JSON response from server" }));
        
        if (!response.ok) {
          const msg = data.message || data.error || `Protocol Error: ${response.status}`;
          throw new ApiError(msg, response.status, data.code);
        }

        return sanitizeResponse(data) as T;
      } catch (err: unknown) {
        // Handle AbortError
        if (err instanceof Error && err.name === 'AbortError') {
          throw new ApiError('Request cancelled', 0, 'ABORTED', err);
        }
        // Re-throw ApiError as-is
        if (err instanceof ApiError) {
          throw err;
        }
        // Network or other errors
        throw new ApiError(
          err instanceof Error ? err.message : 'Unknown error',
          0,
          'NETWORK_ERROR',
          err
        );
      } finally {
        // Clean up pending request
        if (method === 'GET') {
          this.pendingRequests.delete(requestKey);
        }
      }
    })();
    
    // Store pending GET requests for deduplication
    if (method === 'GET') {
      this.pendingRequests.set(requestKey, requestPromise);
    }
    
    return requestPromise;
  }

  /**
   * Cached GET request
   */
  private async cachedGet<T>(endpoint: string, ttl: number, signal?: AbortSignal): Promise<T> {
    const cacheKey = `GET:${endpoint}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) return cached;
    
    const data = await this.request<T>(endpoint, 'GET', undefined, signal);
    this.cache.set(cacheKey, data, ttl);
    return data;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

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
    this.saveSession(res.authToken, res.user);
    return res.user;
  }

  async login(phone: string, pin: string): Promise<User> {
    const payload = { phone, password: pin };
    const res = await this.request<AuthResponse>(`/auth/login`, 'POST', payload);
    this.saveSession(res.authToken, res.user);
    return res.user;
  }

  async requestPasswordReset(phone: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/request-password-reset`, 'POST', { phone });
  }

  async completePasswordReset(phone: string, code: string, newPassword: string): Promise<User> {
    const res = await this.request<AuthResponse>(
      `/auth/complete-password-reset`, 
      'POST', 
      { phone, code, password: newPassword }
    );
    this.saveSession(res.authToken, res.user);
    return res.user;
  }

  async getMe(signal?: AbortSignal): Promise<User | null> {
    try {
      const user = await this.cachedGet<User>(`/auth/me`, CACHE_TTL.user, signal);
      if (user) {
        localStorage.setItem('ridein_user_cache', JSON.stringify(sanitizeResponse(user)));
      }
      return user;
    } catch (e) { 
      return null; 
    }
  }

  saveSession(token: string, user: User): void {
    const cleanUser = sanitizeResponse(user);
    localStorage.setItem('ridein_auth_token', token);
    localStorage.setItem('ridein_user_cache', JSON.stringify(cleanUser));
  }

  logout(): void {
    localStorage.removeItem('ridein_auth_token');
    localStorage.removeItem('ridein_user_cache');
    this.cache.invalidate();
    ablyService.disconnect();
    window.location.href = '/';
  }

  async switchRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.request<User>(`/switch-role`, 'POST', { 
      user_id: parseInt(userId),
      role 
    });
    const clean = sanitizeResponse(user);
    localStorage.setItem('ridein_user_cache', JSON.stringify(clean));
    this.cache.invalidate('user');
    return clean;
  }

  subscribeToActiveTrip(callback: (trip: Trip | null) => void): () => void {
    const controller = new AbortController();
    
    const checkActive = async () => {
      try {
        const trip = await this.request<Trip>(`/trips/active`, 'GET', undefined, controller.signal);
        callback(trip || null);
      } catch (e) {
        // Don't callback on abort errors
        if (e instanceof ApiError && e.code === 'ABORTED') return;
        callback(null); 
      }
    };
    
    checkActive();
    const interval = setInterval(checkActive, 12000); 
    
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }

  async requestTrip(payload: CreateTripRequest, signal?: AbortSignal): Promise<Trip> {
    const xanoPayload = {
      rider_id: parseInt(payload.riderId),
      vehicle_type: payload.type,
      category: payload.category,
      pickup: { lat: payload.pickup.lat, lng: payload.pickup.lng },
      dropoff: { lat: payload.dropoff.lat, lng: payload.dropoff.lng },
      pickup_address: payload.pickup.address,
      dropoff_address: payload.dropoff.address,
      proposed_price: Number(payload.proposed_price),
      distance_km: Number(payload.distance_km),
      duration_mins: typeof payload.duration === 'string' ? parseInt(payload.duration) : payload.duration,
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
    return trip;
  }

  async cancelTrip(tripId: string): Promise<void> {
    await this.request(`/trips/${tripId}/cancel`, 'POST');
    this.cache.invalidate('trips');
  }

  async submitBid(tripId: string, offer_price: number, driver: User): Promise<void> {
    const res = await this.request<{ id: number }>(`/trips/${tripId}/offers`, 'POST', { 
      trip_id: parseInt(tripId),
      driver_id: parseInt(driver.id),
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
    const trip = await this.request<Trip>(`/trips/${tripId}/accept`, 'POST', { 
      bid_id: parseInt(bidId) 
    });
    this.cache.invalidate('trips');
    return trip;
  }

  async updateTripStatus(tripId: string, status: TripStatus): Promise<void> {
    await this.request(`/trips/${tripId}/status`, 'POST', { status });
    this.cache.invalidate('trips');
  }

  async submitReview(tripId: string, rating: number, tags: string[], comment: string, isFavorite: boolean): Promise<void> {
    await this.request(`/trips/${tripId}/review`, 'POST', { 
      trip_id: parseInt(tripId),
      rating: Number(rating), 
      tags, 
      comment, 
      is_favorite: isFavorite 
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const xanoService = new XanoApiClient();