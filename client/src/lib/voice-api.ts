// TypeScript declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface VoiceCommand {
  transcript: string;
  intent?: string;
  confidence?: number;
}

export interface VoiceCommandResult {
  intent: {
    action: string;
    parameters?: any;
    confidence: number;
  };
  emails?: any[];
  summary?: string;
  switchTab?: 'all' | 'unread' | 'important' | 'archived';
}

export async function processVoiceCommand(transcript: string): Promise<VoiceCommandResult> {
  const response = await fetch('/api/voice/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error('Failed to process voice command');
  }

  return response.json();
}

export async function generateSpeech(text: string, options?: {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}): Promise<Blob> {
  const response = await fetch('/api/voice/speak', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceSettings: options,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate speech');
  }

  return response.blob();
}

export async function getVoiceCommandHistory(limit = 20) {
  const response = await fetch(`/api/voice/history?limit=${limit}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch voice command history');
  }

  return response.json();
}

// Voice recognition utilities
export function isVoiceRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function createSpeechRecognition(): any | null {
  if (!isVoiceRecognitionSupported()) {
    return null;
  }
  
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();
  
  // Default configuration
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  return recognition;
}

// Text-to-speech utilities
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function speakWithWebAPI(text: string, options?: {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (options) {
      utterance.rate = options.rate || 1;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;
      if (options.voice) {
        utterance.voice = options.voice;
      }
    }
    
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));
    
    speechSynthesis.speak(utterance);
  });
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) {
    return [];
  }
  
  return speechSynthesis.getVoices();
}
