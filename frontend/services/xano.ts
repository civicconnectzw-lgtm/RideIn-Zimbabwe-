import { Trip, TripStatus, User, UserRole } from '../types';
import { ablyService } from './ably';

const PROXY_BASE = '/.netlify/functions/xano';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

function cleanResponse(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanResponse);
  
  const clean: any = {};
  const forbiddenKeys = ['email', 'mail', 'user_email', 'reference-email', 'reference_email', 'e-mail'];
  
  for (const key in obj) {
    const k = key.toLowerCase();
    if (forbiddenKeys.some(forbidden => k === forbidden || k.includes('reference-email'))) continue;
    clean[key] = cleanResponse(obj[key]);
  }
  return clean;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
    return true;
  }
  
  // Timeout errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return true;
  }
  
  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Rate limiting
  if (error.status === 429) {
    return true;
  }
  
  return false;
}

/**
 * Enhanced xanoRequest with retry logic, timeout handling, and offline detection
 */
async function xanoRequest<T>(
  endpoint: string, 
  method: string = 'GET', 
  body?: any,
  options: { retries?: number; timeout?: number } = {}
): Promise<T> {
  const maxRetries = options.retries ?? MAX_RETRIES;
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  
  // Check if offline before making request
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = localStorage.getItem('ridein_auth_token');
      const url = `${PROXY_BASE}${endpoint}`;
      
      // Create abort controller for timeout
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
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle 401 Unauthorized
        if (response.status === 401) {
          xanoService.logout();
          throw new Error("Session expired. Please log in again.");
        }

        // Parse response
        const data = await response.json().catch(() => ({ 
          message: "Invalid response from server" 
        }));
        
        // Handle non-OK responses
        if (!response.ok) {
          const error: any = new Error(
            data.message || 
            data.error || 
            getStatusMessage(response.status)
          );
          error.status = response.status;
          error.data = data;
          throw error;
        }

        return cleanResponse(data) as T;
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Handle timeout
        if (fetchError.name === 'AbortError') {
          const error: any = new Error('Request timeout. Please check your connection and try again.');
          error.name = 'AbortError';
          throw error;
        }
        
        throw fetchError;
      }
      
    } catch (err: any) {
      lastError = err;
      
      // Don't retry on client errors (4xx) except 429
      if (err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      
      // Don't retry on auth errors
      if (err.message?.includes('Session expired')) {
        throw err;
      }
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(err)) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.warn(`[API] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, err.message);
        await sleep(delay);
        continue;
      }
      
      // No more retries, throw the error
      throw err;
    }
  }
  
  // If we get here, we've exhausted retries
  throw lastError || new Error('Request failed after multiple attempts');
}

/**
 * Get user-friendly message for HTTP status codes
 */
function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 403:
      return 'Access denied. You don\'t have permission for this action.';
    case 404:
      return 'Resource not found.';
    case 408:
      return 'Request timeout. Please try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
      return 'Service temporarily unavailable. Please try again.';
    case 504:
      return 'Gateway timeout. Please check your connection and try again.';
    default:
      return `An error occurred (${status}). Please try again.`;
  }
}

export const xanoService = {
  async signup(userData: Partial<User>, pin: string): Promise<User> {
    const payload: any = {
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      city: userData.city,
      password: pin
    };

    if (userData.role === 'driver') {
      payload.age = userData.age;
      payload.gender = userData.gender;
      payload.maritalStatus = userData.maritalStatus;
      payload.religion = userData.religion;
      payload.personality = userData.personality;
      payload.vehicle = {
        type: userData.vehicle?.type,
        category: userData.vehicle?.category,
        photos: userData.vehicle?.photos || []
      };
    }

    const res = await xanoRequest<{ authToken: string, user: User }>(
      `/auth/signup`, 
      'POST', 
      payload
    );
    this.saveSession(res.authToken, res.user);
    return res.user;
  },

  async login(phone: string, pin: string): Promise<User> {
    const payload = { phone, password: pin };
    const res = await xanoRequest<{ authToken: string, user: User }>(`/auth/login`, 'POST', payload);
    this.saveSession(res.authToken, res.user);
    return res.user;
  },

  async requestPasswordReset(phone: string): Promise<{ message: string }> {
    return xanoRequest<{ message: string }>(`/auth/request-password-reset`, 'POST', { phone });
  },

  async completePasswordReset(phone: string, code: string, newPassword: string): Promise<User> {
    const res = await xanoRequest<{ authToken: string, user: User }>(
      `/auth/complete-password-reset`, 
      'POST', 
      { phone, code, password: newPassword }
    );
    this.saveSession(res.authToken, res.user);
    return res.user;
  },

  async getMe(): Promise<User | null> {
    try {
      const user = await xanoRequest<User>(`/auth/me`, 'GET');
      if (user) {
        localStorage.setItem('ridein_user_cache', JSON.stringify(cleanResponse(user)));
      }
      return user;
    } catch (e) { 
      return null; 
    }
  },

  saveSession(token: string, user: User) {
    const cleanUser = cleanResponse(user);
    localStorage.setItem('ridein_auth_token', token);
    localStorage.setItem('ridein_user_cache', JSON.stringify(cleanUser));
  },

  logout() {
    localStorage.removeItem('ridein_auth_token');
    localStorage.removeItem('ridein_user_cache');
    ablyService.disconnect();
    window.location.href = '/';
  },

  async switchRole(userId: string, role: UserRole): Promise<User> {
    const user = await xanoRequest<User>(`/switch-role`, 'POST', { 
      user_id: parseInt(userId),
      role 
    });
    const clean = cleanResponse(user);
    localStorage.setItem('ridein_user_cache', JSON.stringify(clean));
    return clean;
  },

  subscribeToActiveTrip(callback: (trip: Trip | null) => void) {
    let interval: ReturnType<typeof setInterval> | null = null;
    const checkActive = async () => {
      try {
        const trip = await xanoRequest<Trip>(`/trips/active`, 'GET');
        callback(trip || null);
      } catch (e: any) {
        // If session expired, stop polling to prevent infinite logout loops
        if (e.message?.includes('Session Expired') || e.message?.includes('401')) {
          if (interval) clearInterval(interval);
          return;
        }
        callback(null);
      }
    };
    checkActive();
    interval = setInterval(checkActive, 12000); 
    return () => { if (interval) clearInterval(interval); };
  },

  async requestTrip(payload: any): Promise<Trip> {
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
      duration_mins: parseInt(payload.duration),
      is_guest_booking: !!payload.isGuestBooking,
      guest_name: payload.guestName || '',
      guest_phone: payload.guestPhone || '',
      scheduled_time: payload.scheduledTime || null,
      item_description: payload.itemDescription || '',
      requires_assistance: !!payload.requiresAssistance,
      cargo_photos: payload.cargoPhotos || []
    };
    return xanoRequest<Trip>(`/trips`, 'POST', xanoPayload);
  },

  async cancelTrip(tripId: string): Promise<void> {
    await xanoRequest(`/trips/${tripId}/cancel`, 'POST');
  },

  async submitBid(tripId: string, offer_price: number, driver: User): Promise<void> {
    const res = await xanoRequest<any>(`/trips/${tripId}/offers`, 'POST', { 
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
  },

  async acceptBid(tripId: string, bidId: string): Promise<Trip> {
    return xanoRequest<Trip>(`/trips/${tripId}/accept`, 'POST', { 
      bid_id: parseInt(bidId) 
    });
  },

  async updateTripStatus(tripId: string, status: TripStatus): Promise<void> {
    await xanoRequest(`/trips/${tripId}/status`, 'POST', { status });
  },

  async submitReview(tripId: string, rating: number, tags: string[], comment: string, isFavorite: boolean): Promise<void> {
    await xanoRequest(`/trips/${tripId}/review`, 'POST', { 
      trip_id: parseInt(tripId),
      rating: Number(rating), 
      tags, 
      comment, 
      is_favorite: isFavorite 
    });
  },

  async submitRating(tripId: string, rating: number): Promise<void> {
    await xanoRequest(`/trips/${tripId}/rating`, 'POST', {
      trip_id: parseInt(tripId),
      rating: Number(rating)
    });
  }
};