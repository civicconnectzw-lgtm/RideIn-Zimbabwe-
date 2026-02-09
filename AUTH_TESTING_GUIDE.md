# Authentication Testing Guide

## Overview
This guide provides comprehensive testing instructions for the enhanced authentication flow in the RideIn-Zimbabwe application.

---

## 🎯 Test Scenarios

### 1. Login Flow Testing

#### Test 1.1: Successful Login
**Objective**: Verify that users can log in with valid credentials

**Steps**:
1. Navigate to the login page
2. Enter valid phone number (e.g., +263771234567)
3. Enter correct password
4. Click login button

**Expected Results**:
- ✅ User successfully logged in
- ✅ Token stored in localStorage as `ridein_auth_token`
- ✅ User data cached in localStorage as `ridein_user_cache`
- ✅ User redirected to appropriate home view (rider/driver)
- ✅ Backend log: "Login successful for user: [name] (ID: [id])"

**Verify in Console**:
```javascript
localStorage.getItem('ridein_auth_token') // Should return token
localStorage.getItem('ridein_user_cache')  // Should return user JSON
```

---

#### Test 1.2: Invalid Credentials
**Objective**: Verify proper error handling for incorrect passwords

**Steps**:
1. Navigate to the login page
2. Enter valid phone number
3. Enter incorrect password
4. Click login button

**Expected Results**:
- ❌ Login fails
- ✅ Error message displayed: "Invalid credentials. Please check your phone number and password."
- ✅ No token stored in localStorage
- ✅ User remains on login page
- ✅ Backend log: "Login attempt for phone: [phone]" (but no success log)

**Verify in Console**:
```javascript
localStorage.getItem('ridein_auth_token') // Should return null
```

---

#### Test 1.3: Non-existent User
**Objective**: Verify error handling for users that don't exist

**Steps**:
1. Navigate to the login page
2. Enter phone number that doesn't exist
3. Enter any password
4. Click login button

**Expected Results**:
- ❌ Login fails
- ✅ Error message: "Invalid credentials. Please check your phone number and password."
- ✅ No token stored
- ✅ Backend log shows login attempt but no user found

---

### 2. Session Validation Testing

#### Test 2.1: Valid Session Restoration
**Objective**: Verify that valid sessions are restored on page reload

**Steps**:
1. Log in successfully
2. Reload the page
3. Wait for app to initialize

**Expected Results**:
- ✅ User session restored automatically
- ✅ User data retrieved from backend via `/auth/me`
- ✅ User redirected to home view (no login screen shown)
- ✅ Backend log: "Token validation request for user ID: [id]"
- ✅ Backend log: "Token validated successfully for user: [name]"

---

#### Test 2.2: Invalid Token Cleanup
**Objective**: Verify that invalid tokens are cleaned up properly

**Steps**:
1. Open browser console
2. Manually set an invalid token:
   ```javascript
   localStorage.setItem('ridein_auth_token', 'invalid_token_xyz')
   ```
3. Reload the page

**Expected Results**:
- ✅ Invalid token detected
- ✅ Token removed from localStorage
- ✅ User cache removed from localStorage
- ✅ User redirected to login page
- ✅ Console log: "[Auth] Failed to validate session"

---

#### Test 2.3: Session Expiration (24 hours)
**Objective**: Verify proper handling of expired tokens

**Note**: This test requires waiting 24 hours or manipulating token expiration time on backend

**Steps**:
1. Log in successfully
2. Wait for token to expire (24 hours) OR manually expire on backend
3. Make any authenticated API call (e.g., navigate to home)

**Expected Results**:
- ✅ 401 error received from backend
- ✅ Automatic logout triggered
- ✅ Error message: "Your session has expired. Please log in again."
- ✅ Token and cache cleared from localStorage
- ✅ User redirected to login page
- ✅ Console log: "[Auth] Session expired or invalid token detected"

---

### 3. Role-Based Access Control Testing

#### Test 3.1: Driver Accessing Driver Endpoints
**Objective**: Verify approved drivers can access driver-specific endpoints

**Steps**:
1. Log in as an approved driver
2. Navigate to driver home view
3. Try to view available trips

**Expected Results**:
- ✅ Request successful
- ✅ Available trips displayed
- ✅ Backend log: "Driver trips request from user ID: [id] (role: driver)"
- ✅ No access denied errors

---

#### Test 3.2: Rider Accessing Driver Endpoints
**Objective**: Verify riders cannot access driver-specific endpoints

