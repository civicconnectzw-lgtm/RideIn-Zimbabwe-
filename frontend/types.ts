// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = 'rider' | 'driver' | 'admin';

export enum TripStatus {
  PENDING = 'PENDING',
  BIDDING = 'BIDDING',
  ACCEPTED = 'ACCEPTED',
  ARRIVING = 'ARRIVING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum VehicleType {
  PASSENGER = 'PASSENGER',
  FREIGHT = 'FREIGHT'
}

export enum PassengerCategory {
  STANDARD = 'Standard',
  PREMIUM = 'Premium',
  LUXURY = 'Luxury'
}

export enum FreightCategory {
  BIKE = 'Bike Delivery (Up to 20kg)',
  TONNE_1_2 = '1–2 Tonne Truck',
  TONNE_3_5 = '3–5 Tonne Truck',
  TONNE_7_10 = '7–10 Tonne Truck'
}

// ============================================================================
// EXTRACTED SUB-TYPES
// ============================================================================

export type DriverStatus = 'pending' | 'approved' | 'rejected';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type SubscriptionStatus = 'active' | 'expired' | 'grace_period';

export interface Vehicle {
  type: VehicleType;
  category: string;
  photos: string[];
}

export interface Subscription {
  status: SubscriptionStatus;
  expiryDate: string;
  plan: string;
}

// ============================================================================
// USER TYPES - Discriminated Union + Backward Compatible
// ============================================================================

export interface UserBase {
  id: string;
  name: string;
  phone: string;
  city: string;
  rating: number;
  tripsCount: number;
  isOnline: boolean;
  avatar: string;
  token?: string;
  account_status?: AccountStatus;
  tokenExpiry?: number; // Unix timestamp when token expires
}

export interface RiderUser extends UserBase {
  role: 'rider';
}

export interface AdminUser extends UserBase {
  role: 'admin';
  permissions?: string[];
}

export interface DriverUser extends UserBase {
  role: 'driver';
  gender?: string;
  age?: number;
  maritalStatus?: string;
  religion?: string;
  personality?: 'Talkative' | 'Quiet';
  vehicle?: Vehicle;
  yearsExperience?: number;
  serviceAreas?: string[];
  subscription?: Subscription;
  driver_profile_exists?: boolean;
  driver_verified?: boolean;
  driver_approved?: boolean;
  driver_status?: DriverStatus;
  force_rider_mode?: boolean;
}

// Strict discriminated union for new code
export type StrictUser = RiderUser | DriverUser | AdminUser;

// Backward-compatible type: all fields accessible without narrowing
export interface User extends UserBase {
  role: UserRole;
  gender?: string;
  age?: number;
  maritalStatus?: string;
  religion?: string;
  personality?: 'Talkative' | 'Quiet';
  vehicle?: Vehicle;
  yearsExperience?: number;
  serviceAreas?: string[];
  subscription?: Subscription;
  token?: string;
  tokenExpiry?: number;
  driver_profile_exists?: boolean;
  driver_verified?: boolean;
  driver_approved?: boolean;
  driver_status?: DriverStatus;
  force_rider_mode?: boolean;
  account_status?: AccountStatus;
  permissions?: string[]; // Admin permissions
}

// ============================================================================
// LOCATION & BID TYPES
// ============================================================================

export interface TripLocation {
  address: string;
  lat: number;
  lng: number;
}

/** @deprecated Use TripLocation instead */
export type Location = TripLocation;

export interface Bid {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverAvatar?: string;
  amount: number; 
  eta: string;
  vehicleInfo: string;
  isFavourite?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

// ============================================================================
// TRIP TYPES - Base + Discriminated Union
// ============================================================================

// Base Trip interface for backward compatibility
export interface Trip {
  id: string;
  riderId: string;
  riderName: string;
  status: TripStatus;
  type: VehicleType;
  category: string;
  pickup: TripLocation;
  dropoff: TripLocation;
  distance_km: number;
  suggested_price: number;
  proposed_price: number;
  final_price?: number;
  bids: Bid[];
  acceptedBidId?: string;
  driverId?: string; 
  distance: string; 
  duration: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  partner?: string;
  city?: string; 
  scheduledTime?: string;
  isGuestBooking?: boolean;
  guestName?: string;
  guestPhone?: string;
  itemDescription?: string;
  requiresAssistance?: boolean;
  cargoPhotos?: string[];
}

// Discriminated union variants for new code
export type PendingTrip = Omit<Trip, 'driverId' | 'final_price'> & { 
  status: TripStatus.PENDING; 
};

export type BiddingTrip = Trip & { 
  status: TripStatus.BIDDING; 
  bids: Bid[]; 
};

export type AcceptedTrip = Omit<Trip, 'acceptedBidId' | 'driverId'> & { 
  status: TripStatus.ACCEPTED; 
  driverId: string; 
  acceptedBidId: string; 
};

export type ActiveTrip = Omit<Trip, 'driverId'> & { 
  status: TripStatus.ARRIVING | TripStatus.IN_PROGRESS; 
  driverId: string; 
};

export type CompletedTrip = Omit<Trip, 'driverId' | 'final_price' | 'completedAt'> & { 
  status: TripStatus.COMPLETED; 
  driverId: string; 
  final_price: number; 
  completedAt: string; 
};

export type CancelledTrip = Trip & { 
  status: TripStatus.CANCELLED; 
};

export type StrictTrip = PendingTrip | BiddingTrip | AcceptedTrip | ActiveTrip | CompletedTrip | CancelledTrip;

// ============================================================================
// COMPONENT PROP INTERFACES
// ============================================================================

export interface HomeViewProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
}

