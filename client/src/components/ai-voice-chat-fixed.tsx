import React, { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Mic, 
  MicOff,
  Volume2, 
  VolumeX,
  Play,
  Pause,
  X, 
  Minimize2, 
  Maximize2,
  Square,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AiVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayAudio?: (text: string, title: string) => void;
  onTabSwitch?: (tab: 'all' | 'unread' | 'read' | 'important' | 'archived') => void;
}

export default function AiVoiceChat({ 
  isOpen, 
  onClose, 
  onPlayAudio, 
  onTabSwitch 
}: AiVoiceChatProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentAudio, setCurrentAudio] = useState<{ text: string; url?: string; isPlaying: boolean } | null>(null);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [voiceOnlyMode, setVoiceOnlyMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/ai/chat",
    onError: (error) => {
      console.error("Chat error:", error);
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
    onFinish: async (message) => {
      console.log("Chat finished:", message);
      console.log("Message content for audio:", message.content);
      
      // In voice-only mode, always auto-play and generate response if needed
      if ((voiceOnlyMode || autoPlayEnabled) && message.role === "assistant") {
        let textToSpeak = message.content;
        
        // If no content but we have tool calls, generate a response
        if (!textToSpeak || textToSpeak.trim() === "") {
          try {
            const lastUserMessage = messages[messages.length - 2]?.content || "the user's request";
            const response = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                prompt: `The user asked: "${lastUserMessage}". I retrieved email data but need to provide a conversational response. Based on the available email information, provide a clear spoken response that addresses their question about emails. Be specific and helpful.` 
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              textToSpeak = data.text;
              
              // Also update the message content for display
              if (message.content === "" || !message.content) {
                message.content = data.text;
              }
            }
          } catch (error) {
            console.error("Failed to generate audio response:", error);
          }
        }
        
        // Clean markdown formatting for speech
        if (textToSpeak && textToSpeak.trim()) {
          // Remove markdown formatting for better speech
          const cleanText = textToSpeak
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/#{1,6}\s/g, '') // Remove headers
            .replace(/^\d+\.\s/gm, '') // Remove numbered lists
            .replace(/^-\s/gm, '') // Remove bullet points
            .replace(/\n{2,}/g, '. ') // Replace double line breaks with periods
            .replace(/\n/g, ', ') // Replace single line breaks with commas
            .trim();
          
          console.log("Attempting to play audio for:", cleanText.substring(0, 50) + "...");
          setTimeout(() => {
            handlePlayMessage(cleanText);
          }, 500);
          
          // Fallback restart mechanism for voice-only mode
          if (voiceOnlyMode) {
            const estimatedDuration = textToSpeak.length * 100; // Rough estimate: 100ms per character
            setTimeout(() => {
              if (voiceOnlyMode && !isListening) {
                console.log("Fallback restart: Audio should have finished, restarting listening...");
                setIsListening(true);
                setTranscript("");
                startListening();
              }
            }, estimatedDuration + 2000); // Add 2 seconds buffer
          }
        }
      }
      
      // Auto-scroll to bottom when new message arrives
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    },
  });

  const { startListening, stopListening, isSupported, isListening: hookIsListening, resetProcessing } = useVoiceRecognition((command) => {
    console.log("Voice command received:", command);
    setTranscript(command);
    setIsListening(false);
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    handleVoiceCommand(command);
  });

  const handleVoiceCommand = async (command: string) => {
    console.log("Voice command received:", command);
    append({ role: "user", content: command });
    // Reset processing state to allow next voice command
    setTimeout(() => {
      resetProcessing();
    }, 500);
  };

  const toggleListening = () => {
    console.log("Toggle listening called, current state:", isListening);
    if (isListening) {
      console.log("Stopping listening...");
      setIsListening(false);
      stopListening();
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
    } else {
      console.log("Starting listening...");
      setIsListening(true);
      setTranscript("");
      startListening();
      
      // Set timeout to stop listening after 15 seconds in voice mode, 10 seconds otherwise
      const timeout = voiceOnlyMode ? 15000 : 10000;
      listeningTimeoutRef.current = setTimeout(() => {
        console.log("Listening timeout reached");
        setIsListening(false);
        stopListening();
        listeningTimeoutRef.current = null;
        
        // In voice mode, automatically restart listening after a brief pause
        if (voiceOnlyMode) {
          setTimeout(() => {
            if (voiceOnlyMode && !currentAudio?.isPlaying) {
              console.log("Auto-restarting listening in voice mode...");
              setIsListening(true);
              setTranscript("");
              startListening();
            }
          }, 2000);
        }
      }, timeout);
    }
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.code === 'Space' && event.ctrlKey) {
      event.preventDefault();
      toggleListening();
    }
  };

  const handlePlayMessage = async (text: string) => {
    try {
      const cleanText = text.trim();
      if (!cleanText) {
        throw new Error('No text to speak');
      }

      console.log('Generating speech for:', cleanText);
      setCurrentAudio({ text: cleanText, isPlaying: true });
      
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      // Check if response is JSON (fallback to Web Speech API)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.useWebSpeech) {
          // Use browser's speech synthesis
          console.log('Using Web Speech API fallback for:', cleanText);
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(data.text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            utterance.onend = handleAudioEnded;
            utterance.onerror = handleAudioEnded;
            
            speechSynthesis.speak(utterance);
            setCurrentAudio({ text: cleanText, isPlaying: true });
            
            toast({
              title: "Voice Mode",
              description: data.message || "Using browser speech synthesis",
              variant: "default",
            });
          } else {
            throw new Error('Speech synthesis not supported in this browser');
          }
        }
      } else {
        // Handle audio blob response (ElevenLabs)
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setCurrentAudio({ text: cleanText, url: audioUrl, isPlaying: true });

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          console.log("Starting audio playback...");
          
          // Add event listeners for better tracking
          audioRef.current.addEventListener('ended', handleAudioEnded, { once: true });
          audioRef.current.addEventListener('error', handleAudioEnded, { once: true });
          
          await audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('Audio generation failed:', error);
      toast({
        title: "Audio Error",
        description: error instanceof Error ? error.message : "Failed to generate speech audio",
        variant: "destructive",
      });
      setCurrentAudio(null);
    }
  };

  const handleStopAudio = () => {
    // Stop HTML5 audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Stop Web Speech API if speaking
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    setCurrentAudio(null);
    if (currentAudio?.url) {
      URL.revokeObjectURL(currentAudio.url);
    }
  };

  const handleAudioEnded = () => {
    console.log("Audio ended, voice mode:", voiceOnlyMode);
    const currentAudioUrl = currentAudio?.url;
    setCurrentAudio(null);
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    
    // In voice-only mode, automatically start listening after AI response
    if (voiceOnlyMode && isSupported) {
      console.log("Restarting listening in voice mode...");
      setTimeout(() => {
        if (voiceOnlyMode && !isListening) { // Double check we're still in voice mode and not already listening
          console.log("Actually starting listening now...");
          setIsListening(true);
          setTranscript("");
          startListening();
          
          // Set timeout to stop listening after 15 seconds
          if (listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
          }
          listeningTimeoutRef.current = setTimeout(() => {
            console.log("Auto-stopping listening after timeout");
            setIsListening(false);
            stopListening();
            listeningTimeoutRef.current = null;
            
            // Auto-restart after a brief pause in voice mode
            setTimeout(() => {
              if (voiceOnlyMode && !currentAudio?.isPlaying) {
                console.log("Auto-restarting listening cycle...");
                setIsListening(true);
                setTranscript("");
                startListening();
              }
            }, 2000);
          }, 15000);
        }
      }, 1000); // Shorter delay for better responsiveness
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className={cn(
        "w-full max-w-2xl mx-4 bg-background border shadow-2xl transition-all duration-300",
        isMinimized ? "h-16" : "h-[600px]"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">AI Voice Assistant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Chat or speak to manage your emails
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant={voiceOnlyMode ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setVoiceOnlyMode(!voiceOnlyMode);
                  if (!voiceOnlyMode) {
                    setAutoPlayEnabled(true);
                    setTimeout(() => {
                      setIsListening(true);
                      startListening();
                    }, 500);
                  } else {
                    setIsListening(false);
                    stopListening();
                  }
                }}
                className="h-7 px-3 text-xs font-medium"
                title="Voice-only mode - Continuous voice conversation"
              >
                <Mic className="h-3 w-3 mr-1" />
                {voiceOnlyMode ? "Voice ON" : "Voice Mode"}
              </Button>
              {!voiceOnlyMode && (
                <Button
                  variant={autoPlayEnabled ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                  className="h-7 px-2 text-xs"
                  title="Auto-play AI responses"
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-8 w-8"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[calc(600px-80px)]">
            {voiceOnlyMode ? (
              /* Voice-Only Mode Interface */
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <div className="text-center space-y-8">
                  {/* Enhanced Speaker Animation */}
                  <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
                    {/* Outer ring animations */}
                    <div className={cn(
                      "absolute w-40 h-40 rounded-full border-4 transition-all duration-500",
                      isListening 
                        ? "border-red-300/60 animate-ping" 
                        : currentAudio?.isPlaying 
                          ? "border-blue-300/60 animate-pulse" 
                          : isLoading
                            ? "border-purple-300/60 animate-spin"
                            : "border-gray-300/40 dark:border-gray-600/40"
                    )} />
                    
                    {/* Middle ring */}
                    <div className={cn(
                      "absolute w-36 h-36 rounded-full border-2 transition-all duration-300",
                      isListening 
                        ? "border-red-400/80 animate-pulse" 
                        : currentAudio?.isPlaying 
                          ? "border-blue-400/80" 
                          : isLoading
                            ? "border-purple-400/80 animate-bounce"
                            : "border-gray-400/60 dark:border-gray-500/60"
                    )} />
                    
                    {/* Main speaker circle */}
                    <div className={cn(
                      "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
                      isListening 
                        ? "bg-gradient-to-br from-red-500 to-red-600" 
                        : currentAudio?.isPlaying 
                          ? "bg-gradient-to-br from-blue-500 to-blue-600"
                          : isLoading
                            ? "bg-gradient-to-br from-purple-500 to-purple-600"
                            : "bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700"
                    )}>
                      {/* Audio wave animation for speaking */}
                      {currentAudio?.isPlaying && (
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          <div className="absolute inset-4 bg-white/20 rounded-full animate-ping" />
                          <div className="absolute inset-6 bg-white/30 rounded-full animate-pulse" />
                          <div className="absolute inset-8 bg-white/40 rounded-full animate-ping animation-delay-200" />
                        </div>
                      )}
                      
                      {/* Microphone pulse for listening */}
                      {isListening && (
                        <div className="absolute inset-0 rounded-full">
                          <div className="absolute inset-2 border-2 border-white/40 rounded-full animate-ping" />
                          <div className="absolute inset-4 border border-white/60 rounded-full animate-pulse" />
                        </div>
                      )}
                      
                      {/* Loading spinner */}
                      {isLoading && (
                        <div className="absolute inset-2 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                      )}
                      
                      {/* Icon */}
                      <div className="relative z-10 flex items-center justify-center">
                        {isListening ? (
                          <Mic className="h-12 w-12 text-white drop-shadow-lg" />
                        ) : currentAudio?.isPlaying ? (
                          <Volume2 className="h-12 w-12 text-white drop-shadow-lg" />
                        ) : isLoading ? (
                          <Bot className="h-12 w-12 text-white drop-shadow-lg animate-pulse" />
                        ) : (
                          <MessageCircle className="h-12 w-12 text-white drop-shadow-lg" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status text */}
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {isListening 
                        ? "Listening..." 
                        : currentAudio?.isPlaying 
                          ? "Speaking..." 
                          : isLoading
                            ? "Processing..."
                            : "Voice Assistant Ready"
                      }
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      {isListening 
                        ? "Speak now to ask about your emails" 
                        : currentAudio?.isPlaying 
                          ? "Playing AI response" 
                          : isLoading
                            ? "Generating response..."
                            : "Say something to start the conversation"
                      }
                    </p>
                  </div>

                  {/* Transcript Display */}
                  {transcript && (
                    <div className="relative max-w-md mx-auto">
                      <div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">You said:</p>
                            <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                              "{transcript}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-4">
                      {!isListening && !currentAudio?.isPlaying && !isLoading && (
                        <Button
                          onClick={() => {
                            setIsListening(true);
                            startListening();
                          }}
                          size="lg"
                          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          <Mic className="h-5 w-5 mr-3" />
                          Start Talking
                        </Button>
                      )}
                      
                      {isListening && (
                        <Button
                          onClick={() => {
                            setIsListening(false);
                            stopListening();
                          }}
                          variant="destructive"
                          size="lg"
                          className="px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          <Square className="h-5 w-5 mr-3" />
                          Stop Listening
                        </Button>
                      )}
                      
                      {currentAudio?.isPlaying && (
                        <Button
                          onClick={handleStopAudio}
                          variant="outline"
                          size="lg"
                          className="px-8 py-3 border-2 shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          <Square className="h-5 w-5 mr-3" />
                          Stop Speaking
                        </Button>
                      )}
                    </div>
                    
                    {/* Voice mode indicator */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Voice mode active</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular Chat Interface */
              <>
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-8">
                        <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg mb-2">Welcome to your AI Email Assistant</h3>
                        <p className="text-muted-foreground mb-4">
                          I can help you manage your emails through text or voice commands.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Badge variant="secondary" className="text-xs">
                            "Show me unread emails"
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            "Mark all as read"
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            "Search for emails from Sarah"
                          </Badge>
                        </div>
                      </div>
                    )}

                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3 max-w-[90%]",
                          message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                          message.role === "user" 
                            ? "bg-blue-500 text-white" 
                            : "bg-gray-200 dark:bg-gray-700"
                        )}>
                          {message.role === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                          )}
                        </div>
                        <div className={cn(
                          "rounded-xl px-4 py-2 max-w-[80%]",
                          message.role === "user" 
                            ? "bg-blue-500 text-white" 
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        )}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {message.role === "assistant" && message.content && message.content.trim() && !isLoading && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePlayMessage(message.content)}
                                disabled={currentAudio?.isPlaying || !message.content.trim() || isLoading}
                                className="h-6 px-2 text-xs text-muted-foreground hover:bg-background"
                              >
                                <Volume2 className="h-3 w-3 mr-1" />
                                {currentAudio?.text === message.content && currentAudio?.isPlaying ? "Playing..." : "Play"}
                              </Button>
                              {currentAudio?.text === message.content && currentAudio?.isPlaying && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleStopAudio}
                                  className="h-6 px-2 text-xs text-muted-foreground hover:bg-background"
                                >
                                  <VolumeX className="h-3 w-3 mr-1" />
                                  Stop
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3 mr-auto max-w-[90%]">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div className="rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input Form */}
                <div className="p-4 border-t bg-background">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    {isSupported && (
                      <Button
                        type="button"
                        variant={isListening ? "destructive" : "outline"}
                        size="icon"
                        onClick={toggleListening}
                        className="flex-shrink-0"
                      >
                        {isListening ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      placeholder="Type a message or use voice..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    
                    <Button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      size="icon"
                      className="flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                  
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"
                      onClick={() => append({ role: "user", content: "Show me my unread emails" })}>
                      Unread emails
                    </Badge>
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"
                      onClick={() => append({ role: "user", content: "What's my email summary?" })}>
                      Email summary
                    </Badge>
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"
                      onClick={() => append({ role: "user", content: "Mark all emails as read" })}>
                      Mark all read
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={handleAudioEnded}
        style={{ display: 'none' }}
      />
    </div>
  );
}