import { generateSpeech } from './elevenlabs';

interface VoiceQuotaInfo {
  charactersUsed: number;
  charactersLimit: number;
  charactersRemaining: number;
  lastChecked: Date;
}

class VoiceManager {
  private quotaInfo: VoiceQuotaInfo | null = null;
  private quotaCacheTime = 5 * 60 * 1000; // 5 minutes

  async checkQuotaStatus(): Promise<VoiceQuotaInfo | null> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return null;

    // Use cached quota if recent
    if (this.quotaInfo && Date.now() - this.quotaInfo.lastChecked.getTime() < this.quotaCacheTime) {
      return this.quotaInfo;
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.quotaInfo = {
          charactersUsed: data.character_count || 0,
          charactersLimit: data.character_limit || 10000,
          charactersRemaining: (data.character_limit || 10000) - (data.character_count || 0),
          lastChecked: new Date(),
        };
        return this.quotaInfo;
      }
    } catch (error) {
      console.warn('Failed to check ElevenLabs quota:', error);
    }

    return null;
  }

  async canHandleRequest(textLength: number): Promise<boolean> {
    const quota = await this.checkQuotaStatus();
    if (!quota) return false;

    // Add 10% buffer for safety
    const requiredChars = Math.ceil(textLength * 1.1);
    return quota.charactersRemaining >= requiredChars;
  }

  async generateSpeechWithFallback(text: string, voiceSettings?: any): Promise<{ 
    success: boolean; 
    audioBuffer?: Buffer; 
    useWebSpeech?: boolean; 
    message?: string 
  }> {
    const canUseElevenLabs = await this.canHandleRequest(text.length);

    if (!canUseElevenLabs) {
      console.log('ElevenLabs quota insufficient, using Web Speech API fallback');
      return {
        success: true,
        useWebSpeech: true,
        message: 'Using browser speech synthesis due to service quota limitations'
      };
    }

    try {
      const audioBuffer = await generateSpeech(text, voiceSettings);
      return {
        success: true,
        audioBuffer
      };
    } catch (error) {
      console.log('ElevenLabs generation failed, falling back to Web Speech API:', error);
      return {
        success: true,
        useWebSpeech: true,
        message: 'Using browser speech synthesis due to service limitations'
      };
    }
  }

  getQuotaInfo(): VoiceQuotaInfo | null {
    return this.quotaInfo;
  }

  resetQuotaCache(): void {
    this.quotaInfo = null;
  }
}

export const voiceManager = new VoiceManager();