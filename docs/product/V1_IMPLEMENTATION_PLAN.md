# Software Development Plan (SDP): V1 Implementation — Synchronized PDF Reader MVP

---

## 1. Executive Summary & Scope

### 1.1 Objective
The primary objective of **Version 1 (V1)** is to deliver a fully functional, local-first web application that allows a user to upload a PDF, render it visually intact using PDF.js, generate high-quality audio narration via ElevenLabs TTS, and maintain seamless **bidirectional synchronization** between narration audio and highlighted text.

### 1.2 Boundary & Constraints
- **Target Audience:** Single-user / Personal MVP.
- **Authentication:** None (Anonymous user).
- **Backend Datastore:** None (No PostgreSQL or remote DB in V1).
- **Client Storage:** IndexedDB for large binary assets (PDFs, Audio) and structured metadata; `localStorage` for UI preferences.
- **Runtime & Framework:** Next.js + Bun (Single Next.js app using API Routes for server-side PDF processing & ElevenLabs TTS proxying; no separate Express backend required for V1).
- **AI Dependencies:** Zero LLM/AI dependency for core extraction or narration.

---

## 2. V1 Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
─────────────────────── NEXT.JS APPLICATION (Bun) ────────────────────────
│                                                                        │
│  ┌────────────────┐       ┌─────────────────┐       ┌──────────────┐   │
│  │   PDF Reader   │       │   Audio Player  │       │ Sync Engine  │   │
│  │    (PDF.js)    │       │  (HTML5 Audio)  │       │(Bi-directional)│
│  └───────┬────────┘       └────────┬────────┘       └──────┬───────┘   │
│          │                         │                       │           │
│          └─────────────────────────┼───────────────────────┘           │
│                                    │                                   │
│                        ┌───────────▼───────────┐                       │
│                        │ IndexedDB Repository  │                       │
│                        │(PDFs, Audio, Alignment)                       │
│                        └───────────┬───────────┘                       │
│                                                            │           │
└────────────────────────────────────────────────────────────┼───────────┘
                                                             │ HTTPS API
                                                             ▼
                                                    ┌─────────────────┐
                                                    │ ElevenLabs TTS  │
                                                    │ (Audio + Timings│
                                                    └─────────────────┘
```

---

## 3. Subsystem Detailed Specifications & Components

### 3.1 Subsystem A: Storage Layer (Local-First)
To decouple UI logic from storage backends, V1 implements the **Repository Pattern** and relies heavily on IndexedDB.

#### 3.1.1 IndexedDB Schema (using `idb` library)
Database Name: `pdf_audiobook_db`, Version: `1`
- **Store: `books`** (Key: `id`)
  - Indexes: `createdAt`, `lastReadAt`
- **Store: `pdf_blobs`** (Key: `bookId`)
- **Store: `audio_blobs`** (Key: `[bookId, chunkId]`)
- **Store: `alignments`** (Key: `bookId`)

#### 3.1.2 Contracts (`src/lib/storage/types.ts`)
```typescript
export interface BookMetadata {
  id: string; // UUID v4
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: number; // Unix timestamp
  lastReadAt: number; // Unix timestamp
  lastPosition: { 
    pageIndex: number; 
    audioTimestamp: number; // seconds
  };
  processingStatus: 'queued' | 'extracting' | 'cleaning' | 'synthesizing' | 'ready' | 'error';
  processingProgress: number; // 0 to 100
  errorMessage?: string;
}

export interface BookRepository {
  saveBook(metadata: BookMetadata): Promise<void>;
  getBook(id: string): Promise<BookMetadata | null>;
  listBooks(): Promise<BookMetadata[]>;
  deleteBook(id: string): Promise<void>;
  updateProcessingStatus(id: string, status: BookMetadata['processingStatus'], progress: number): Promise<void>;
  
  savePdfBlob(bookId: string, blob: Blob): Promise<void>;
  getPdfBlob(bookId: string): Promise<Blob | null>;
  
  saveAudioBlob(bookId: string, chunkId: string, blob: Blob): Promise<void>;
  getAudioBlob(bookId: string, chunkId: string): Promise<Blob | null>;
  
  saveAlignmentMap(bookId: string, alignmentData: DocumentAlignment): Promise<void>;
  getAlignmentMap(bookId: string): Promise<DocumentAlignment | null>;
}
```

---

### 3.2 Subsystem B: PDF Parsing & Text Model
Renders the visual document while building a granular spatial text index.

#### 3.2.1 Component: PDF.js Viewer (`src/components/reader/PdfViewer.tsx`)
- **Rendering Engine:** Uses `pdfjs-dist`. Renders each page into a `<canvas>` element.
- **Text Layer:** Renders a transparent `div` layer over the canvas containing `<span>` elements for each text node. This allows for native text selection and custom highlighting.
- **Resize Observer:** Listens to window resizes and re-renders the canvas and text layer at the correct scale to maintain sharp resolution (Device Pixel Ratio handling).

#### 3.2.2 Server-side Spatial Coordinate Extraction (`src/lib/documents/extractor.ts`)
When a PDF is uploaded, server-side code (invoked via Next.js API Routes) uses `pdf.js-extract` or a similar server-side PDF parser to extract raw text nodes with precise bounding boxes.

```typescript
export interface BoundingBox {
  x: number;       // relative to page width
  y: number;       // relative to page height
  width: number;
  height: number;
}

export interface TextSegment {
  id: string;      // segment_{pageIndex}_{index}
  pageIndex: number;
  text: string;
  boundingBox: BoundingBox;
}

export interface PageModel {
  pageIndex: number;
  width: number;
  height: number;
  segments: TextSegment[];
}
```

---

### 3.3 Subsystem C: Deterministic Processing & Cleanup Pipeline
Ensures PDF layout quirks do not pollute the audio narration. Located in `src/lib/documents/pipeline.ts`.

#### 3.3.1 Processing State Machine
1. **Reading Order Resolution:** 
   - Algorithm identifies columns by clustering bounding boxes by their `x` coordinate.
   - Sorts text segments vertically within columns, then left-to-right across columns.
2. **Header/Footer Stripping:** 
   - Compares text segments across the top 10% and bottom 10% of multiple pages. If strings match exactly across >3 pages, flags them as headers/footers and removes them.
3. **Hyphenation Repair:** 
   - Detects segments ending in `-` followed immediately by a lowercase letter on the next line/segment. Rejoins them into a single word.
4. **Whitespace Normalization:** 
   - Collapses multiple spaces and removes mid-sentence line breaks caused by PDF rendering boundaries.
5. **Sentence Segmentation:** 
   - Uses `Intl.Segmenter` or a deterministic regex to split cleaned text into logical sentences.
   - Maps the cleaned sentences back to their original `TextSegment` IDs to preserve bounding box mapping.

---

### 3.4 Subsystem D: TTS Orchestration & Alignment Normalization
Proxies requests to ElevenLabs, handles audio chunking, and normalizes timestamp data.

#### 3.4.1 TTS Provider Interface (`src/lib/tts/provider.ts`)
```typescript
export interface TTSChunkInput {
  chunkId: string;
  text: string;
  voiceId?: string;
  speed?: number;
}

export interface AlignmentItem {
  char: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface TTSResult {
  audioBuffer: Buffer;       // MP3 binary
  alignments: AlignmentItem[];
}

export interface TTSProvider {
  synthesize(input: TTSChunkInput): Promise<TTSResult>;
}
```

#### 3.4.2 TTS Chunking Algorithm (`src/lib/audio/chunker.ts`)
- ElevenLabs has a payload limit (typically ~5000 chars per request).
- **Chunking Rules:**
  1. Accumulate sentences until the character count reaches ~2500 characters.
  2. Never split mid-sentence.
  3. Prefer splitting at paragraph breaks (double newline).
  4. Assign each chunk a sequential ID (`chunk_001`, `chunk_002`).

#### 3.4.3 Alignment Normalization (`src/lib/audio/alignment.ts`)
Maps ElevenLabs character-level offsets to internal sentence and bounding-box coordinates.

```typescript
export interface SentenceTiming {
  sentenceId: string;
  text: string;
  audioStart: number; // Global timeline timestamp (e.g., 145.2s)
  audioEnd: number;   // Global timeline timestamp (e.g., 148.5s)
  pageIndex: number;
  boundingBoxes: BoundingBox[]; // A sentence may span multiple bounding boxes / lines
}

export interface DocumentAlignment {
  bookId: string;
  totalDuration: number;
  chunks: { id: string, duration: number }[];
  timings: SentenceTiming[];
}
```

---

### 3.5 Subsystem E: Bidirectional Synchronization Engine
Manages real-time state synchronization between visual rendering and audio playback. Powered by a Zustand store in `src/store/useSyncStore.ts`.

#### 3.5.1 State Management (Zustand)
```typescript
interface SyncState {
  currentTime: number;
  duration: number;
  activeSentenceId: string | null;
  activePageIndex: number;
  isPlaying: boolean;
  playbackRate: number;
  
  setCurrentTime: (time: number) => void;
  setActiveSentence: (id: string, page: number) => void;
  seekToTime: (time: number) => void; // Intercepted by AudioPlayer component
}
```

#### 3.5.2 Audio → PDF Flow (Playback updates Highlight)
- **Trigger:** HTML5 `<audio>` element fires `timeupdate` event (approx 4 times per second).
- **Action:** Sync engine performs a binary search on `DocumentAlignment.timings` array to find the sentence where `audioStart <= currentTime <= audioEnd`.
- **UI Update:** Updates Zustand store `activeSentenceId`. The `PdfViewer` component reacts by applying a `.highlight-active` CSS class to the corresponding DOM nodes in the text layer.
- **Scroll Logic:** If the bounding box of `activeSentenceId` is outside the visible viewport, smoothly scroll the window/container (`Element.scrollIntoView({ behavior: 'smooth', block: 'center' })`).

#### 3.5.3 PDF → Audio Flow (Click-to-Seek)
- **Trigger:** `onClick` event on the PDF text layer span.
- **Action:** Read `data-sentence-id` from the clicked DOM element.
- **Lookup:** Find the sentence in `DocumentAlignment.timings` to get `audioStart`.
- **UI Update:** Call `seekToTime(audioStart)`. The Audio Player component reacts by setting `audioRef.current.currentTime = audioStart` and calling `audioRef.current.play()`.

---

### 3.6 Subsystem F: Reader UI & Player Controls
Polished, distraction-free audiobook reader interface inspired by premium reader apps.

#### 3.6.1 UI Components (`src/components/reader/`)
1. **`ReaderLayout.tsx`:** 
   - Main wrapper. Handles Dark/Light mode theming via Tailwind.
   - Contains a collapsible left sidebar for Library/Chapter navigation.
2. **`AudioPlayerBar.tsx`:** 
   - Sticky bottom bar.
   - Controls: Play/Pause, Rewind 10s, Fast-Forward 10s.
   - Timeline: Scrubbable `<input type="range">`.
   - Speed Selector: Popover menu for `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`.
3. **`ProcessingOverlay.tsx`:** 
   - Full-screen modal shown during upload.
   - Displays real-time WebSocket/Polling updates: *Uploading (10%) -> Extracting Text (30%) -> Synthesizing Audio (80%) -> Ready (100%)*.

---

## 4. API Contracts (Next.js API Routes)

In V1, server-side processing and ElevenLabs TTS proxying are handled directly via Next.js Route Handlers (`app/api/process/route.ts` & `app/api/jobs/[jobId]/route.ts`):

### 4.1 POST `/api/process`
- **Purpose:** Initiates the PDF processing and TTS pipeline.
- **Request:** `multipart/form-data` containing the `.pdf` file.
- **Response (202 Accepted):**
  ```json
  {
    "jobId": "uuid-v4",
    "status": "processing"
  }
  ```

### 4.2 GET `/api/jobs/[jobId]`
- **Purpose:** Polling endpoint for frontend to check processing status.
- **Response (200 OK):**
  ```json
  {
    "jobId": "uuid-v4",
    "status": "ready",
    "progress": 100,
    "result": {
      "bookId": "uuid-v4",
      "audioChunks": [
        { "id": "chunk_001", "url": "/api/assets/chunk_001.mp3" }
      ],
      "alignmentUrl": "/api/assets/alignment.json"
    }
  }
  ```
*(Note: In V1, the frontend downloads these assets and saves them to IndexedDB, then deletes them from local temporary server storage).*

---

## 5. Implementation Phasing & Roadmap

```text
Phase 1: Storage & Foundation (Days 1–3)
├── Setup Next.js (App Router) + Bun single application structure.
├── Implement IndexedDB Schema & Repository Interfaces (`idb`).
└── Build basic PDF.js viewer component capable of rendering a static file.

Phase 2: Extraction & Cleanup Engine (Days 4–6)
├── Implement Server-side PDF Parsing & Bounding Box extraction.
├── Build deterministic Reading Order and text cleanup pipeline.
└── Build Sentence Segmentation Module.

Phase 3: ElevenLabs Integration & Alignment (Days 7–9)
├── Setup Express TTS Provider Abstraction.
├── Integrate ElevenLabs API with `with_timestamps: true`.
├── Build TTS Chunker to respect API limits.
└── Build Character-to-BoundingBox Alignment Normalizer.

Phase 4: Sync Engine & Player (Days 10–12)
├── Build Zustand state for `useSyncEngine`.
├── Implement Audio -> PDF Highlighting & Auto-scroll logic.
├── Implement PDF -> Audio Click-to-Seek handler.
└── Integrate Custom HTML5 Audio Player Controls & Speed toggles.

Phase 5: UI Polish & E2E Testing (Days 13–15)
├── Implement Dark Mode & Immersive Reader UI Styling (Tailwind).
├── Add Processing Stage Progress Bar / Polling.
└── Perform E2E tests: Layout fidelity, multi-column reading order, audio sync accuracy.
```

---

## 6. Acceptance Criteria & Validation

### 6.1 PDF Layout Fidelity
- [ ] Original PDF layout, images, equations, and typography must remain visually intact (rendered via PDF.js).
- [ ] Multi-column PDFs must be read in natural reading order without interweaving column text.
- [ ] Text selection must work natively on the PDF text layer.

### 6.2 Narration & Sync Accuracy
- [ ] ElevenLabs audio plays continuously without jarring gaps between audio chunks (seamless HTML5 audio queuing).
- [ ] Visual highlight stays within ±200ms of spoken audio.
- [ ] Clicking any sentence in the PDF jumps audio narration to that exact phrase in <100ms.
- [ ] Auto-scroll smoothly keeps the currently spoken sentence in the middle 50% of the viewport.

### 6.3 Performance & Offline Capability
- [ ] Previously processed books load entirely from IndexedDB without network requests (offline playback).
- [ ] UI remains strictly responsive at 60FPS during highlighting updates.

---

## 7. Document Matrix

| Document | Path | Status |
|----------|------|--------|
| **Project Plan & Scope** | `docs/product/PROJECT_PLAN.md` | Complete |
| **V1 Implementation Plan** | `docs/product/V1_IMPLEMENTATION_PLAN.md` | Complete (This file) |
| **V2 Implementation Plan** | `docs/product/V2_IMPLEMENTATION_PLAN.md` | Complete |
