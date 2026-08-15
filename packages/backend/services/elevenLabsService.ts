import * as googleTTS from 'google-tts-api';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface TTSResponse {
  audioBuffer: Buffer;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

export async function generateTTSWithTimestamps(text: string, voiceId: string = 'CwhRBWXzGAHq8TQ4Fs17'): Promise<TTSResponse> {
  console.log("[INFO] Bypassing ElevenLabs, using Google TTS.");
  return generateFallbackGoogleTTS(text);
}

async function generateFallbackGoogleTTS(text: string): Promise<TTSResponse> {
  // Google TTS max length is 200 characters per request
  // Split into safe chunks without breaking words if possible
  const chunks = text.match(/.{1,190}(?:\s|$)/g) || [text];
  
  const buffers: Buffer[] = [];
  
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const base64 = await googleTTS.getAudioBase64(chunk.trim(), { lang: 'en', slow: false });
      buffers.push(Buffer.from(base64, 'base64'));
    } catch (e) {
      console.error("[ERROR] Google TTS Chunk failed:", e);
    }
  }
  
  const audioBuffer = buffers.length > 0 ? Buffer.concat(buffers) : Buffer.from("");
  
  // Create fake alignment data (approximate)
  // Assuming 15 chars per second -> 1 char = ~0.066 seconds
  const characters = text.split('');
  const start_times: number[] = [];
  const end_times: number[] = [];
  
  let currentTime = 0;
  for (let i = 0; i < characters.length; i++) {
     start_times.push(currentTime);
     // Spaces are spoken faster than actual letters, but a flat rate is okay for a fallback
     currentTime += 0.07;
     end_times.push(currentTime);
  }
  
  return {
    audioBuffer,
    alignment: {
      characters,
      character_start_times_seconds: start_times,
      character_end_times_seconds: end_times
    }
  };
}
