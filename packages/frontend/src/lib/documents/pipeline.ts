import type { PageModel, TextSegment, BoundingBox } from "../storage/types";

export interface CleanedSentence {
  id: string;
  text: string;
  pageIndex: number;
  boundingBoxes: BoundingBox[];
  isChapterHeading?: boolean;
}

/* ── Noise filters ────────────────────────────────────────────── */

const URL_REGEX = /https?:\/\/\S+/gi;
const DOMAIN_REGEX = /\b[\w-]+\.(com|org|net|io|co|pdf|epub|mobi)\b/gi;
const PAGE_NUM_REGEX = /^\s*\d{1,4}\s*$/;
const EMAIL_REGEX = /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi;

/** Common front-matter headings to skip (case-insensitive) */
const FRONT_MATTER_HEADINGS = [
  "table of contents", "contents", "abstract", "preface",
  "acknowledgements", "acknowledgments", "foreword", "dedication",
  "copyright", "title page", "also by", "about the author",
];

/** Detect probable chapter headings */
const CHAPTER_REGEX = /^(chapter|part|section|prologue|epilogue)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)/i;

function isJunkSegment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length < 2) return true;
  // Pure page number
  if (PAGE_NUM_REGEX.test(trimmed)) return true;
  // Pure URL / domain
  if (trimmed.match(/^https?:\/\/\S+$/i)) return true;
  if (trimmed.match(/^[\w-]+\.(com|org|net|io|co)\S*$/i)) return true;
  return false;
}

