import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, AuthState, AuthContextValue } from '../types';
import { xanoService } from '../services/xano';
import { ablyService } from '../services/ably';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('initializing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  
  const sessionCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshAttempted = useRef(false);

  const handleLogout = useCallback(() => {
    setUser(null);
    setError(null);
    setAuthState('unauthenticated');
    setTokenExpiry(null);
    refreshAttempted.current = false;
    xanoService.logout();
  }, []);

  const handleTokenRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshAttempted.current) return false;
    
    refreshAttempted.current = true;
    setAuthState('refreshing');
    
    try {
      const success = await xanoService.refreshToken();
      if (success) {
        console.log('[Auth] Token refreshed successfully');
        setAuthState('authenticated');
        setTokenExpiry(xanoService.getTokenExpiry());
        
        // Refresh user data
        const currentUser = await xanoService.getMe();
        if (currentUser) {
          setUser(currentUser);
        }
        return true;
      } else {
        console.error('[Auth] Token refresh failed');
        setAuthState('session_expired');
        setError('Your session has expired. Please log in again.');
        handleLogout();
        return false;
      }
    } catch (err) {
      console.error('[Auth] Token refresh error', err);
      setAuthState('session_expired');
      setError('Your session has expired. Please log in again.');
      handleLogout();
      return false;
    } finally {
      refreshAttempted.current = false;
    }
  }, [handleLogout]);

  // Monitor token expiration
  const checkTokenExpiration = useCallback(() => {
    if (!user) return;

    const expiry = xanoService.getTokenExpiry();
    if (!expiry) {
      setAuthState('session_expired');
      handleLogout();
      return;
    }

    setTokenExpiry(expiry);

    if (xanoService.isTokenExpired()) {
      console.log('[Auth] Token expired, logging out');
      setAuthState('session_expired');
      setError('Your session has expired. Please log in again.');
      handleLogout();
    } else if (xanoService.isTokenExpiring() && !refreshAttempted.current) {
      console.log('[Auth] Token expiring soon, attempting refresh');
      setAuthState('session_expiring');
      handleTokenRefresh();
    }
  }, [user, handleLogout, handleTokenRefresh]);

  // Session restoration on mount
  useEffect(() => {
    const controller = new AbortController();

    const initAuth = async () => {
      try {
        const token = localStorage.getItem('ridein_auth_token');
        if (!token) {
          setAuthState('unauthenticated');
          return;
        }

        // Check if token is expired before attempting to fetch user
        if (xanoService.isTokenExpired()) {
          console.log('[Auth] Token expired on init, clearing session');
          localStorage.removeItem('ridein_auth_token');
          localStorage.removeItem('ridein_token_expiry');
          localStorage.removeItem('ridein_user_cache');
          setAuthState('unauthenticated');
          return;
        }

        // Attempt to fetch current user
        const currentUser = await xanoService.getMe().catch((err) => {
          // Only use cached user for network errors, not auth errors
          if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
            return null;
          }
          // For auth errors or other issues, clear the token and don't use cache
          localStorage.removeItem('ridein_auth_token');
          localStorage.removeItem('ridein_token_expiry');
          throw err;
        });
        
        if (!controller.signal.aborted) {
          if (currentUser?.id) {
            // Valid user retrieved from API
            setUser(currentUser);
            setAuthState('authenticated');
            setTokenExpiry(xanoService.getTokenExpiry());
            ablyService.connect(currentUser.id);
          } else {
            // Fallback to cached user only for network errors (when token exists)
            const token = localStorage.getItem('ridein_auth_token');
            if (token) {
              const cached = localStorage.getItem('ridein_user_cache');
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  setUser(parsed);
                  setAuthState('authenticated');
                  setTokenExpiry(xanoService.getTokenExpiry());
                  ablyService.connect(parsed.id);
                } catch (e) {
                  console.error('[Auth] Failed to parse cached user', e);
                  setAuthState('unauthenticated');
                }
              }
            } else {
              setAuthState('unauthenticated');
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[Auth] Initialization error', err);
          // Clear invalid session data
          localStorage.removeItem('ridein_auth_token');
          localStorage.removeItem('ridein_token_expiry');
          localStorage.removeItem('ridein_user_cache');
          setUser(null);
          setAuthState('unauthenticated');
        }
      }
    };

    initAuth();

    return () => controller.abort();
  }, []);

  // Set up session monitoring interval
  useEffect(() => {
    if (authState === 'authenticated' && user) {
      // Check token expiration every 30 seconds
      sessionCheckInterval.current = setInterval(checkTokenExpiration, 30000);
      
      // Also check immediately
      checkTokenExpiration();
    }

    return () => {
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
        sessionCheckInterval.current = null;
      }
    };
  }, [authState, user, checkTokenExpiration]);

  const login = useCallback(async (phone: string, pin: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    setAuthState('initializing');
    try {
      const loggedInUser = await xanoService.login(phone, pin);
      setUser(loggedInUser);
      setAuthState('authenticated');
      setTokenExpiry(xanoService.getTokenExpiry());
      ablyService.connect(loggedInUser.id);
      refreshAttempted.current = false;
      return loggedInUser;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setAuthState('unauthenticated');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (userData: Partial<User>, pin: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    setAuthState('initializing');
    try {
      const newUser = await xanoService.signup(userData, pin);
      setUser(newUser);
      setAuthState('authenticated');
      setTokenExpiry(xanoService.getTokenExpiry());
      ablyService.connect(newUser.id);
      refreshAttempted.current = false;
      return newUser;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      setAuthState('unauthenticated');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (phone: string): Promise<{ message: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await xanoService.requestPasswordReset(phone);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset request failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const completePasswordReset = useCallback(async (
    phone: string,
    code: string,
    newPassword: string
  ): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const resetUser = await xanoService.completePasswordReset(phone, code, newPassword);
      setUser(resetUser);
      setAuthState('authenticated');
      setTokenExpiry(xanoService.getTokenExpiry());
      ablyService.connect(resetUser.id);
      refreshAttempted.current = false;
      return resetUser;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const switchRole = useCallback(async (role: UserRole): Promise<User | null> => {
    if (!user) {
      setError('No user logged in');
      return null;
    }
    
    setLoading(true);
    setError(null);
    try {
      const updatedUser = await xanoService.switchRole(user.id, role);
      setUser(updatedUser);
      return updatedUser;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Role switch failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshUser = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await xanoService.getMe();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh user';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    authState,
    loading,
    error,
    tokenExpiry,
    login,
    signup,
    logout: handleLogout,
    refreshToken: handleTokenRefresh,
    requestPasswordReset,
    completePasswordReset,
    switchRole,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
