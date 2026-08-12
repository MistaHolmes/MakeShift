import type { CleanedSentence } from "../documents/pipeline";

export interface AudioChunk {
  id: string;
  text: string;
  sentences: CleanedSentence[];
}

export function chunkSentences(sentences: CleanedSentence[], maxChars = 2500): AudioChunk[] {
  const chunks: AudioChunk[] = [];
  
  let currentChunkId = 0;
  let currentText = "";
  let currentSentences: CleanedSentence[] = [];

  for (const sentence of sentences) {
    if (currentText.length + sentence.text.length > maxChars && currentSentences.length > 0) {
      chunks.push({
        id: `chunk_${currentChunkId.toString().padStart(3, "0")}`,
        text: currentText.trim(),
        sentences: currentSentences,
      });
      currentChunkId++;
      currentText = "";
      currentSentences = [];
    }

    currentText += sentence.text + " ";
    currentSentences.push(sentence);
  }

  if (currentSentences.length > 0) {
    chunks.push({
      id: `chunk_${currentChunkId.toString().padStart(3, "0")}`,
      text: currentText.trim(),
      sentences: currentSentences,
    });
  }

  return chunks;
}
