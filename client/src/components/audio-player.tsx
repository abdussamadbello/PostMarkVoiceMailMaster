import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { Play, Pause, Square, Volume2, X } from "lucide-react";

interface AudioPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  audio: { text: string; title: string } | null;
}

export default function AudioPlayer({ isOpen, onClose, audio }: AudioPlayerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [volume, setVolume] = useState([80]);
  const { toast } = useToast();
  
  const {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    setAudioUrl,
    setVolume: setPlayerVolume
  } = useAudioPlayer();

  useEffect(() => {
    if (isOpen && audio) {
      generateAudio(audio.text);
    }
  }, [isOpen, audio]);

  useEffect(() => {
    setPlayerVolume(volume[0] / 100);
  }, [volume, setPlayerVolume]);

  const generateAudio = async (text: string) => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio with ElevenLabs');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);
      
      // Auto-play the audio
      play();
    } catch (error) {
      console.error('ElevenLabs audio generation failed, falling back to Web Speech API:', error);
      
      // Fallback to Web Speech API
      try {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
          
          utterance.onstart = () => {
            toast({
              title: "Playing with Browser Voice",
              description: "Using browser's built-in speech synthesis",
            });
          };
          
          speechSynthesis.speak(utterance);
          onClose(); // Close the audio player since we're using browser speech
        } else {
          throw new Error('Speech synthesis not supported');
        }
      } catch (fallbackError) {
        console.error('Web Speech API also failed:', fallbackError);
        toast({
          title: "Audio Playback Failed",
          description: "Both ElevenLabs and browser speech failed. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleStop = () => {
    stop();
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audio) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" aria-describedby="audio-player-description">
        <DialogHeader>
          <DialogTitle className="text-center">AI Voice Playback</DialogTitle>
        </DialogHeader>
        <div id="audio-player-description" className="sr-only">
          Audio player for converting email text to speech and controlling playback
        </div>
        
        <div className="py-6">
          {/* Email Title */}
          <div className="text-center mb-6">
            <h3 className="font-medium text-foreground mb-2">{audio.title}</h3>
            <p className="text-sm text-muted-foreground">AI-generated voice reading</p>
          </div>
          
          {/* Generating State */}
          {isGenerating && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Generating high-quality voice audio...</p>
            </div>
          )}
          
          {/* Audio Controls */}
          {!isGenerating && (
            <>
              {/* Progress Bar */}
              <div className="mb-6">
                <Progress value={progressPercentage} className="w-full h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Play Controls */}
              <div className="flex items-center justify-center space-x-4 mb-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStop}
                  disabled={!duration}
                >
                  <Square className="h-4 w-4" />
                </Button>
                
                <Button
                  onClick={handlePlayPause}
                  disabled={!duration}
                  className="w-12 h-12 rounded-full"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
              </div>
              
              {/* Volume Control */}
              <div className="flex items-center space-x-3 mb-6">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">{volume[0]}%</span>
              </div>
            </>
          )}
          
          {/* Close Button */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