export interface LoginViewProps {
  onLogin: (user: User) => void;
}

// ============================================================================
// ABLY REAL-TIME PAYLOAD TYPES
// ============================================================================

export interface DriverLocationPayload {
  driverId: string;
  lat: number;
  lng: number;
  rotation: number;
  ts: number;
}

export interface BidEventPayload {
  type: 'bid';
  data: Bid;
}

export interface StatusUpdateEventPayload {
  type: 'status_update';
  data: { status: TripStatus };
}

export interface CancelEventPayload {
  type: 'cancel';
  data: { reason: string };
}

export type RideEventPayload = BidEventPayload | StatusUpdateEventPayload | CancelEventPayload;

// ============================================================================
// AUTHENTICATION STATE TYPES
// ============================================================================

export type AuthState = 
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'session_expired'
  | 'session_expiring'
  | 'refreshing';

export interface AuthContextValue {
  user: User | null;
  authState: AuthState;
  loading: boolean;
  error: string | null;
  tokenExpiry: number | null;
  login: (phone: string, pin: string) => Promise<User | null>;
  signup: (userData: Partial<User>, pin: string) => Promise<User | null>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  requestPasswordReset: (phone: string) => Promise<{ message: string } | null>;
  completePasswordReset: (phone: string, code: string, newPassword: string) => Promise<User | null>;
  switchRole: (role: UserRole) => Promise<User | null>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export interface ApiHealthStatus {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: number;
  responseTime?: number;
  errorMessage?: string;
}

// ============================================================================
// RUNTIME TYPE GUARDS
// ============================================================================

export function isUser(obj: unknown): obj is User {
  if (typeof obj !== 'object' || obj === null) return false;
  const u = obj as any;
  return (
    (typeof u.id === 'string' || typeof u.id === 'number') &&
    typeof u.name === 'string' &&
    typeof u.phone === 'string' &&
    (u.role === 'rider' || u.role === 'driver' || u.role === 'admin') &&
    typeof u.city === 'string' &&
    typeof u.rating === 'number' &&
    typeof u.tripsCount === 'number' &&
    typeof u.isOnline === 'boolean' &&
    typeof u.avatar === 'string'
  );
}

export function isDriverUser(user: User): user is DriverUser {
  return user.role === 'driver';
}

export function isRiderUser(user: User): user is RiderUser {
  return user.role === 'rider';
}

export function isAdminUser(user: User): user is AdminUser {
  return user.role === 'admin';
}

export function isTrip(obj: unknown): obj is Trip {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as any;
  return (
    typeof t.id === 'string' &&
    typeof t.riderId === 'string' &&
    typeof t.riderName === 'string' &&
    Object.values(TripStatus).includes(t.status) &&
    Object.values(VehicleType).includes(t.type) &&
    typeof t.category === 'string' &&
    isTripLocation(t.pickup) &&
    isTripLocation(t.dropoff) &&
    typeof t.distance_km === 'number' &&
    typeof t.suggested_price === 'number' &&
    typeof t.proposed_price === 'number' &&
    Array.isArray(t.bids) &&
    typeof t.distance === 'string' &&
    typeof t.duration === 'string' &&
    typeof t.createdAt === 'string'
  );
}

export function isBid(obj: unknown): obj is Bid {
  if (typeof obj !== 'object' || obj === null) return false;
  const b = obj as any;
  return (
    typeof b.id === 'string' &&
    typeof b.driverId === 'string' &&
    typeof b.driverName === 'string' &&
    typeof b.driverRating === 'number' &&
    typeof b.amount === 'number' &&
    typeof b.eta === 'string' &&
    typeof b.vehicleInfo === 'string'
  );
}

export function isChatMessage(obj: unknown): obj is ChatMessage {
  if (typeof obj !== 'object' || obj === null) return false;
  const m = obj as any;
  return (
    typeof m.id === 'string' &&
    typeof m.senderId === 'string' &&
    typeof m.text === 'string' &&
    typeof m.timestamp === 'string'
  );
}

export function isTripLocation(obj: unknown): obj is TripLocation {
  if (typeof obj !== 'object' || obj === null) return false;
  const l = obj as any;
  return (
    typeof l.address === 'string' &&
    typeof l.lat === 'number' &&
    typeof l.lng === 'number'
  );
}