**Steps**:
1. Log in as a rider
2. Using browser console, manually call driver endpoint:
   ```javascript
   fetch('/.netlify/functions/xano/driver/trips/available?lat=-17.8&lng=31.0&radius=50', {
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('ridein_auth_token')
     }
   })
   ```

**Expected Results**:
- ❌ Request fails with 403 error
- ✅ Error message: "Access denied. Only drivers can access this resource."
- ✅ Backend log: "Driver trips request from user ID: [id] (role: rider)"
- ✅ No data returned

---

#### Test 3.3: Unapproved Driver Access
**Objective**: Verify unapproved drivers cannot access certain driver features

**Steps**:
1. Log in as driver with `driver_approved = false`
2. Try to view available trips

**Expected Results**:
- ❌ Request fails with 403 error
- ✅ Error message: "Access denied. Driver profile must be approved to access trips."
- ✅ Pending approval view shown
- ✅ Cannot submit bids on trips

---

### 4. Role Switching Testing

#### Test 4.1: Successful Role Switch (Rider to Driver)
**Objective**: Verify approved drivers can switch from rider to driver role

**Pre-requisites**: User must have complete driver profile and be approved

**Steps**:
1. Log in as rider (user who is also an approved driver)
2. Click on role switcher
3. Select "Switch to Driver"

**Expected Results**:
- ✅ Role successfully changed to driver
- ✅ UI updates to show driver home view
- ✅ User's `isOnline` status set to true
- ✅ Backend log: "Role switch attempt for user ID: [id] to role: driver"
- ✅ Backend log: "Role switch validated for user: [name] from rider to driver"

---

#### Test 4.2: Failed Role Switch (Unapproved Driver)
**Objective**: Verify unapproved drivers cannot switch to driver role

**Steps**:
1. Log in as rider with incomplete driver profile
2. Try to switch to driver role

**Expected Results**:
- ❌ Role switch fails
- ✅ Error message: "Driver profile not complete or not approved."
- ✅ User remains in rider role
- ✅ No UI change

---

#### Test 4.3: Successful Role Switch (Driver to Rider)
**Objective**: Verify drivers can switch back to rider role

**Steps**:
1. Log in as driver
2. Click on role switcher
3. Select "Switch to Rider"

**Expected Results**:
- ✅ Role successfully changed to rider
- ✅ UI updates to show rider home view
- ✅ User's `isOnline` status set to false
- ✅ Backend log: "Role switch validated for user: [name] from driver to rider"

---

### 5. Logout Testing

#### Test 5.1: Manual Logout
**Objective**: Verify manual logout clears all session data

**Steps**:
1. Log in successfully
2. Click logout button
3. Verify localStorage

**Expected Results**:
- ✅ User logged out
- ✅ Token removed: `localStorage.getItem('ridein_auth_token')` returns null
- ✅ Cache removed: `localStorage.getItem('ridein_user_cache')` returns null
- ✅ User redirected to login page
- ✅ Ably connection disconnected
- ✅ Console log: "[Auth] Logging out user, clearing session data"

---

### 6. Token Management Testing

#### Test 6.1: Token Storage Validation
**Objective**: Verify only valid tokens are stored

**Steps**:
1. Open browser console
2. Try to manually trigger saveSession with invalid data:
   ```javascript
   // This should fail - test via code inspection
   xanoService.saveSession(undefined, { name: 'Test' })
   ```

**Expected Results**:
- ✅ Error thrown: "Invalid authentication token received"
- ✅ No token stored in localStorage
- ✅ Console error: "[Auth] Invalid token received, not saving session"

---

#### Test 6.2: User Data Validation
**Objective**: Verify only valid user objects are stored

**Steps**:
1. Similar to 6.1, but with invalid user object
   ```javascript
   xanoService.saveSession('valid-token', null)
   ```

**Expected Results**:
- ✅ Error thrown: "Invalid user data received"
- ✅ No user data stored
- ✅ Console error: "[Auth] Invalid user received, not saving session"

---

### 7. Error Handling Testing

#### Test 7.1: Network Error During Login
**Objective**: Verify graceful handling of network failures

**Steps**:
1. Disconnect from internet
2. Try to log in
3. Verify error handling

**Expected Results**:
- ❌ Login fails
- ✅ Appropriate network error message shown
- ✅ No crashes or undefined errors
- ✅ Retry logic may attempt to reconnect

---

#### Test 7.2: Server Error (500) Handling
**Objective**: Verify server errors are handled gracefully

**Steps**:
1. Simulate 500 error from backend (if possible)
2. Observe frontend behavior

