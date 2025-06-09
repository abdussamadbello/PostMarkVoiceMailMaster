import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Star, 
  Archive, 
  Trash2, 
  Reply, 
  ReplyAll, 
  Forward, 
  MoreHorizontal,
  Volume2,
  Calendar,
  Clock,
  User,
  X,
  Play,
  Pause,
  Square,
  Loader2
} from "lucide-react";
import type { Email } from "@/../../shared/schema";

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onPlayAudio: (text: string, title: string) => void;
  onMarkAsRead?: (email: Email) => void;
  onToggleImportant?: (email: Email) => void;
  onArchive?: (email: Email) => void;
  onDelete?: (email: Email) => void;
}

export default function EmailDetail({
  email,
  onBack,
  onPlayAudio,
  onMarkAsRead,
  onToggleImportant,
  onArchive,
  onDelete
}: EmailDetailProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [audioType, setAudioType] = useState<'elevenlabs' | 'browser' | null>(null);
  const { toast } = useToast();
  
  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Clean up audio when component unmounts or email changes
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      if (currentUtterance) {
        speechSynthesis.cancel();
        setCurrentUtterance(null);
      }
      setIsPlaying(false);
      setAudioType(null);
    };
  }, [email.id]);

  // Update audio time
  useEffect(() => {
    if (currentAudio) {
      const updateTime = () => setCurrentTime(currentAudio.currentTime);
      const updateDuration = () => setDuration(currentAudio.duration);
      const handleEnded = () => setIsPlaying(false);

      currentAudio.addEventListener('timeupdate', updateTime);
      currentAudio.addEventListener('loadedmetadata', updateDuration);
      currentAudio.addEventListener('ended', handleEnded);

      return () => {
        currentAudio.removeEventListener('timeupdate', updateTime);
        currentAudio.removeEventListener('loadedmetadata', updateDuration);
        currentAudio.removeEventListener('ended', handleEnded);
      };
    }
  }, [currentAudio]);

  const generateInlineAudio = async () => {
    setIsGeneratingAudio(true);
    
    try {
      // Get AI-processed content for audio
      const response = await fetch('/api/emails/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          emailId: email.id,
          content: email.textContent || email.htmlContent || '',
          subject: email.subject,
          sender: email.fromName || email.fromEmail
        }),
      });

      let audioText = '';
      if (response.ok) {
        const { summary } = await response.json();
        audioText = summary;
      } else {
        // Fallback to cleaned content
        audioText = (email.textContent || email.htmlContent?.replace(/<[^>]*>/g, '') || '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/[=]{3,}/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 9500);
      }

      // Generate audio using ElevenLabs
      const audioResponse = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: audioText }),
      });

      if (audioResponse.ok) {
        // Check if response is JSON (fallback to Web Speech API)
        const contentType = audioResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await audioResponse.json();
          if (data.useWebSpeech) {
            // Use browser's speech synthesis
            console.log('Using Web Speech API fallback for email audio');
            if ('speechSynthesis' in window) {
              speechSynthesis.cancel();
              
              const utterance = new SpeechSynthesisUtterance(data.text);
              utterance.rate = 0.9;
              utterance.pitch = 1.0;
              utterance.volume = 0.8;
              
              utterance.onstart = () => {
                setIsPlaying(true);
              };
              utterance.onend = () => {
                setIsPlaying(false);
                setCurrentUtterance(null);
              };
              utterance.onerror = (event) => {
                console.error('Browser speech error:', event);
                setIsPlaying(false);
                setCurrentUtterance(null);
              };
              
              setCurrentUtterance(utterance);
              setAudioType('browser');
              speechSynthesis.speak(utterance);
              
              toast({
                title: "Playing with Browser Voice",
                description: data.message || "Using browser speech synthesis",
              });
            } else {
              throw new Error('Speech synthesis not supported in this browser');
            }
          }
        } else {
          // Handle audio blob response (ElevenLabs)
          const audioBlob = await audioResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          setCurrentAudio(audio);
          setAudioType('elevenlabs');
          audio.play();
          setIsPlaying(true);
          
          toast({
            title: "Playing Email Audio",
            description: "AI-generated summary with ElevenLabs voice",
          });
        }
      } else {
        console.log('ElevenLabs failed, using browser speech fallback');
        // Fallback to Web Speech API
        if ('speechSynthesis' in window) {
          // Stop any existing speech
          speechSynthesis.cancel();
          
          const utterance = new SpeechSynthesisUtterance(audioText);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
          
          utterance.onstart = () => {
            console.log('Browser speech started');
            setIsPlaying(true);
          };
          utterance.onend = () => {
            console.log('Browser speech ended');
            setIsPlaying(false);
            setCurrentUtterance(null);
          };
          utterance.onerror = (event) => {
            console.error('Browser speech error:', event);
            setIsPlaying(false);
            setCurrentUtterance(null);
          };
          
          setCurrentUtterance(utterance);
          setAudioType('browser');
          speechSynthesis.speak(utterance);
          
          toast({
            title: "Playing with Browser Voice",
            description: "Using browser's built-in speech synthesis",
          });
        } else {
          toast({
            title: "Audio Not Available",
            description: "Speech synthesis is not supported in this browser",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error generating inline audio:', error);
      toast({
        title: "Audio Error",
        description: "Failed to generate audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handlePlayAudio = async () => {
    await generateInlineAudio();
  };

  const handlePlayPause = () => {
    if (audioType === 'elevenlabs' && currentAudio) {
      if (isPlaying) {
        currentAudio.pause();
        setIsPlaying(false);
      } else {
        currentAudio.play();
        setIsPlaying(true);
      }
    } else if (audioType === 'browser') {
      if (isPlaying) {
        speechSynthesis.pause();
        setIsPlaying(false);
      } else {
        speechSynthesis.resume();
        setIsPlaying(true);
      }
    }
  };

  const handleStop = () => {
    if (audioType === 'elevenlabs' && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    } else if (audioType === 'browser') {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentUtterance(null);
    }
    setAudioType(null);
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const extractEmailContent = () => {
    if (email.textContent) {
      return email.textContent;
    }
    if (email.htmlContent) {
      // Enhanced HTML to text conversion for better readability
      return email.htmlContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '') // Remove style tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '') // Remove script tags
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
        .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[Image: $1]')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    }
    return 'No content available';
  };

  const renderEmailContent = () => {
    const content = extractEmailContent();
    
    // Split content into paragraphs and format for better readability
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    return paragraphs.map((paragraph, index) => {
      // Check if it's a URL line
      if (paragraph.trim().match(/^https?:\/\//)) {
        return (
          <div key={index} className="my-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground border-l-2 border-primary/30">
            <a href={paragraph.trim()} target="_blank" rel="noopener noreferrer" className="hover:text-primary break-all">
              {paragraph.trim()}
            </a>
          </div>
        );
      }
      
      // Check if it's a forwarded message header
      if (paragraph.includes('Forwarded message') || paragraph.includes('From:') || paragraph.includes('To:')) {
        return (
          <div key={index} className="my-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">
              {paragraph}
            </div>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index} className="mb-4 text-sm leading-relaxed whitespace-pre-line">
          {paragraph}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} title="Back to email list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{email.subject}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayAudio}
            disabled={isGeneratingAudio}
            title="Listen to AI summary"
          >
            {isGeneratingAudio ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Volume2 className="h-4 w-4 mr-1" />
            )}
            {isGeneratingAudio ? 'Generating...' : 'Listen'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleImportant?.(email)}
            title={email.isImportant ? "Remove from important" : "Mark as important"}
          >
            <Star className={`h-4 w-4 ${email.isImportant ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive?.(email)}
            title="Archive email"
          >
            <Archive className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete?.(email)}
            title="Delete email"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            title="Close email view"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Inline Audio Controls - appears when audio is loaded */}
      {(currentAudio || currentUtterance) && (
        <div className="bg-muted/50 border-b p-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="h-8 w-8 p-0"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-8 w-8 p-0"
              title="Stop and close"
            >
              <Square className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 mx-2">
              {audioType === 'elevenlabs' ? (
                <Progress 
                  value={duration > 0 ? (currentTime / duration) * 100 : 0} 
                  className="h-2" 
                />
              ) : (
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full bg-primary transition-all duration-1000 ${isPlaying ? 'animate-pulse' : ''}`} 
                       style={{ width: isPlaying ? '100%' : '0%' }} />
                </div>
              )}
            </div>
            
            {audioType === 'elevenlabs' ? (
              <div className="text-xs text-muted-foreground font-mono min-w-[80px] text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground min-w-[80px] text-right">
                {isPlaying ? 'Speaking...' : 'Paused'}
              </div>
            )}
            
            <div className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              {audioType === 'elevenlabs' ? 'ElevenLabs' : 'Browser Voice'} • AI Summary
            </div>
          </div>
        </div>
      )}

      {/* Email Content */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Email Header Info */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{email.fromName || 'Unknown Sender'}</span>
                  <span className="text-sm text-muted-foreground">
                    &lt;{email.fromEmail}&gt;
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(email.receivedAt)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>To: {email.toEmail}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {!email.isRead && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Unread
                  </Badge>
                )}
                {email.isImportant && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Important
                  </Badge>
                )}
                {email.isForwarded && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Forwarded
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Forwarded Email Information */}
          {email.isForwarded && (email.actualSenderEmail || email.originalFrom) && (
            <>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">Forwarded Email Information</h3>
                <div className="space-y-3">
                  {email.actualSenderEmail && (
                    <div className="border-b border-blue-200 dark:border-blue-700 pb-2">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Forwarded by:</p>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-blue-700 dark:text-blue-300" />
                        <span className="text-blue-800 dark:text-blue-200">
                          {email.actualSenderName ? `${email.actualSenderName} <${email.actualSenderEmail}>` : email.actualSenderEmail}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {(email.originalFrom || email.originalSubject || email.originalDate) && (
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Original message:</p>
                      <div className="space-y-1">
                        {email.originalFrom && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-800 dark:text-blue-200">
                              From: {email.originalFromName ? `${email.originalFromName} <${email.originalFrom}>` : email.originalFrom}
                            </span>
                          </div>
                        )}
                        {email.originalTo && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-800 dark:text-blue-200">To: {email.originalTo}</span>
                          </div>
                        )}
                        {email.originalDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3 text-blue-700 dark:text-blue-300" />
                            <span className="text-blue-800 dark:text-blue-200">Date: {email.originalDate}</span>
                          </div>
                        )}
                        {email.originalSubject && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-blue-800 dark:text-blue-200 font-medium">Subject: {email.originalSubject}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator className="my-6" />

          {/* Email Body */}
          <div className="prose prose-sm max-w-none">
            <div className="text-sm leading-relaxed">
              {renderEmailContent()}
            </div>
          </div>

          {/* Attachments (if any) */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6">
              <Separator className="mb-4" />
              <h3 className="font-medium mb-2">Attachments</h3>
              <div className="space-y-2">
                {email.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                    <span className="text-sm">{attachment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsReplying(true)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          
          <Button variant="outline">
            <ReplyAll className="h-4 w-4 mr-2" />
            Reply All
          </Button>
          
          <Button variant="outline">
            <Forward className="h-4 w-4 mr-2" />
            Forward
          </Button>
          
          <div className="ml-auto">
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}