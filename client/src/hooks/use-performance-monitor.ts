import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  apiRequestTimes: Map<string, number[]>;
  componentRenderTimes: Map<string, number>;
  memoryUsage: number[];
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

export function usePerformanceMonitor() {
  const metricsRef = useRef<PerformanceMetrics>({
    apiRequestTimes: new Map(),
    componentRenderTimes: new Map(),
    memoryUsage: [],
    connectionQuality: 'excellent'
  });

  useEffect(() => {
    // Monitor network quality
    const updateConnectionQuality = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        const { effectiveType, downlink } = connection;
        if (downlink > 10 || effectiveType === '4g') {
          metricsRef.current.connectionQuality = 'excellent';
        } else if (downlink > 1.5 || effectiveType === '3g') {
          metricsRef.current.connectionQuality = 'good';
        } else {
          metricsRef.current.connectionQuality = 'poor';
        }
      }
    };

    // Monitor memory usage
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usage = (memInfo.usedJSHeapSize / memInfo.totalJSHeapSize) * 100;
        metricsRef.current.memoryUsage.push(usage);
        
        // Keep only last 10 measurements
        if (metricsRef.current.memoryUsage.length > 10) {
          metricsRef.current.memoryUsage.shift();
        }
      }
    };

    // Check online status
    const updateOnlineStatus = () => {
      if (!navigator.onLine) {
        metricsRef.current.connectionQuality = 'offline';
      } else {
        updateConnectionQuality();
      }
    };

    // Initial checks
    updateConnectionQuality();
    updateOnlineStatus();
    monitorMemory();

    // Set up listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Monitor periodically
    const interval = setInterval(() => {
      updateConnectionQuality();
      monitorMemory();
    }, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  const trackApiRequest = (endpoint: string, duration: number) => {
    const times = metricsRef.current.apiRequestTimes.get(endpoint) || [];
    times.push(duration);
    
    // Keep only last 10 measurements per endpoint
    if (times.length > 10) {
      times.shift();
    }
    
    metricsRef.current.apiRequestTimes.set(endpoint, times);
  };

  const trackComponentRender = (componentName: string, duration: number) => {
    metricsRef.current.componentRenderTimes.set(componentName, duration);
  };

  const getAverageApiTime = (endpoint: string): number => {
    const times = metricsRef.current.apiRequestTimes.get(endpoint) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  };

  const getConnectionQuality = () => metricsRef.current.connectionQuality;

  const getMemoryPressure = (): 'low' | 'medium' | 'high' => {
    const recent = metricsRef.current.memoryUsage.slice(-3);
    if (recent.length === 0) return 'low';
    
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (avg > 80) return 'high';
    if (avg > 60) return 'medium';
    return 'low';
  };

  const shouldOptimizeForPerformance = (): boolean => {
    const connectionQuality = getConnectionQuality();
    const memoryPressure = getMemoryPressure();
    
    return connectionQuality === 'poor' || 
           connectionQuality === 'offline' || 
           memoryPressure === 'high';
  };

  return {
    trackApiRequest,
    trackComponentRender,
    getAverageApiTime,
    getConnectionQuality,
    getMemoryPressure,
    shouldOptimizeForPerformance,
    metrics: metricsRef.current
  };
}