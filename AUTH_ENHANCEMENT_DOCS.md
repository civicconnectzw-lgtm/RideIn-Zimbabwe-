# Authentication Enhancement Documentation

## Overview

This document describes the authentication and session management enhancements implemented for the RideIn-Zimbabwe application.

## Features Implemented

### 1. Token Expiration Monitoring

**Frontend:**
- `AuthContext` monitors token expiration every 30 seconds
- Automatic logout when token expires
- Warning state when token is expiring (< 1 hour remaining)
- Visual indicators via `SessionStatusIndicator` component

**Backend:**
- Tokens expire after 24 hours (86400 seconds)
- Token expiry timestamp stored in localStorage
- Server validates token on each request

### 2. Token Refresh Mechanism

**Endpoint:** `POST /auth/refresh`

- Allows authenticated users to refresh their token before expiration
- Revokes old token and issues new one
- Maintains user session without requiring login
- Returns new token with 24-hour expiration

**Frontend Integration:**
- Automatic refresh when token is expiring
- Manual refresh via `refreshToken()` method in AuthContext
- Prevents multiple concurrent refresh attempts

### 3. Server-Side Session Invalidation

**Database Table:** `revoked_tokens`

Fields:
- `id` - Primary key
- `token` - The revoked token
- `user_id` - User who owned the token
- `revoked_at` - Timestamp of revocation
- `reason` - Reason for revocation (logout, refresh, etc.)

**Endpoint:** `POST /auth/revoke`

- Revokes token on server-side
- Called automatically on logout
- Prevents reuse of valid tokens after logout

**Protected Endpoints:**
All authenticated endpoints now check if token is revoked:
- `/auth/me`
- `/switch-role`
- `/trips/active`
- (All other authenticated endpoints should be updated similarly)

### 4. Centralized Authentication State Management

**AuthContext Component:**
Located: `/frontend/contexts/AuthContext.tsx`

Provides:
- `user` - Current authenticated user
- `authState` - Current auth state (initializing, authenticated, unauthenticated, session_expired, session_expiring, refreshing)
- `loading` - Loading state
- `error` - Error message
- `tokenExpiry` - Token expiration timestamp
- `login()` - Login method
- `signup()` - Signup method
- `logout()` - Logout with token revocation
- `refreshToken()` - Manual token refresh
- `requestPasswordReset()` - Password reset request
- `completePasswordReset()` - Complete password reset
- `switchRole()` - Switch user role
- `refreshUser()` - Refresh user data
- `clearError()` - Clear error state

**Usage:**
```tsx
import { useAuthContext } from './contexts/AuthContext';

function MyComponent() {
  const { user, authState, login, logout } = useAuthContext();
  
  // Use auth state...
}
```

### 5. API Health Monitoring

**Hook:** `useApiHealth`
Located: `/frontend/hooks/useApiHealth.ts`

Features:
- Monitors critical API endpoints every minute
- Tracks response time and status
- Provides overall health status (healthy, degraded, down)

**Component:** `ApiHealthIndicator`
Located: `/frontend/components/ApiHealthIndicator.tsx`

- Displays API connection status
- Shows response times for degraded endpoints
- Alerts user of connection issues

**Service Methods:**
```typescript
// Check health of specific endpoint
await xanoService.checkHealth('/auth/me');

// Get cached health status
const status = xanoService.getHealthStatus('/auth/me');
```

### 6. Role-Based Access Control (RBAC)

**Type Definition:**
```typescript
export type UserRole = 'rider' | 'driver' | 'admin';
```

**Backend Middleware:**

Admin-only endpoints check user role:
```xs
// Check if user is admin
db.get users {
  field_name = "id"
  field_value = $auth.id
  output = ["role"]
} as $current_user

precondition ($current_user.role == "admin") {
  error = "Access denied. Admin privileges required."
}
```

**Admin Endpoints:**

1. `GET /admin/users` - List all users (paginated)
2. `POST /admin/users/:user_id/status` - Update user account status

**Frontend Components:**

**RequireRole** - Conditional rendering based on role:
```tsx
<RequireRole user={user} roles="admin">
  <AdminPanel />
</RequireRole>

<RequireRole user={user} roles={['driver', 'admin']}>
  <DriverFeatures />
</RequireRole>
```

**RequirePermission** - Permission-based rendering (admin-specific):
```tsx
<RequirePermission user={user} permission="manage_users">
  <UserManagement />
</RequirePermission>
```

**RestrictedUI** - Generic restricted component:
```tsx
<RestrictedUI user={user} allowedRoles={['admin']}>
  <AdminButton />
</RestrictedUI>
```