**Expected Results**:
- ✅ User-friendly error message displayed
- ✅ No sensitive data exposed in error
- ✅ Retry mechanism activated (with exponential backoff)

---

### 8. Security Testing

#### Test 8.1: XSS Prevention in Error Messages
**Objective**: Verify error messages don't execute scripts

**Steps**:
1. Try to log in with phone: `<script>alert('xss')</script>`
2. Observe error message rendering

**Expected Results**:
- ✅ Script tags displayed as text, not executed
- ✅ No JavaScript alert shown
- ✅ Error message safely rendered

---

#### Test 8.2: Password Not Logged
**Objective**: Verify passwords are never logged

**Steps**:
1. Enable browser console logging
2. Log in with credentials
3. Review all console logs and network requests

**Expected Results**:
- ✅ Password never appears in console logs
- ✅ Password not visible in network request logs
- ✅ Backend logs don't contain password

---

#### Test 8.3: Sensitive Data Sanitization
**Objective**: Verify sensitive fields are excluded from responses

**Steps**:
1. Log in successfully
2. Check user data in localStorage
3. Check API responses in network tab

**Expected Results**:
- ✅ No `email` field in responses
- ✅ No `password` field in user data
- ✅ User cache only contains safe fields
- ✅ Console log: Sanitized response excludes forbidden keys

---

## 🔍 Debugging Tips

### Frontend Debugging

**Check Token Status**:
```javascript
// In browser console
const token = localStorage.getItem('ridein_auth_token');
console.log('Token exists:', !!token);
console.log('Token value:', token);
```

**Check User Cache**:
```javascript
const cache = localStorage.getItem('ridein_user_cache');
console.log('Cached user:', JSON.parse(cache));
```

**Monitor Auth Events**:
```javascript
// Look for console logs with [Auth] prefix
// Filter console by: [Auth]
```

### Backend Debugging

**Check Xano Logs**:
1. Go to Xano dashboard
2. Navigate to Logs section
3. Filter by log level: "info"
4. Search for specific messages:
   - "Login attempt"
   - "Token validation"
   - "Role switch"

**Common Log Messages**:
```
✅ Success: "Token validated successfully for user: John Doe (ID: 123)"
❌ Failure: "User not found or session invalid"
⚠️  Warning: "Driver profile not complete or not approved"
```

---

## 📊 Test Coverage Checklist

Use this checklist to ensure comprehensive testing:

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Login with non-existent user
- [ ] Logout functionality
- [ ] Session restoration on page reload
- [ ] Invalid token cleanup

### Authorization
- [ ] Driver can access driver endpoints
- [ ] Rider cannot access driver endpoints
- [ ] Unapproved driver denied access
- [ ] Role-based view rendering

### Role Switching
- [ ] Approved driver can switch to driver role
- [ ] Driver can switch back to rider role
- [ ] Unapproved driver cannot switch
- [ ] Same role switch prevention

### Error Handling
- [ ] Network error handling
- [ ] Server error handling
- [ ] Invalid token handling
- [ ] Session expiration handling
- [ ] Access denied (403) handling

### Security
- [ ] Passwords not logged
- [ ] Sensitive data sanitized
- [ ] XSS prevention
- [ ] Token validation
- [ ] Proper HTTP status codes

### Logging
- [ ] Login attempts logged
- [ ] Token validation logged
- [ ] Role switches logged
- [ ] Access denials logged

---

## 🚨 Known Issues

### Current Limitations
1. **No Token Refresh**: Tokens expire after 24 hours, requiring full re-login
2. **No Session Warning**: No warning before session expires
3. **No Token Blacklist**: Logged out tokens not invalidated server-side

### Workarounds
- For token refresh: Plan for future implementation
- For session warnings: Can be added as future enhancement
- For token blacklist: Backend feature to be implemented

---

## 📝 Test Execution Log Template

Use this template to log test results:

```markdown
## Test Execution - [Date]

**Tester**: [Name]
**Environment**: [Dev/Staging/Production]
**Browser**: [Chrome/Firefox/Safari/etc.]

### Test Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Successful Login | ✅ Pass | |
| 1.2 | Invalid Credentials | ✅ Pass | |
| 1.3 | Non-existent User | ✅ Pass | |
| 2.1 | Valid Session Restoration | ✅ Pass | |
| ... | ... | ... | ... |

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
1. [Recommendation]
2. [Recommendation]
```

---

**Last Updated**: February 8, 2026  
**Version**: 1.0.0  
**Maintained By**: Development Team
