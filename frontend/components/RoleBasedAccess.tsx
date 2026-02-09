import React from 'react';
import { User, UserRole } from '../types';
import { xanoService } from '../services/xano';

interface RequireRoleProps {
  user: User | null;
  roles: UserRole | UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user role
 */
export function RequireRole({ user, roles, children, fallback = null }: RequireRoleProps): React.ReactElement | null {
  if (!xanoService.hasRole(user, roles)) {
    return fallback as React.ReactElement | null;
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  user: User | null;
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on admin permission
 */
export function RequirePermission({ user, permission, children, fallback = null }: RequirePermissionProps): React.ReactElement | null {
  if (!xanoService.hasPermission(user, permission)) {
    return fallback as React.ReactElement | null;
  }

  return <>{children}</>;
}

interface RestrictedUIProps {
  user: User | null;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
  children: React.ReactNode;
}

/**
 * Generic component for restricting UI elements based on role or permission
 */
export function RestrictedUI({ user, allowedRoles, requiredPermission, children }: RestrictedUIProps): React.ReactElement | null {
  // Check role-based access
  if (allowedRoles && !xanoService.hasRole(user, allowedRoles)) {
    return null;
  }

  // Check permission-based access
  if (requiredPermission && !xanoService.hasPermission(user, requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}

// Utility hook for checking permissions in component logic
export function usePermissions(user: User | null) {
  return {
    hasRole: (roles: UserRole | UserRole[]) => xanoService.hasRole(user, roles),
    hasPermission: (permission: string) => xanoService.hasPermission(user, permission),
    isAdmin: user?.role === 'admin',
    isDriver: user?.role === 'driver',
    isRider: user?.role === 'rider',
  };
}
