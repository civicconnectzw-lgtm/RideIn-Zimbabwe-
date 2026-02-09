import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiHealthStatus } from '../types';
import { xanoService } from '../services/xano';

interface UseApiHealthReturn {
  healthStatus: Map<string, ApiHealthStatus>;
  checkHealth: (endpoint?: string) => Promise<void>;
  isHealthy: boolean;
  isDegraded: boolean;
  isDown: boolean;
}

const HEALTH_CHECK_INTERVAL = 60000; // Check every minute
const CRITICAL_ENDPOINTS = ['/auth/me', '/trips/active'];

export function useApiHealth(): UseApiHealthReturn {
  const [healthStatus, setHealthStatus] = useState<Map<string, ApiHealthStatus>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async (endpoint?: string) => {
    const endpointsToCheck = endpoint ? [endpoint] : CRITICAL_ENDPOINTS;
    
    for (const ep of endpointsToCheck) {
      try {
        const result = await xanoService.checkHealth(ep);
        setHealthStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(ep, {
            endpoint: ep,
            status: result.status,
            lastChecked: Date.now(),
            responseTime: result.responseTime,
          });
          return newMap;
        });
      } catch (err) {
        setHealthStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(ep, {
            endpoint: ep,
            status: 'down',
            lastChecked: Date.now(),
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          });
          return newMap;
        });
      }
    }
  }, []);

  // Periodic health checks
  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(() => {
      checkHealth();
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth]);

  // Compute overall health status
  const statuses = Array.from(healthStatus.values());
  const isHealthy = statuses.every(s => s.status === 'healthy');
  const isDegraded = statuses.some(s => s.status === 'degraded') && !statuses.some(s => s.status === 'down');
  const isDown = statuses.some(s => s.status === 'down');

  return {
    healthStatus,
    checkHealth,
    isHealthy,
    isDegraded,
    isDown,
  };
}
