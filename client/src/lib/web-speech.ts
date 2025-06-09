export interface WebSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

export class WebSpeechManager {
  private static instance: WebSpeechManager;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): WebSpeechManager {
    if (!WebSpeechManager.instance) {
      WebSpeechManager.instance = new WebSpeechManager();
    }
    return WebSpeechManager.instance;
  }

  private initialize() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Web Speech API not supported');
      return;
    }

    // Wait for voices to load
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.addEventListener('voiceschanged', () => {
        this.isInitialized = true;
      }, { once: true });
    } else {
      this.isInitialized = true;
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    return speechSynthesis.getVoices();
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    
    // Prefer English voices
    const englishVoices = voices.filter(voice => 
      voice.lang.startsWith('en-') && !voice.name.includes('Google')
    );
    
    if (englishVoices.length > 0) {
      // Look for high-quality voices
      const preferredNames = ['Samantha', 'Alex', 'Victoria', 'Daniel', 'Karen', 'Moira'];
      for (const name of preferredNames) {
        const voice = englishVoices.find(v => v.name.includes(name));
        if (voice) return voice;
      }
      return englishVoices[0];
    }
    
    return voices.length > 0 ? voices[0] : null;
  }

  public speak(
    text: string, 
    options: WebSpeechOptions = {},
    onEnd?: () => void,
    onError?: (error: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const error = new Error('Web Speech API not supported');
        onError?.(error);
        reject(error);
        return;
      }

      // Stop any current speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set options
      utterance.rate = options.rate ?? 0.9;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;
      utterance.voice = options.voice ?? this.getPreferredVoice();

      // Event handlers
      utterance.onend = () => {
        this.currentUtterance = null;
        onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        const error = new Error(`Speech synthesis error: ${event.error}`);
        onError?.(error);
        reject(error);
      };

      utterance.onstart = () => {
        console.log('Web Speech synthesis started');
      };

      this.currentUtterance = utterance;
      speechSynthesis.speak(utterance);
    });
  }

  public stop(): void {
    if (this.isSupported() && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  public pause(): void {
    if (this.isSupported() && speechSynthesis.speaking) {
      speechSynthesis.pause();
    }
  }

  public resume(): void {
    if (this.isSupported() && speechSynthesis.paused) {
      speechSynthesis.resume();
    }
  }

  public isSpeaking(): boolean {
    return this.isSupported() && speechSynthesis.speaking;
  }

  public isPaused(): boolean {
    return this.isSupported() && speechSynthesis.paused;
  }
}

// Export singleton instance
export const webSpeech = WebSpeechManager.getInstance();