function cleanSegmentText(text: string): string {
  let cleaned = text;
  // Remove inline URLs
  cleaned = cleaned.replace(URL_REGEX, "");
  // Remove domains like OceanofPDF.com
  cleaned = cleaned.replace(DOMAIN_REGEX, "");
  // Remove emails
  cleaned = cleaned.replace(EMAIL_REGEX, "");
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

function isFrontMatterPage(pageText: string): boolean {
  const lower = pageText.toLowerCase().trim();
  return FRONT_MATTER_HEADINGS.some(h => lower.includes(h));
}

function isChapterStart(text: string): boolean {
  return CHAPTER_REGEX.test(text.trim());
}

/* ── Repeated header/footer detection ─────────────────────────── */

function detectRepeatedHeaders(pages: PageModel[]): Set<string> {
  // Collect top-of-page and bottom-of-page text snippets
  const topTexts = new Map<string, number>();
  const bottomTexts = new Map<string, number>();

  for (const page of pages) {
    if (page.segments.length === 0) continue;
    const sorted = [...page.segments].sort((a, b) => a.boundingBox.y - b.boundingBox.y);

    // Top 2 segments
    for (let i = 0; i < Math.min(2, sorted.length); i++) {
      const key = sorted[i].text.trim().toLowerCase();
      if (key.length > 2 && key.length < 80) {
        topTexts.set(key, (topTexts.get(key) || 0) + 1);
      }
    }
    // Bottom 2 segments
    for (let i = Math.max(0, sorted.length - 2); i < sorted.length; i++) {
      const key = sorted[i].text.trim().toLowerCase();
      if (key.length > 2 && key.length < 80) {
        bottomTexts.set(key, (bottomTexts.get(key) || 0) + 1);
      }
    }
  }

  // Anything appearing on >40% of pages is likely a header/footer
  const threshold = Math.max(3, Math.floor(pages.length * 0.4));
  const repeated = new Set<string>();
  for (const [text, count] of topTexts) {
    if (count >= threshold) repeated.add(text);
  }
  for (const [text, count] of bottomTexts) {
    if (count >= threshold) repeated.add(text);
  }
  return repeated;
}

/* ── Main pipeline ────────────────────────────────────────────── */

export function processPdfText(pages: PageModel[]): CleanedSentence[] {
  const sentences: CleanedSentence[] = [];

  // 1. Detect repeated headers/footers across all pages
  const repeatedText = detectRepeatedHeaders(pages);
  console.log(`[pipeline] Detected ${repeatedText.size} repeated header/footer patterns`);

  // 2. Find the first chapter start page
  let chapterStartPage = 0;
  for (const page of pages) {
    const pageText = page.segments.map(s => s.text).join(" ");
    if (isChapterStart(pageText)) {
      chapterStartPage = page.pageIndex;
      console.log(`[pipeline] Chapter 1 detected at page ${chapterStartPage + 1}`);
      break;
    }
  }

  // 3. Determine which pages to skip (front-matter before chapter 1)
  const skipPages = new Set<number>();
  for (const page of pages) {
    if (page.pageIndex >= chapterStartPage) break;
    const pageText = page.segments.map(s => s.text).join(" ");
    if (isFrontMatterPage(pageText) || page.pageIndex < chapterStartPage) {
      skipPages.add(page.pageIndex);
    }
  }
  console.log(`[pipeline] Skipping ${skipPages.size} front-matter pages`);

  // 4. Process each remaining page
  let globalText = "";
  const charToSegment: TextSegment[] = [];
  const chapterMarkers: { charIndex: number; pageIndex: number; text: string }[] = [];

  for (const page of pages) {
    if (skipPages.has(page.pageIndex)) continue;

    // Reading order sort
    const sorted = [...page.segments].sort((a, b) => {
      if (Math.abs(a.boundingBox.y - b.boundingBox.y) > 10) {
        return a.boundingBox.y - b.boundingBox.y;
      }
      return a.boundingBox.x - b.boundingBox.x;
    });

    for (let i = 0; i < sorted.length; i++) {
      const seg = sorted[i];
      const rawText = seg.text;

      // Skip junk
      if (isJunkSegment(rawText)) continue;

      // Skip repeated headers/footers
      if (repeatedText.has(rawText.trim().toLowerCase())) continue;

      // Clean inline noise
      let text = cleanSegmentText(rawText);
      if (!text) continue;

      // Detect chapter headings
      if (isChapterStart(text)) {
        chapterMarkers.push({
          charIndex: globalText.length,
          pageIndex: page.pageIndex,
          text: text,
        });
      }

      // Fix hyphenation
      const isHyphenated = text.endsWith("-");
      if (isHyphenated) {
        text = text.slice(0, -1);
      } else {
        text = text + " ";
      }

      const startIndex = globalText.length;
      globalText += text;

      for (let c = startIndex; c < globalText.length; c++) {
        charToSegment[c] = seg;
      }
    }
  }

  console.log(`[pipeline] Cleaned text length: ${globalText.length} chars`);

  // 5. Sentence segmentation
  let sentenceStrings: string[] = [];
  let sentenceStarts: number[] = [];

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const iterator = segmenter.segment(globalText);
    for (const segment of iterator) {
      const trimmed = segment.segment.trim();
      if (trimmed.length > 0) {
        sentenceStrings.push(trimmed);
        const leadingSpace = segment.segment.length - segment.segment.trimStart().length;
        sentenceStarts.push(segment.index + leadingSpace);
      }
    }
  } else {
    const regex = /[^.!?]+[.!?]+/g;
    let match;
    while ((match = regex.exec(globalText)) !== null) {
      sentenceStrings.push(match[0].trim());
      sentenceStarts.push(match.index);
    }
  }

  // 6. Build CleanedSentence array with chapter heading flags
  for (let i = 0; i < sentenceStrings.length; i++) {
    const text = sentenceStrings[i];
    const startIndex = sentenceStarts[i];
    const endIndex = startIndex + text.length;

    // Final filter: skip very short or pure-noise sentences
    if (text.length < 3) continue;
    if (/^\d+$/.test(text)) continue;

    const boxes = new Map<string, BoundingBox>();
    let primaryPage = 0;

    for (let c = startIndex; c < endIndex; c++) {
      const seg = charToSegment[c];
      if (seg && !boxes.has(seg.id)) {
        boxes.set(seg.id, seg.boundingBox);
        primaryPage = seg.pageIndex;
      }
    }

    // Check if this sentence is a chapter heading
    const isHeading = chapterMarkers.some(
      m => startIndex >= m.charIndex && startIndex < m.charIndex + m.text.length + 5
    );

    sentences.push({
      id: `sentence_${i}`,
      text,
      pageIndex: primaryPage,
      boundingBoxes: Array.from(boxes.values()),
      isChapterHeading: isHeading,
    });
  }

  console.log(`[pipeline] Output: ${sentences.length} cleaned sentences`);
  return sentences;
}
