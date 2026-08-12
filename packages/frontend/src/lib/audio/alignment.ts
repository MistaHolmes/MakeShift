import type { CleanedSentence } from "../documents/pipeline";
import type { SentenceTiming } from "../storage/types";
import type { AudioChunk } from "./chunker";
import type { TTSResult } from "./elevenlabs";

export function normalizeAlignments(
  chunk: AudioChunk, 
  tts: TTSResult, 
  globalTimeOffset: number
): { timings: SentenceTiming[]; duration: number } {
  const timings: SentenceTiming[] = [];
  
  // Create a fast lookup for character timestamps
  const { characters, startTimes, endTimes } = tts.alignments;
  
  // Elevenlabs returns an array of chars. We need to match our chunk.text to it.
  // It's possible the TTS engine normalized some characters (e.g., expanding numbers),
  // which makes 1:1 mapping tricky. For V1, we assume roughly 1:1 or use string search.
  
  // To keep it robust, we calculate the percentage of the sentence in the chunk
  // and map it to the timestamp percentage, or do a greedy match.
  // We'll do a simple greedy match over the characters array.

  let ttsCharIdx = 0;

  for (const sentence of chunk.sentences) {
    const text = sentence.text.trim();
    if (!text) continue;

    // Find the start of the sentence in the TTS character array
    // We skip spaces and match alphanumeric
    let sentenceStartTtsIdx = -1;
    let sentenceEndTtsIdx = -1;

    let matchedChars = 0;
    
    for (let i = ttsCharIdx; i < characters.length; i++) {
      if (sentenceStartTtsIdx === -1 && characters[i].trim() !== "") {
        sentenceStartTtsIdx = i;
      }
      
      if (characters[i].trim() !== "") {
        matchedChars++;
      }
      
      // If we've matched roughly the number of non-space chars in the sentence
      // (or we hit the end), we mark the end.
      const targetChars = text.replace(/\s+/g, '').length;
      if (matchedChars >= targetChars || i === characters.length - 1) {
        sentenceEndTtsIdx = i;
        ttsCharIdx = i + 1;
        break;
      }
    }

    // Fallback if not found
    if (sentenceStartTtsIdx === -1) sentenceStartTtsIdx = ttsCharIdx;
    if (sentenceEndTtsIdx === -1) sentenceEndTtsIdx = ttsCharIdx;

    const audioStart = (startTimes[sentenceStartTtsIdx] ?? 0) + globalTimeOffset;
    const audioEnd = (endTimes[sentenceEndTtsIdx] ?? 0) + globalTimeOffset;

    timings.push({
      sentenceId: sentence.id,
      text: sentence.text,
      audioStart,
      audioEnd,
      pageIndex: sentence.pageIndex,
      boundingBoxes: sentence.boundingBoxes,
      isChapterHeading: sentence.isChapterHeading,
    });
  }

  // Calculate duration of this chunk
  const chunkDuration = endTimes.length > 0 ? endTimes[endTimes.length - 1] : 0;

  return {
    timings,
    duration: chunkDuration
  };
}
