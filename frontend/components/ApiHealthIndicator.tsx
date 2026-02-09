import React from 'react';
import { useApiHealth } from '../hooks/useApiHealth';

export function ApiHealthIndicator(): React.ReactElement | null {
  const { healthStatus, isHealthy, isDegraded, isDown } = useApiHealth();

  // Don't show if everything is healthy
  if (isHealthy) {
    return null;
  }

  const getStatusColor = (): string => {
    if (isDown) return 'bg-red-500';
    if (isDegraded) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (): string => {
    if (isDown) return 'API Connection Issues';
    if (isDegraded) return 'Slow Connection';
    return 'Connected';
  };

  const getStatusIcon = (): string => {
    if (isDown) return '⚠️';
    if (isDegraded) return '⚡';
    return '✓';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`rounded-lg shadow-lg p-3 ${
        isDown ? 'bg-red-50 border-2 border-red-500' : 'bg-yellow-50 border-2 border-yellow-500'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-sm font-medium text-gray-800">
            {getStatusIcon()} {getStatusText()}
          </span>
        </div>
        
        {healthStatus.size > 0 && (
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            {Array.from(healthStatus.entries()).map(([endpoint, status]) => (
              status.status !== 'healthy' && (
                <div key={endpoint} className="flex justify-between">
                  <span className="truncate max-w-[150px]">{endpoint}</span>
                  <span className={`ml-2 ${
                    status.status === 'down' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {status.status === 'down' ? 'Down' : `${status.responseTime}ms`}
                  </span>
                </div>
              )
            ))}
          </div>
        )}
        
        {isDown && (
          <p className="text-xs text-red-700 mt-2">
            Please check your internet connection
          </p>
        )}
      </div>
    </div>
  );
}
