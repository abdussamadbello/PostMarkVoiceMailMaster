import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const startTime = performance.now();
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    const duration = performance.now() - startTime;
    
    // Track API performance
    if (typeof window !== 'undefined' && (window as any).performanceTracker) {
      (window as any).performanceTracker.trackApiRequest(url, duration);
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Track failed requests
    if (typeof window !== 'undefined' && (window as any).performanceTracker) {
      (window as any).performanceTracker.trackApiRequest(`${url}_error`, duration);
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Adaptive retry function based on network conditions
const adaptiveRetry = (failureCount: number, error: any) => {
  const maxRetries = 3;
  
  // Don't retry on 4xx errors (client errors)
  if (error?.message?.includes('4')) {
    return false;
  }
  
  // Check network quality for retry strategy
  const connectionQuality = typeof window !== 'undefined' && (window as any).performanceTracker 
    ? (window as any).performanceTracker.getConnectionQuality() 
    : 'excellent';
  
  if (connectionQuality === 'offline') {
    return false;
  }
  
  if (connectionQuality === 'poor') {
    return failureCount < 2; // Fewer retries on poor connection
  }
  
  return failureCount < maxRetries;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: adaptiveRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: adaptiveRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
