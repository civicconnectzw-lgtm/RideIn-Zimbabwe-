import React from 'react';
import { useAuthContext } from '../contexts/AuthContext';

export function SessionStatusIndicator(): React.ReactElement | null {
  const { authState, tokenExpiry, error } = useAuthContext();

  if (authState === 'unauthenticated' || authState === 'initializing') {
    return null;
  }

  const getStatusColor = (): string => {
    switch (authState) {
      case 'authenticated':
        return 'bg-green-500';
      case 'session_expiring':
        return 'bg-yellow-500';
      case 'session_expired':
        return 'bg-red-500';
      case 'refreshing':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (): string => {
    switch (authState) {
      case 'authenticated':
        return 'Session Active';
      case 'session_expiring':
        return 'Session Expiring Soon';
      case 'session_expired':
        return 'Session Expired';
      case 'refreshing':
        return 'Refreshing Session...';
      default:
        return 'Unknown';
    }
  };

  const getTimeRemaining = (): string | null => {
    if (!tokenExpiry) return null;
    
    const now = Date.now();
    const remaining = tokenExpiry - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const timeRemaining = getTimeRemaining();
  const showWarning = authState === 'session_expiring' || authState === 'session_expired';

  return (
    <div className={`fixed top-4 right-4 z-50 rounded-lg shadow-lg p-3 ${
      showWarning ? 'bg-white border-2 border-yellow-500' : 'bg-white/90 backdrop-blur'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${
          authState === 'refreshing' ? 'animate-pulse' : ''
        }`} />
        <span className="text-sm font-medium text-gray-800">
          {getStatusText()}
        </span>
        {timeRemaining && authState === 'authenticated' && (
          <span className="text-xs text-gray-600 ml-2">
            ({timeRemaining})
          </span>
        )}
      </div>
      {error && showWarning && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