**usePermissions Hook:**
```tsx
const { hasRole, hasPermission, isAdmin } = usePermissions(user);

if (hasRole('admin')) {
  // Show admin features
}

if (hasPermission('manage_users')) {
  // Show user management
}
```

**Service Methods:**
```typescript
// Check if user has role
xanoService.hasRole(user, 'admin');
xanoService.hasRole(user, ['admin', 'driver']);

// Check if user has permission
xanoService.hasPermission(user, 'manage_users');
```

### 7. Enhanced Error Handling

**Auth States:**
- `initializing` - Loading initial auth state
- `authenticated` - User is logged in with valid token
- `unauthenticated` - No user logged in
- `session_expired` - Token has expired
- `session_expiring` - Token will expire soon (< 1 hour)
- `refreshing` - Token refresh in progress

**Visual Indicators:**

**SessionStatusIndicator:**
- Green dot: Session Active
- Yellow dot: Session Expiring Soon
- Red dot: Session Expired
- Blue dot (pulsing): Refreshing Session
- Shows time remaining when authenticated

**ApiHealthIndicator:**
- Hidden when all endpoints are healthy
- Yellow warning when endpoints are degraded
- Red alert when endpoints are down
- Shows response times for problematic endpoints

## Implementation Checklist

### Backend
- [x] Create `revoked_tokens` table
- [x] Add `POST /auth/refresh` endpoint
- [x] Add `POST /auth/revoke` endpoint
- [x] Update `/auth/me` to check revoked tokens
- [x] Update `/switch-role` to check revoked tokens
- [x] Update `/trips/active` to check revoked tokens
- [ ] Update all other authenticated endpoints to check revoked tokens
- [x] Add admin role support
- [x] Create admin API endpoints
- [x] Add role-based access control middleware

### Frontend
- [x] Add token expiry tracking to types
- [x] Update `xanoService` with token refresh methods
- [x] Update `xanoService` with token revocation methods
- [x] Add health monitoring methods to `xanoService`
- [x] Create `AuthContext` with state management
- [x] Create `useApiHealth` hook
- [x] Create `SessionStatusIndicator` component
- [x] Create `ApiHealthIndicator` component
- [x] Create role-based access components
- [ ] Integrate AuthContext into App.tsx
- [ ] Add SessionStatusIndicator to main layout
- [ ] Add ApiHealthIndicator to main layout
- [ ] Update existing useAuth usage to useAuthContext
- [ ] Create admin dashboard UI
- [ ] Test session expiration flow
- [ ] Test token refresh flow
- [ ] Test role-based access

## Security Considerations

1. **Token Storage:** Tokens stored in localStorage with expiry timestamp
2. **Token Validation:** All authenticated endpoints validate token on server
3. **Token Revocation:** Logout revokes token on server to prevent reuse
4. **Session Monitoring:** Frontend actively monitors token expiration
5. **Automatic Refresh:** Tokens refreshed before expiration to maintain sessions
6. **Role Verification:** Server validates user role before granting access
7. **Audit Trail:** Revoked tokens table provides audit trail of session invalidations

## Testing Recommendations

1. **Session Expiration:**
   - Manually set token expiry to past time
   - Verify automatic logout occurs
   - Verify session expired message displays

2. **Token Refresh:**
   - Set token expiry to < 1 hour
   - Verify refresh is triggered automatically
   - Verify new token is saved and used

3. **Token Revocation:**
   - Logout and verify token is revoked
   - Try to use revoked token (should fail)
   - Verify error message for revoked token

4. **Role-Based Access:**
   - Login as rider, verify no admin access
   - Login as driver, verify driver features
   - Login as admin, verify all access granted
   - Test permission-based UI elements

5. **Health Monitoring:**
   - Disconnect network, verify down status
   - Restore network, verify recovery
   - Test with slow network (degraded status)

## Migration Notes

To use the new AuthContext throughout the app:

1. Wrap App component with AuthProvider:
```tsx
import { AuthProvider } from './contexts/AuthContext';

<AuthProvider>
  <App />
</AuthProvider>
```

2. Replace `useAuth()` with `useAuthContext()`:
```tsx
// Old
import { useAuth } from './hooks/useApi';
const { user, login, logout } = useAuth();

// New
import { useAuthContext } from './contexts/AuthContext';
const { user, authState, login, logout } = useAuthContext();
```

3. Add visual indicators to layout:
```tsx
import { SessionStatusIndicator } from './components/SessionStatusIndicator';
import { ApiHealthIndicator } from './components/ApiHealthIndicator';

<>
  <SessionStatusIndicator />
  <ApiHealthIndicator />
  <YourAppContent />
</>
```
