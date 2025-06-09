import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Volume2, VolumeX, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface VoiceQuotaStatus {
  charactersUsed: number;
  charactersLimit: number;
  charactersRemaining: number;
  percentageUsed: number;
  status: 'available' | 'low' | 'exceeded' | 'unavailable';
  message?: string;
  lastChecked: string;
}

interface VoiceStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export default function VoiceStatusIndicator({ 
  className = "", 
  showDetails = false 
}: VoiceStatusIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: quotaStatus, isLoading, refetch } = useQuery<VoiceQuotaStatus>({
    queryKey: ['/api/voice/quota'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    retry: 1,
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'low': return 'bg-yellow-500';
      case 'exceeded': return 'bg-red-500';
      case 'unavailable': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'available': return 'ElevenLabs Available';
      case 'low': return 'ElevenLabs Low';
      case 'exceeded': return 'Browser Voice Active';
      case 'unavailable': return 'Voice Status Unknown';
      default: return 'Checking Voice Status';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'available': return <Volume2 className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
      case 'exceeded': return <VolumeX className="h-3 w-3" />;
      case 'unavailable': return <Info className="h-3 w-3" />;
      default: return <Volume2 className="h-3 w-3" />;
    }
  };

  if (isLoading || !quotaStatus) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        {showDetails && <span className="text-xs text-muted-foreground">Checking voice status...</span>}
      </div>
    );
  }

  const indicator = (
    <div className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${className}`}>
      <div className={`w-2 h-2 ${getStatusColor(quotaStatus.status)} rounded-full`}></div>
      {showDetails && (
        <span className="text-xs text-muted-foreground">
          {getStatusText(quotaStatus.status)}
        </span>
      )}
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {indicator}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              {getStatusIcon(quotaStatus.status)}
              Voice Service Status
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>ElevenLabs Usage</span>
              <span className="font-mono">
                {quotaStatus.charactersUsed?.toLocaleString()} / {quotaStatus.charactersLimit?.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={quotaStatus.percentageUsed || 0} 
              className="h-2" 
            />
            <div className="text-xs text-muted-foreground">
              {quotaStatus.charactersRemaining?.toLocaleString()} characters remaining
            </div>
          </div>

          <div className="space-y-2">
            <Badge 
              variant={quotaStatus.status === 'available' ? 'default' : 
                      quotaStatus.status === 'low' ? 'secondary' : 'destructive'}
              className="w-full justify-center"
            >
              {getStatusText(quotaStatus.status)}
            </Badge>
            
            {quotaStatus.message && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                {quotaStatus.message}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="space-y-1">
              <div>• <strong>Green:</strong> ElevenLabs AI voice available</div>
              <div>• <strong>Yellow:</strong> ElevenLabs quota running low</div>
              <div>• <strong>Red:</strong> Using browser speech synthesis</div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}