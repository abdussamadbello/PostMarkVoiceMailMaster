import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mic, Volume2, Square, Loader2, Keyboard } from "lucide-react";

interface VoiceControlPanelProps {
  onVoiceCommand: (command: string) => void;
  onPlayAudio: (text: string, title: string) => void;
  onTabSwitch?: (tab: 'all' | 'unread' | 'important' | 'archived') => void;
}

export default function VoiceControlPanel({ onVoiceCommand, onPlayAudio, onTabSwitch }: VoiceControlPanelProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const playElevenLabsAudio = async (text: string) => {
    try {
      const response = await apiRequest("POST", "/api/voice/speak", { text });
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
      }
    } catch (error) {
      console.error('ElevenLabs audio playback failed:', error);
      // Fallback to Web Speech API
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        speechSynthesis.speak(utterance);
      }
    }
  };

  const processCommandMutation = useMutation({
    mutationFn: async (transcript: string) => {
      const response = await apiRequest("POST", "/api/voice/command", { transcript });
      return response.json();
    },
    onSuccess: (data) => {
      setIsExecuting(false);
      resetProcessing();
      
      // Handle tab switching
      if (data.switchTab && onTabSwitch) {
        onTabSwitch(data.switchTab);
      }
      
      if (data.summary) {
        toast({
          title: "Command Executed",
          description: data.summary,
        });
        
        // Generate high-quality speech response using ElevenLabs
        playElevenLabsAudio(data.summary);
        
        // If there are emails to read, also play them via audio player
        if (data.emails && data.emails.length > 0 && data.summary) {
          onPlayAudio(data.summary, `Email Summary (${data.emails.length} emails)`);
        }
      }
      
      // Refresh emails if the command affected them
      if (data.emails || data.intent?.action === 'mark_as_read') {
        queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      }
    },
    onError: (error) => {
      setIsExecuting(false);
      resetProcessing();
      toast({
        title: "Command Failed",
        description: "Failed to process voice command. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVoiceCommand = (command: string) => {
    setIsExecuting(true);
    processCommandMutation.mutate(command);
    // Reset processing state to allow next voice command
    setTimeout(() => {
      resetProcessing();
    }, 500);
  };

  const {
    isListening,
    isProcessing,
    transcript,
    startListening,
    stopListening,
    resetProcessing,
    voiceLevel
  } = useVoiceRecognition(handleVoiceCommand);

  const handleVoiceToggle = () => {
    console.log('Voice button clicked', { isListening, isProcessing, isExecuting });
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const isActive = isListening || isProcessing || isExecuting;

  // Add keyboard shortcut for voice activation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === ' ' && !isActive) {
        event.preventDefault();
        handleVoiceToggle();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isActive]);

  const quickCommands = [
    "Switch to unread tab",
    "Go to important emails",
    "Show archived emails",
    "Restore all archived emails",
    "Mark all as unread",
    "Remove important flags",
    "Archive all emails",
    "Switch to all emails"
  ];

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 lg:p-6 lg:sticky lg:top-24" data-voice-panel>
      <div className="text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
            <Keyboard className="h-3 w-3 mr-1" />
            Ctrl+Space
          </Badge>
        </div>
        
        {/* Enhanced Voice Recording Interface */}
        <div className="mb-6">
          {/* Recording Status */}
          <div className="mb-4">
            {isListening && (
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-destructive">RECORDING</span>
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
              </div>
            )}
            
            {/* Voice Level Indicator */}
            {isListening && (
              <div className="mb-3">
                <Progress 
                  value={voiceLevel} 
                  className="h-2 bg-secondary" 
                />
                <p className="text-xs text-muted-foreground mt-1">Voice Level</p>
              </div>
            )}
          </div>

          {/* Main Voice Button with enhanced visual feedback */}
          <div className="relative">
            {/* Multiple pulsing rings for recording state */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-destructive opacity-25 voice-recording-ring"></div>
                <div className="absolute inset-0 rounded-full bg-destructive opacity-15 voice-recording-ring" style={{animationDelay: '0.5s'}}></div>
              </>
            )}
            
            <Button
              onClick={handleVoiceToggle}
              disabled={isProcessing || isExecuting}
              size="lg"
              className={`relative w-20 h-20 lg:w-24 lg:h-24 rounded-full text-xl lg:text-2xl transition-all duration-300 shadow-lg border-4 ${
                isListening 
                  ? 'bg-destructive hover:bg-destructive/90 scale-110 border-destructive/30 shadow-destructive/50' 
                  : isExecuting || isProcessing
                    ? 'bg-orange-500 hover:bg-orange-600 border-orange-300'
                    : 'bg-primary hover:bg-primary/90 hover:scale-105 border-primary/30'
              }`}
            >
              {isListening ? (
                <div className="flex items-center justify-center">
                  <Square className="h-6 w-6 lg:h-8 lg:w-8 animate-pulse" />
                </div>
              ) : isExecuting || isProcessing ? (
                <Loader2 className="h-6 w-6 lg:h-8 lg:w-8 animate-spin" />
              ) : (
                <Mic className="h-6 w-6 lg:h-8 lg:w-8" />
              )}
            </Button>
          </div>
          
          {/* Enhanced status messages */}
          <div className="mt-4">
            <p className={`text-sm font-medium text-center ${
              isListening ? 'text-destructive' : 
              isProcessing || isExecuting ? 'text-orange-600' : 
              'text-muted-foreground'
            }`}>
              {isExecuting 
                ? '🤖 Processing your request...' 
                : isProcessing 
                  ? '🧠 Understanding your command...' 
                  : isListening 
                    ? '🎤 Speak now - I\'m listening!' 
                    : '💬 Click to start voice command'}
            </p>
            
            {/* Live transcript display */}
            {transcript && (
              <div className="mt-3 p-3 bg-secondary rounded-lg">
                <p className="text-sm text-secondary-foreground">
                  <span className="font-medium">You said:</span> "{transcript}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Commands Section */}
        <div className="text-left">
          <h3 className="text-sm font-medium text-foreground mb-3 text-center">
            <Volume2 className="inline h-4 w-4 mr-1" />
            Try saying:
          </h3>
          <div className="space-y-2">
            {quickCommands.map((command, index) => (
              <button
                key={index}
                onClick={() => handleVoiceCommand(command)}
                className="w-full text-left text-xs text-muted-foreground hover:text-primary hover:bg-accent p-2 rounded-md transition-colors duration-200 border border-border hover:border-primary/20"
              >
                "{command}"
              </button>
            ))}
          </div>
        </div>
        
        {/* Voice Technology Info */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>ElevenLabs Voice</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>OpenAI Processing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}