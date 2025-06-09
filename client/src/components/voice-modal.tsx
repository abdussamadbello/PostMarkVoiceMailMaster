import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mic, Square, X } from "lucide-react";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceModal({ isOpen, onClose }: VoiceModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const processCommandMutation = useMutation({
    mutationFn: async (transcript: string) => {
      const response = await apiRequest("POST", "/api/voice/command", { transcript });
      return response.json();
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      setProcessingProgress(0);
      
      if (data.summary) {
        toast({
          title: "Command Executed",
          description: data.summary,
        });
      }
      
      // Refresh emails if the command affected them
      if (data.emails || data.intent?.action === 'mark_as_read') {
        queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      }
      
      onClose();
    },
    onError: (error) => {
      setIsProcessing(false);
      setProcessingProgress(0);
      toast({
        title: "Command Failed",
        description: "Failed to process voice command. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setIsListening(false);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const handleStartListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(finalTranscript + interimTranscript);
        
        if (finalTranscript) {
          setIsListening(false);
          handleProcessCommand(finalTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Voice Recognition Error",
          description: "Please try again or check your microphone permissions.",
          variant: "destructive",
        });
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.start();
    } else {
      toast({
        title: "Not Supported",
        description: "Voice recognition is not supported in this browser.",
        variant: "destructive",
      });
    }
  };

  const handleProcessCommand = (finalTranscript: string) => {
    setIsProcessing(true);
    setProcessingProgress(10);
    processCommandMutation.mutate(finalTranscript);
  };

  const quickCommands = [
    "Read my latest emails",
    "Show me unread messages",
    "Search for emails from John",
    "Mark all emails as read",
    "Delete emails from spam"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Voice Command</DialogTitle>
        </DialogHeader>
        
        <div className="text-center py-6">
          {/* Voice Button */}
          <div className="mb-6">
            <Button
              onClick={handleStartListening}
              disabled={isListening || isProcessing}
              className={`w-16 h-16 rounded-full text-2xl transition-all duration-300 ${
                isListening 
                  ? 'voice-listening bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isListening ? <Square /> : <Mic />}
            </Button>
          </div>
          
          {/* Status */}
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">
              {isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Ready to listen'}
            </h3>
            <p className="text-sm text-gray-600">
              {isProcessing 
                ? 'AI is understanding your command...'
                : isListening 
                  ? 'Speak your command clearly'
                  : 'Tap the microphone to start'
              }
            </p>
          </div>
          
          {/* Transcript */}
          {transcript && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4 min-h-12 flex items-center justify-center">
              <span className="text-sm text-gray-700">
                {transcript || 'Speak now...'}
              </span>
            </div>
          )}
          
          {/* Processing Progress */}
          {isProcessing && (
            <div className="mb-4">
              <Progress value={processingProgress} className="w-full" />
            </div>
          )}
          
          {/* Quick Commands */}
          {!isListening && !isProcessing && (
            <div className="text-left">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Example commands:</h4>
              <div className="space-y-2 text-sm text-gray-600">
                {quickCommands.map((command, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                    <span>"{command}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-center space-x-3 mt-6">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {transcript && !isProcessing && (
              <Button onClick={() => handleProcessCommand(transcript)}>
                Process Command
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
