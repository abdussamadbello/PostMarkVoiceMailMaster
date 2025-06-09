import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useVoiceRecognition(onCommand: (command: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        
        const recognition = recognitionRef.current;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setTranscript("");
        };

        recognition.onresult = (event: any) => {
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
            setIsProcessing(true);
            onCommand(finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          setIsListening(false);
          setIsProcessing(false);
          
          // Don't log or show errors for aborted recognition - it's usually intentional
          if (event.error === 'aborted') {
            return;
          }
          
          let errorMessage = "Voice recognition failed. Please try again.";
          
          switch (event.error) {
            case 'no-speech':
              errorMessage = "No speech detected. Please try speaking clearly.";
              break;
            case 'audio-capture':
              errorMessage = "Microphone access denied. Please check your permissions.";
              break;
            case 'not-allowed':
              errorMessage = "Microphone permission denied. Please enable microphone access.";
              break;
            case 'network':
              errorMessage = "Network error. Please check your connection and try again.";
              break;
            case 'service-not-allowed':
              errorMessage = "Speech recognition service not available.";
              break;
          }
          
          toast({
            title: "Voice Recognition Error",
            description: errorMessage,
            variant: "destructive",
          });
        };

        recognition.onend = () => {
          setIsListening(false);
        };
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
        toast({
          title: "Voice Recognition Unavailable",
          description: "Speech recognition is not supported in this browser.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Voice Recognition Not Supported",
        description: "Your browser does not support voice recognition.",
        variant: "destructive",
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []); // Remove dependencies to prevent re-initialization

  // Simulate voice level animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isListening) {
      interval = setInterval(() => {
        setVoiceLevel(Math.random() * 100);
      }, 200);
    } else {
      setVoiceLevel(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isListening]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      try {
        recognitionRef.current.start();
        
        // Play subtle audio feedback for start
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.08);
          
          // Clean up context after use
          setTimeout(() => {
            audioContext.close().catch(() => {});
          }, 100);
        } catch (audioError) {
          // Audio feedback is optional, gracefully handle errors
        }
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setIsListening(false);
        setIsProcessing(false);
        toast({
          title: "Voice Recognition Error",
          description: "Unable to start voice recording. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [isListening, isProcessing, toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetProcessing = useCallback(() => {
    setIsProcessing(false);
    setTranscript("");
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    voiceLevel,
    startListening,
    stopListening,
    resetProcessing,
    isSupported: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
  };
}
