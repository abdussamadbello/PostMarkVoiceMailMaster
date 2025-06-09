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
        
        // Auto-play if we have text content
        if (textToSpeak && textToSpeak.trim()) {
          console.log("Attempting to play audio for:", textToSpeak.substring(0, 50) + "...");
          setTimeout(() => {
            handlePlayMessage(textToSpeak);
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
                <div className="text-center space-y-6">
                  <div className={cn(
                    "w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300",
                    isListening 
                      ? "bg-red-500 animate-pulse" 
                      : currentAudio?.isPlaying 
                        ? "bg-blue-500 animate-pulse"
                        : "bg-gray-300 dark:bg-gray-700"
                  )}>
                    {isListening ? (
                      <Mic className="h-12 w-12 text-white" />
                    ) : currentAudio?.isPlaying ? (
                      <Volume2 className="h-12 w-12 text-white" />
                    ) : (
                      <MessageCircle className="h-12 w-12 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">
                      {isListening 
                        ? "Listening..." 
                        : currentAudio?.isPlaying 
                          ? "Speaking..." 
                          : "Voice Assistant Ready"
                      }
                    </h3>
                    <p className="text-muted-foreground">
                      {isListening 
                        ? "Speak now to ask about your emails" 
                        : currentAudio?.isPlaying 
                          ? "Playing AI response" 
                          : "Say something to start the conversation"
                      }
                    </p>
                  </div>

                  {transcript && (
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-md">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        "{transcript}"
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!isListening && !currentAudio?.isPlaying && (
                      <Button
                        onClick={() => {
                          setIsListening(true);
                          startListening();
                        }}
                        size="lg"
                        className="px-6"
                      >
                        <Mic className="h-4 w-4 mr-2" />
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
                        className="px-6"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Listening
                      </Button>
                    )}
                    
                    {currentAudio?.isPlaying && (
                      <Button
                        onClick={handleStopAudio}
                        variant="outline"
                        size="lg"
                        className="px-6"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Stop Speaking
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Normal Chat Mode Interface */
              <>
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-xl px-4 py-2 max-w-[85%] break-words",
                            message.role === "user"
                              ? "bg-blue-600 text-white ml-auto"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.role === "assistant" && message.content && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePlayMessage(message.content)}
                              className="mt-2 h-6 px-2 text-xs hover:bg-background/50"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                          )}
                        </div>
                        {message.role === "user" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        )}
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

                {/* Voice Recognition Status */}
                {isListening && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        Listening... Speak now
                      </span>
                      {transcript && (
                        <span className="text-sm text-muted-foreground ml-2">
                          "{transcript}"
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Audio Player */}
                {currentAudio && (
                  <div className="px-4 py-2 border-t bg-blue-50 dark:bg-blue-950">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Playing AI Response
                        </span>
                      </div>
                      <div className="flex-1 text-xs text-blue-600 dark:text-blue-400 truncate">
                        {currentAudio.text.substring(0, 60)}...
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStopAudio}
                        className="h-7 px-2"
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t bg-muted/30">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      placeholder="Ask about your emails..."
                      className="flex-1"
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isLoading || !input.trim()}
                      className="flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={isListening ? "destructive" : "outline"}
                      onClick={toggleListening}
                      disabled={!isSupported}
                      className="flex-shrink-0"
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </form>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"
                      onClick={() => append({ role: "user", content: "Show me unread emails" })}>
                      Unread emails
                    </Badge>
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"
                      onClick={() => append({ role: "user", content: "Show important emails" })}>
                      Important emails
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