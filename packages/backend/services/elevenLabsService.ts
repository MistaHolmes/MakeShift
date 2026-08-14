const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface TTSResponse {
  audioBuffer: Buffer;
  alignment: {
    characters: string[];
    character_start_times_ms: number[];
    character_end_times_ms: number[];
  };
}

export async function generateTTSWithTimestamps(text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<TTSResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2', // Good for general use
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.audio_base64 || !data.alignment) {
    throw new Error("Invalid response format from ElevenLabs");
  }

  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  
  return {
    audioBuffer,
    alignment: data.alignment,
  };
}
