import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, Signal, SignalHigh, SignalMedium, SignalLow } from "lucide-react";
import { usePerformanceMonitor } from "@/hooks/use-performance-monitor";

export default function ConnectionStatus() {
  const { getConnectionQuality, getMemoryPressure, shouldOptimizeForPerformance } = usePerformanceMonitor();
  
  const connectionQuality = getConnectionQuality();
  const memoryPressure = getMemoryPressure();
  const optimize = shouldOptimizeForPerformance();
  
  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'offline':
        return <WifiOff className="h-3 w-3" />;
      case 'poor':
        return <SignalLow className="h-3 w-3" />;
      case 'good':
        return <SignalMedium className="h-3 w-3" />;
      case 'excellent':
        return <SignalHigh className="h-3 w-3" />;
      default:
        return <Signal className="h-3 w-3" />;
    }
  };
  
  const getConnectionVariant = () => {
    switch (connectionQuality) {
      case 'offline':
        return 'destructive';
      case 'poor':
        return 'destructive';
      case 'good':
        return 'secondary';
      case 'excellent':
        return 'default';
      default:
        return 'outline';
    }
  };
  
  const getMemoryVariant = () => {
    switch (memoryPressure) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };
  
  const getStatusText = () => {
    if (connectionQuality === 'offline') {
      return 'Offline';
    }
    
    if (optimize) {
      return 'Optimizing';
    }
    
    switch (connectionQuality) {
      case 'poor':
        return 'Slow';
      case 'good':
        return 'Good';
      case 'excellent':
        return 'Excellent';
      default:
        return 'Connected';
    }
  };
  
  const getTooltipContent = () => {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium">Connection Status</div>
        <div className="text-xs">
          Network: {connectionQuality}
          <br />
          Memory: {memoryPressure} pressure
          {optimize && (
            <>
              <br />
              <span className="text-yellow-400">Performance mode active</span>
            </>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Badge 
            variant={getConnectionVariant() as any} 
            className="gap-1 text-xs cursor-help"
          >
            {getConnectionIcon()}
            {getStatusText()}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}