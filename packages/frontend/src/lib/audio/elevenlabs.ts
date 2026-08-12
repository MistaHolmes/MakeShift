export interface TTSResult {
  audioBuffer: Buffer;
  alignments: {
    characters: string[];
    startTimes: number[];
    endTimes: number[];
  };
}

export async function synthesizeSpeech(text: string): Promise<TTSResult> {
  const isMock = process.env.MOCK_TTS === "true";
  
  if (isMock) {
    // Generate a mock response to save credits
    // Assume 15 chars per second reading speed
    const chars = text.split("");
    const startTimes: number[] = [];
    const endTimes: number[] = [];
    
    for (let i = 0; i < chars.length; i++) {
      startTimes.push(i * (1/15));
      endTimes.push((i + 1) * (1/15));
    }
    
    // 1-second empty mp3 frame (silent, valid format)
    const silentMp3Base64 = "//OExAAAAAAAAAAAAFhpbmcAAAAPAAAAAQAAAAj9//4f/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wAAADxMQU1FMy4xMDABAAAAOjoAAAgAAQAGAAADhAAAAAD9/wAA";
    
    // We add an artificial delay to simulate API latency
    await new Promise(r => setTimeout(r, 1000));
    
    return {
      audioBuffer: Buffer.from(silentMp3Base64, "base64"),
      alignments: {
        characters: chars,
        startTimes,
        endTimes
      }
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  // Rachel voice ID: 21m00Tcm4TlvDq8ikWAM
  const voiceId = "21m00Tcm4TlvDq8ikWAM"; 
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  return {
    audioBuffer: Buffer.from(data.audio_base64, "base64"),
    alignments: {
      characters: data.alignment.characters,
      startTimes: data.alignment.character_start_times_seconds,
      endTimes: data.alignment.character_end_times_seconds
    }
  };
}
