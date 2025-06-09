import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mic, Volume2, Square, Loader2, X, Minimize2, Maximize2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingVoiceButtonProps {
  onVoiceCommand: (command: string) => void;
  onPlayAudio: (text: string, title: string) => void;
  onTabSwitch?: (tab: 'all' | 'unread' | 'read' | 'important' | 'archived') => void;
}

export default function FloatingVoiceButton({ onVoiceCommand, onPlayAudio, onTabSwitch }: FloatingVoiceButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [useAiMode, setUseAiMode] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Enhanced AI processing function
  const processWithAi = async (command: string) => {
    try {
      const response = await apiRequest("POST", "/api/ai/generate", { prompt: command });
      const data = await response.json();
      
      if (data.text && onPlayAudio) {
        onPlayAudio(data.text, "AI Assistant");
      }
      
      toast({
        title: "AI Response",
        description: data.text,
      });
      
      return data;
    } catch (error) {
      console.error('AI processing error:', error);
      toast({
        title: "AI Error",
        description: "Failed to process with AI. Falling back to classic mode.",
        variant: "destructive",
      });
      throw error;
    }
  };

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
      
      if (data.switchTab && onTabSwitch) {
        onTabSwitch(data.switchTab);
      }
      
      if (data.summary) {
        toast({
          title: "Command Executed",
          description: data.summary,
        });
        
        // Use onPlayAudio instead of playElevenLabsAudio to avoid duplicate audio
        onPlayAudio(data.summary, `Email Summary (${data.emails?.length || 0} emails)`);
      }
      
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

  const handleVoiceCommand = async (command: string) => {
    if (useAiMode) {
      // Use enhanced AI processing
      try {
        setIsExecuting(true);
        await processWithAi(command);
        // Refresh emails after AI processing
        queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      } catch (error) {
        console.error('AI voice command failed:', error);
      } finally {
        setIsExecuting(false);
        resetProcessing();
      }
    } else {
      // Use original processing
      setIsExecuting(true);
      processCommandMutation.mutate(command);
    }
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
    "Show unread emails",
    "Mark all as read",
    "Show important emails",
    "Archive all emails",
    "Go to all emails"
  ];

  return (
    <>
      {/* Floating Voice Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded Panel */}
        {isExpanded && (
          <Card className="mb-4 w-80 shadow-lg border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">AI Voice Assistant</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Ctrl+Space
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsExpanded(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Voice Level Indicator */}
              {isListening && (
                <div className="mb-4">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-destructive">LISTENING</span>
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                  </div>
                  <Progress value={voiceLevel} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Voice Level</p>
                </div>
              )}

              {/* AI Mode Toggle */}
              <div className="mb-4 flex items-center justify-center gap-2">
                <Button
                  variant={useAiMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseAiMode(!useAiMode)}
                  disabled={isActive}
                  className="flex items-center gap-1"
                >
                  <Bot className="h-3 w-3" />
                  {useAiMode ? "AI Mode" : "Classic"}
                </Button>
                <Badge variant={useAiMode ? "default" : "secondary"} className="text-xs">
                  {useAiMode ? "Enhanced AI" : "Standard"}
                </Badge>
              </div>

              {/* Status Message */}
              <div className="text-center mb-4">
                <p className={cn("text-sm font-medium", {
                  "text-destructive": isListening,
                  "text-orange-600": isProcessing || isExecuting,
                  "text-muted-foreground": !isActive
                })}>
                  {isExecuting 
                    ? useAiMode 
                      ? 'AI is processing your request...' 
                      : 'Processing your request...'
                    : isProcessing 
                      ? 'Understanding your command...' 
                      : isListening 
                        ? 'Speak now - I\'m listening!' 
                        : `Click the mic to start ${useAiMode ? '(AI Mode)' : '(Classic Mode)'}`}
                </p>

                {/* Live transcript display */}
                {transcript && (
                  <div className="mt-2 p-2 bg-secondary rounded-lg">
                    <p className="text-sm text-secondary-foreground">
                      <span className="font-medium">You said:</span> "{transcript}"
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Commands */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Quick Commands:</h4>
                <div className="space-y-1">
                  {quickCommands.map((command, index) => (
                    <button
                      key={index}
                      onClick={() => handleVoiceCommand(command)}
                      className="w-full text-left text-xs text-muted-foreground hover:text-primary hover:bg-accent p-2 rounded-md transition-colors duration-200 border border-border hover:border-primary/20"
                      disabled={isActive}
                    >
                      "{command}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Indicators */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>ElevenLabs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>OpenAI</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Floating Button */}
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
            className={cn(
              "relative w-16 h-16 rounded-full shadow-lg transition-all duration-300 border-4",
              {
                "bg-destructive hover:bg-destructive/90 scale-110 border-destructive/30 shadow-destructive/50": isListening,
                "bg-orange-500 hover:bg-orange-600 border-orange-300": isExecuting || isProcessing,
                "bg-primary hover:bg-primary/90 hover:scale-105 border-primary/30": !isActive
              }
            )}
          >
            {isListening ? (
              <Square className="h-6 w-6 animate-pulse" />
            ) : isExecuting || isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>

          {/* Expand/Collapse Button */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute -top-2 -left-2 w-6 h-6 rounded-full shadow-md"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}