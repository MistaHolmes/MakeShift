# Software Development Plan (SDP): PDF Audiobook / Synchronized PDF Reader

---

## 1. Introduction

### 1.1 Purpose
This Software Development Plan outlines the technical direction, architectural foundation, and execution strategy for the **Synchronized PDF Reader** application. The product transforms standard PDF documents into high-quality, synchronized audiobooks, allowing users to listen to document narration while visually following along with the original text.

### 1.2 Scope
This document covers the full lifecycle of the project, establishing the core technical decisions, system components, implementation phases (V1 and V2), and critical risks. It serves as the canonical reference for all future engineering, design, and product decisions.

### 1.3 Vision and Core Objectives
- **Primary Objective:** Build an immersive application where the user can upload a PDF, press play, and hear the actual document read aloud with precise text highlighting in real-time.
- **Source of Truth:** The original PDF remains visually intact. The system does not rebuild the document as generic HTML.
- **Non-Goals for V1:** The product is explicitly **not** an AI summarizer, chatbot, or generic SaaS dashboard.

---

## 2. Product Experience & User Flow

The fundamental interaction model relies on **bidirectional synchronization** between a visually rendered PDF and an audio narration track.

### 2.1 Core User Journey
1. **Upload:** User drags and drops a PDF onto the application.
2. **Process:** The system extracts text, determines reading order, cleans the output, and orchestrates TTS generation. The UI exposes meaningful progress tracking.
3. **Reader:** User enters a clean, minimal, audiobook-oriented reading interface.
4. **Listen (Audio → PDF):** User presses play. Narration begins, text highlights dynamically (sentence/paragraph level initially, word-level eventually), and the page automatically scrolls.
5. **Click to Seek (PDF → Audio):** User clicks any sentence or paragraph in the PDF. The audio instantly seeks to the corresponding timestamp and resumes playback.

---

## 3. System Architecture

The application adopts a **Monorepo** architecture with high-level domain separation. It avoids unnecessary low-level microservice fragmentation.

### 3.1 Technology Stack
- **Frontend:** Next.js (Web UI, Browser logic) + TypeScript + Tailwind CSS
- **Backend:** Express API + TypeScript
- **Runtime:** Bun
- **PDF Rendering:** PDF.js
- **TTS Provider (V1):** ElevenLabs (chosen for high voice quality and character-level alignment data)
- **V1 Persistence:** IndexedDB (Browser-local storage for PDFs, audio, and metadata)
- **V2 Persistence:** PostgreSQL (Metadata, Users) + Object Storage (S3-compatible for files)

### 3.2 Monorepo Structure
```text
pdf-audiobook/
├── packages/
│   ├── frontend/         # Next.js Application (Reader, Player, Sync Engine, IndexedDB)
│   ├── backend/          # Express API (Books, Documents, PDF Processing, TTS proxy)
│   ├── deployment/       # Docker, K8s, Terraform configurations
│   └── monitoring/       # Logging, metrics, tracing setups
├── docs/                 # Architecture, API, and product documentation
└── scripts/              # Development & deployment tooling
```
*(Note: No shared package is utilized; types and contracts are co-located within their respective packages to prevent tight coupling.)*

---

## 4. Core Subsystems

### 4.1 PDF Rendering & Text Model
- **PDF.js Foundation:** Renders the actual PDF to a canvas, preserving the original layout, images, tables, typography, and complex formatting.
- **Text Layer Overlay:** A transparent HTML overlay mapped to PDF coordinates allows for user interaction (Click to Seek) and dynamic highlighting.
- **Spatial Text Model:** Extracted text maintains a strict relationship with its location:
  `Book → Document → Page → Block → Segment → Sentence → Words`

### 4.2 Document Processing Pipeline (Deterministic)
The V1 processing pipeline is purely deterministic and requires no LLM integration:
1. **Extraction:** Raw text and spatial coordinates are parsed.
2. **Reading Order:** Spatial analysis determines human reading order (handling multi-column layouts, sidebars).
3. **Cleanup:** Rule-based sanitization (removing repeated headers/footers, normalizing whitespace, repairing hyphenation).
4. **Segmentation:** Grouping text into logical chunks (paragraphs, sentences) for TTS.
5. **Alignment:** Mapping ElevenLabs character-level timing data to the internal text model.

### 4.3 TTS Abstraction & Chunking
- **Provider Interface:** While ElevenLabs is the V1 provider, the backend uses a generic `TTSProvider` interface (`synthesize(input: TTSInput): Promise<TTSResult>`).
- **Chunking Algorithm:** Large PDFs are split into sensible narrative chunks preserving paragraph/sentence boundaries, ensuring low latency and consistent voice generation without hitting API limits.

### 4.4 Bidirectional Synchronization Engine
This is the heart of the application:
- **Audio to PDF:** As `audio.currentTime` progresses, the engine resolves the timestamp to a text segment, finds the corresponding bounding box, applies a highlight overlay, and scrolls the page.
- **PDF to Audio:** When a user clicks a coordinate in the PDF text layer, the engine identifies the segment, retrieves the corresponding audio timestamp, updates `audio.currentTime`, and plays.

---

## 5. Implementation Phases

### 5.1 Phase 1: V1 (Personal MVP)
**Focus:** Local-first, highly polished reader experience for a single user.
- **Auth:** Anonymous (No user accounts).
- **Storage:** IndexedDB (Large files: PDFs, Audio, Metadata) and `localStorage` (UI preferences).
- **Processing:** Deterministic PDF processing, ElevenLabs TTS integration.
- **Reader UI:** Elegant, minimal, dark-mode supported, synced highlighting, click-to-seek.
- **Out of Scope for V1:** Databases, cloud sync, authentication, OCR, AI summarization, complex microservices.

### 5.2 Phase 2: V2 (Multi-User Cloud)
**Focus:** Persistence, accounts, and cross-device availability.
- **Auth:** User registration and sessions via the Express backend.
- **Storage:** PostgreSQL (relational data) and Object Storage (PDFs/Audio files).
- **Sync:** Cloud synchronization engine reconciling offline IndexedDB data with the remote store.
- **Features:** Cloud library, persistent reading progress across devices.

### 5.3 Phase 3: Future (AI Extensions)
**Focus:** Value-added intelligence (only when justified).
- **Features:** Clean-spoken versions, inline explanations, study mode (Q&A), and RAG chat.

---

## 6. Technical Risks & Mitigation

| Domain | Risk | Mitigation Strategy |
|--------|------|---------------------|
| **PDF Extraction** | Multi-column reading order, headers/footers, and hyphenation breaking TTS flow. | Build a robust, deterministic spatial analysis and rule-based cleanup pipeline before TTS generation. |
| **Audio Alignment** | Mapping ElevenLabs character timings to PDF bounding boxes accurately. | Normalize provider timings into an internal `WordAlignment` format strictly tied to spatial segments. |
| **Storage Limits** | Browser IndexedDB capacity and eviction policies clearing cached audio. | Implement intelligent cache management; ensure V2 cloud sync provides a durable source of truth. |
| **Sync Latency** | Highlighting lagging behind audio or click-to-seek missing exact targets. | Optimize the text lookup tree in the browser; ensure exact hit-testing on the PDF text layer. |

---

## 7. Canonical Technical Decisions

| Category | Decision |
|----------|----------|
| **Core Product** | Synchronized PDF audiobook reader (NOT an AI summarizer) |
| **PDF Renderer** | PDF.js |
| **Processing** | Deterministic (No LLMs in core pipeline) |
| **TTS Engine** | ElevenLabs (V1), behind a generic `TTSProvider` abstraction |
| **Storage (V1)** | IndexedDB for data; `localStorage` for UI settings |
| **Architecture** | Monorepo (Next.js Frontend, Express Backend). No shared packages. |
| **Datastore (V2)**| PostgreSQL + Object Storage (S3) |
| **Primary Goal** | Flawless, latency-free PDF ↔ audio synchronization |

> *This Software Development Plan serves as the final baseline. Future architectural shifts must be evaluated against the constraints and vision established herein.*

Hand-Off Response [Open-Ai]

```text
And no need to apologize ❤️ — you haven't harassed me at all. This is exactly the kind of back-and-forth that makes the architecture better. We started broad, challenged assumptions, and ended up with a much cleaner product.

Here is the **final handoff**. Treat this as the canonical project context for the next chat.

---

# 🚀 Project Handoff — PDF Audiobook / Synchronized PDF Reader

## 1. Project Vision

I am building a web application that allows a user to **upload a PDF and listen to it as an audiobook while visually following along with the original PDF**.

The product is **not an AI summarizer**.

The fundamental experience is:

> **Upload PDF → press play → hear the actual document → see the corresponding text highlighted → click anywhere in the document to jump the narration there.**

The original PDF remains the **source of truth**.

The product should feel like a combination of:

* a polished PDF reader
* an audiobook player
* synchronized/karaoke-style text highlighting
* eventually, a personal document library

The initial application is primarily for **personal use**, but the architecture should be clean enough to evolve into a multi-user cloud product later.

---

# 2. Core Product Experience

The central interaction is:

```text
                     PDF
                      │
                      ▼
              Document Processing
                      │
                      ▼
               Cleaned Text
                      │
                      ▼
                    TTS
                      │
                      ▼
             Audio + Alignment
                      │
                      ▼
              Synchronization
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
       PDF → Audio             Audio → PDF
          │                       │
   User clicks text         Audio progresses
          │                       │
          └───────────► Sync ◄────┘
```

The application should keep the document and narration synchronized in both directions.

---

# 3. Core User Flow

### Step 1 — Upload

User drags a PDF onto the application.

```text
┌────────────────────────────────────┐
│                                    │
│          Drop your PDF here        │
│                                    │
│        or click to browse          │
│                                    │
└────────────────────────────────────┘
```

---

### Step 2 — Process

The application processes the document.

Potential stages:

```text
Uploading
   ↓
Reading PDF
   ↓
Extracting text
   ↓
Analyzing document structure
   ↓
Cleaning text
   ↓
Preparing narration
   ↓
Generating audio
   ↓
Ready
```

The UI should expose useful progress rather than simply showing a spinner.

---

### Step 3 — Reader

The user enters the main reading/listening interface.

The PDF remains visually intact.

The current narration is highlighted.

---

### Step 4 — Listen

The user presses play.

The narrator reads the document.

The PDF automatically follows along.

---

### Step 5 — Click to Seek

The user clicks a sentence/paragraph.

The audio immediately jumps to that location.

This is one of the defining features of the application.

---

# 4. Reader UI Direction

The UI should be inspired by the reference screenshot previously provided.

The desired design language:

* immersive
* elegant
* modern
* minimal
* reading-focused
* audiobook-oriented
* not a generic SaaS dashboard
* not an AI chatbot interface

A rough conceptual layout:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Logo / Book Title                         Library / Profile │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Chapters /             PDF / Reading Area                   │
│  Navigation                                                   │
│                                                              │
│  Chapter 1              ┌─────────────────────────────┐      │
│                         │                             │      │
│  Chapter 2              │          PDF PAGE           │      │
│                         │                             │      │
│  Chapter 3              │  The history of...         │      │
│                         │                             │      │
│  Chapter 4              │  ███████████████████       │      │
│                         │  Current narration...       │      │
│                         │                             │      │
│                         │  More document text...      │      │
│                         │                             │      │
│                         └─────────────────────────────┘      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     Audio Player                             │
│                                                              │
│              ◀       ─────●────────       ▶                  │
│                       12:42 / 1:47:31                        │
│                                                              │
│                  0.75x  1x  1.25x  1.5x  2x                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

This is conceptual. The exact UX should be designed before implementation.

---

# 5. PDF Rendering

The likely foundation is **PDF.js**.

The important principle:

> **Render the actual PDF rather than rebuilding the entire document as ordinary HTML.**

Conceptually:

```text
                     PDF
                      │
                      ▼
                   PDF.js
                      │
             ┌────────┴────────┐
             ▼                 ▼
        PDF rendering      Text layer
                                 │
                                 ▼
                         Highlighting layer
```

This preserves:

* original layout
* images
* tables
* typography
* columns
* footnotes
* diagrams
* equations
* unusual formatting

as much as possible.

---

# 6. PDF Text Model

The application needs more than plain extracted text.

For example:

```json
{
  "id": "segment_829",
  "page": 14,
  "text": "Ancient Indian architecture developed during several periods.",
  "boundingBox": {
    "x": 142,
    "y": 382,
    "width": 610,
    "height": 27
  }
}
```

The actual model will likely be more sophisticated.

Potential hierarchy:

```text
Book
 └── Document
      ├── Page
      │    ├── Block
      │    │    ├── Segment
      │    │    │    ├── Sentence
      │    │    │    └── Words
```

The purpose is to maintain a relationship between:

```text
PDF location
      ↕
text
      ↕
audio timing
```

---

# 7. Highlighting Strategy

### V1

Sentence or paragraph-level highlighting.

### Later

Word-level highlighting.

Ideal eventual experience:

```text
The city began to grow rapidly
              ▲
       currently spoken
```

Then:

```text
The city began to grow rapidly
                  ▲
```

etc.

Word-level synchronization is desirable but should not compromise reliability.

---

# 8. Bidirectional Synchronization

## Audio → PDF

```text
audio.currentTime
        ↓
find matching timing
        ↓
find text segment
        ↓
find page/bounding box
        ↓
highlight
        ↓
scroll into view
```

## PDF → Audio

```text
user clicks text
        ↓
identify segment
        ↓
find audio timestamp
        ↓
audio.currentTime = timestamp
        ↓
play
```

This should be treated as a core subsystem.

---

# 9. PDF Processing Without AI

The initial product does **not require an LLM**.

The processing pipeline should be deterministic:

```text
PDF
 ↓
PDF Parser
 ↓
Text + Coordinates
 ↓
Reading Order
 ↓
Cleanup
 ↓
Segmentation
 ↓
TTS
 ↓
Audio + Alignment
 ↓
Synchronization Metadata
```

---

# 10. Text Cleanup

Use deterministic rules initially.

Potential operations:

* remove repeated headers
* remove repeated footers
* remove page numbers
* normalize whitespace
* repair obvious line breaks
* repair obvious PDF hyphenation
* identify headings
* identify paragraphs
* remove extraction artifacts
* optionally handle citation/URL clutter

The cleanup system must be conservative.

It should not accidentally alter the meaning of the document.

---

# 11. Reading Order

This is an important technical challenge.

PDFs do not necessarily store text in human reading order.

For example:

```text
┌──────────────┬──────────────┐
│ Column 1     │ Column 2     │
│              │              │
│ text         │ text         │
│ text         │ text         │
│ text         │ text         │
└──────────────┴──────────────┘
```

The extraction pipeline needs to determine a sensible reading order.

This needs to be investigated carefully during implementation.

---

# 12. OCR

Scanned PDFs are a future capability.

For scanned documents:

```text
PDF
 ↓
Page image
 ↓
OCR
 ↓
Text + coordinates
 ↓
Same downstream pipeline
```

OCR does not require an LLM.

Normal text PDFs should be handled first.

---

# 13. AI Strategy

AI is **not part of the core architecture**.

No requirement for:

* summaries
* LLM rewriting
* AI explanations
* AI chat
* RAG
* embeddings
* vector databases

The application should work perfectly without AI.

Potential future features:

```text
Original
    ↓
Reads document as written

Clean
    ↓
Better spoken version

Explain
    ↓
AI explains difficult sections

Study Mode
    ↓
Explanations + questions

Ask PDF
    ↓
AI Q&A
```

These are future extensions.

---

# 14. Final TTS Decision

## V1 TTS: ElevenLabs

For the initial personal MVP, **ElevenLabs is the chosen TTS provider**.

The reasons:

* excellent voice quality
* particularly suitable for long-form narration
* appropriate for audiobook-style experiences
* current API provides alignment/timing capabilities
* suitable for personal development/testing
* we are initially the only user
* free allowance is sufficient for development/testing
* provider abstraction means we can replace it later

The current ElevenLabs offering provides TTS capabilities with alignment/timestamp information, and also has forced-alignment capabilities.

The important point is:

> **We are choosing ElevenLabs because it fits both the narration quality requirement and the synchronization requirement.**

Not simply because it sounds good.

---

# 15. ElevenLabs Synchronization

The intended flow is:

```text
Cleaned PDF text
       │
       ▼
 ElevenLabs
       │
       ├── Audio
       │
       └── Character timing/alignment
                │
                ▼
          Our alignment engine
                │
          ┌─────┴─────┐
          ▼           ▼
        Words      Sentences
          │           │
          └─────┬─────┘
                ▼
           PDF segments
```

The provider-specific alignment should be normalized into our own internal format.

For example:

```typescript
interface WordAlignment {
  textStart: number;
  textEnd: number;
  audioStart: number;
  audioEnd: number;
}
```

Exact structure is TBD.

---

# 16. TTS Provider Abstraction

Even though ElevenLabs is the V1 provider, the backend should **not be tightly coupled to ElevenLabs**.

Use:

```typescript
interface TTSProvider {
  synthesize(input: TTSInput): Promise<TTSResult>;
}
```

Then:

```text
TTSProvider
    │
    └── ElevenLabsTTSProvider
```

Future:

```text
TTSProvider
├── ElevenLabsTTSProvider
├── AzureTTSProvider
├── AmazonPollyTTSProvider
├── GoogleTTSProvider
└── LocalTTSProvider
```

The synchronization engine should only consume the normalized `TTSResult`.

---

# 17. V1 TTS Philosophy

For V1:

**Don't optimize for millions of users.**

Optimize for:

1. voice quality
2. synchronization accuracy
3. latency
4. reliable long-form narration
5. clean chunking
6. correct pronunciation

Since the initial user is me, cost optimization is secondary to proving the product experience.

Once the product works, we can benchmark alternative providers for cost and scale.

---

# 18. TTS Chunking

Long documents should be split into sensible chunks.

Potential hierarchy:

```text
Book
 ├── Chapter
 │    ├── Segment
 │    ├── Segment
 │    └── Segment
 │
 ├── Chapter
 │    ├── Segment
 │    └── Segment
 │
 └── ...
```

TTS should not blindly process a massive 500-page PDF in one request.

Chunking should preserve:

* sentence boundaries
* paragraph boundaries
* alignment
* audio ordering
* document position

The exact chunking algorithm remains to be designed.

---

# 19. V1 Storage

No database initially.

Use:

## IndexedDB

For:

* PDFs
* audio
* extracted text
* document metadata
* page/segment mappings
* synchronization metadata
* books
* progress
* processing state

## localStorage

Only for small preferences:

* playback speed
* theme
* volume
* UI settings

Do **not** put PDFs/audio in localStorage.

---

# 20. V1 Local-First Architecture

```text
                         Browser
                            │
                ┌───────────┴───────────┐
                │                       │
              Next.js              IndexedDB
                │                       │
                │                 ┌─────┴─────┐
                │                 │           │
                │                PDFs        Audio
                │                 │           │
                │                 └─────┬─────┘
                │                       │
                └─────────────── Reader │
                                        │
                                        ▼
                                   Sync Engine
```

The Express backend is used when server-side functionality is required, especially TTS.

---

# 21. Backend Architecture

## Express + TypeScript

The backend is a **separate high-level application from Next.js**.

Do not build the backend primarily using:

* Next.js API routes
* Next.js server actions
* database calls from frontend components

Instead:

```text
Next.js
   │
   │ HTTP
   ▼
Express + TypeScript
```

---

# 22. Backend Responsibility

The backend may contain:

```text
Backend
├── Books
├── Documents
├── PDF processing
├── Audio/TTS
├── Users
├── Authentication
├── Storage
└── Other application domains
```

These are **internal backend modules**, not separate microservices.

---

# 23. Important Microservice Philosophy

I want a **monorepo with high-level separation**, but I do NOT want unnecessary low-level microservice fragmentation.

Do NOT make:

```text
PDF microservice
Audio microservice
OCR microservice
Book microservice
Storage microservice
...
```

Instead:

```text
Frontend
Backend
Shared
Deployment
Monitoring
```

These are the high-level boundaries.

Inside the backend:

```text
Backend
├── books
├── documents
├── audio
├── users
├── PDF processing
├── storage
└── etc.
```

These remain internal modules.

If something genuinely needs independent deployment later, it can be extracted.

---

# 24. Final Folder Structure

This is the **decided starting structure**:

```text
pdf-audiobook/
│
├── packages/
│   │
│   ├── frontend/
│   │   └── web/                         # Next.js + TypeScript
│   │       │
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       ├── hooks/
│   │       ├── lib/
│   │       ├── providers/
│   │       ├── styles/
│   │       └── ...
│   │
│   ├── backend/
│   │   └── api/                         # Express + TypeScript
│   │       │
│   │       ├── src/
│   │       │   │
│   │       │   ├── modules/
│   │       │   │   ├── books/
│   │       │   │   ├── documents/
│   │       │   │   ├── audio/
│   │       │   │   ├── users/
│   │       │   │   └── ...
│   │       │   │
│   │       │   ├── infrastructure/
│   │       │   │   ├── database/
│   │       │   │   ├── storage/
│   │       │   │   ├── tts/
│   │       │   │   └── ...
│   │       │   │
│   │       │   ├── middleware/
│   │       │   ├── config/
│   │       │   ├── routes/
│   │       │   └── server.ts
│   │       │
│   │       └── ...
│   │
│   ├── shared/
│   │   ├── types/
│   │   ├── contracts/
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── deployment/
│   │   ├── docker/
│   │   ├── kubernetes/
│   │   ├── terraform/
│   │   └── ...
│   │
│   └── monitoring/
│       ├── logging/
│       ├── metrics/
│       └── tracing/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── product/
│   └── decisions/
│
├── scripts/
│   ├── development/
│   └── deployment/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── README.md
```

This is the canonical folder structure unless future architectural decisions justify changing it.

---

# 25. Backend Internal Structure

The backend is one application/service.

Inside it, organize by domain:

```text
backend/api/
└── src/
    │
    ├── modules/
    │   ├── books/
    │   ├── documents/
    │   ├── audio/
    │   ├── users/
    │   └── ...
    │
    ├── infrastructure/
    │   ├── database/
    │   ├── storage/
    │   ├── tts/
    │   └── ...
    │
    ├── middleware/
    ├── config/
    ├── routes/
    └── server.ts
```

The exact internal layering can be refined during implementation.

---

# 26. Shared Package

`packages/shared` should contain things genuinely shared between frontend and backend.

Potentially:

```text
shared/
├── types/
├── contracts/
├── constants/
└── utils/
```

Examples:

```typescript
Book
Document
Page
TextSegment
BoundingBox
AudioSegment
AudioTiming
ProcessingStatus
```

And API contracts.

Avoid turning `shared` into a dumping ground.

---

# 27. Repository Architecture

The frontend should not be tightly coupled to IndexedDB.

Example:

```typescript
interface BookRepository {
  getBook(id: string): Promise<Book | null>;
  saveBook(book: Book): Promise<void>;
  deleteBook(id: string): Promise<void>;
  listBooks(): Promise<Book[]>;
}
```

V1:

```text
BookRepository
      │
      └── IndexedDBBookRepository
```

V2:

```text
BookRepository
      │
      ├── IndexedDBBookRepository
      ├── CloudBookRepository
      └── SyncingBookRepository
```

This allows local-first V1 to evolve into cloud persistence without rewriting the UI.

---

# 28. Domain Independence

Domain models should not depend on:

* React
* Next.js
* Express
* IndexedDB
* PostgreSQL
* ElevenLabs
* AWS
* browser APIs

The domain describes the application.

Infrastructure implements the details.

---

# 29. V1 Architecture

The intended V1 is:

```text
                    ┌───────────────────┐
                    │     Next.js       │
                    │      Web UI       │
                    └─────────┬─────────┘
                              │
                     Browser-side logic
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
           PDF.js         IndexedDB       Sync Engine
             │                │                │
             │                │                │
             └────────────────┼────────────────┘
                              │
                              │ TTS request
                              ▼
                    ┌───────────────────┐
                    │ Express + TS API  │
                    └─────────┬─────────┘
                              │
                              ▼
                         ElevenLabs
```

No database.

No authentication.

No cloud library.

No AI.

No unnecessary microservices.

---

# 30. V2 Architecture

When persistence/accounts become necessary:

```text
                       ┌──────────────────┐
                       │     Next.js      │
                       │      Web         │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Express + TS API │
                       └────────┬─────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
          PostgreSQL       Object Storage      TTS
               │                │                │
               │          PDFs + Audio           │
               │                                 │
               └──────────────┬──────────────────┘
                              │
                         Cloud Sync
                              │
                              ▼
                          IndexedDB
                              │
                              ▼
                           Browser
```

Users can then have:

* accounts
* cloud libraries
* persistent PDFs
* persistent generated audio
* progress synchronization
* settings synchronization
* multiple devices

---

# 31. V1 → V2 Evolution

The intended evolution is:

```text
V1
Anonymous
   ↓
Local IndexedDB
   ↓
ElevenLabs
   ↓
Local reading experience
```

↓

```text
V2
Accounts
   ↓
IndexedDB + Cloud
   ↓
PostgreSQL + Object Storage
   ↓
Cross-device synchronization
```

↓

```text
Future
Optional AI
   ↓
Summaries
Explanations
Study Mode
Q&A
```

Nothing in V1 should make these future additions unnecessarily difficult.

---

# 32. Future Cloud Synchronization

Eventually:

```text
                   BookRepository
                        │
               ┌────────┴────────┐
               │                 │
          Local Store        Remote Store
               │                 │
           IndexedDB          Express API
               │                 │
               └───────┬─────────┘
                       │
                      Sync
```

The exact sync strategy is TBD.

Things to eventually consider:

* conflict resolution
* offline changes
* progress merging
* upload/download state
* document identity
* versioning
* deletion propagation
* partial synchronization
* large file handling

---

# 33. V1 Feature List

## Essential

* PDF upload
* PDF rendering
* text extraction
* coordinates
* basic cleanup
* text segmentation
* ElevenLabs TTS
* audio playback
* audio/PDF synchronization
* text highlighting
* click text → seek audio
* audio → PDF highlighting
* page navigation
* playback speed
* resume position
* IndexedDB storage
* polished reader UI

## Strongly desirable

* chapter detection
* sentence-level highlighting
* word-level highlighting
* drag/drop
* processing progress
* keyboard shortcuts
* dark mode
* audio download

## Post-V1

* OCR
* accounts
* cloud storage
* PostgreSQL
* cross-device sync
* cloud library
* multiple TTS providers
* AI features
* subscriptions
* advanced mobile experience

---

# 34. Things Explicitly Out of Scope for V1

Do not prematurely build:

* AI summarization
* AI chat
* RAG
* vector database
* embeddings
* Kubernetes-heavy architecture
* dozens of microservices
* authentication
* subscriptions
* social features
* recommendation engines
* complex cloud synchronization
* elaborate monitoring infrastructure

The first goal is to make the **reader/narrator experience excellent**.

---

# 35. Main Technical Risks

The next engineering/design phase should investigate:

### PDF

* extraction accuracy
* reading order
* multi-column documents
* coordinates
* text selection
* headers/footers
* hyphenation
* footnotes
* tables
* scanned documents

### Audio

* ElevenLabs alignment
* word timestamps
* sentence timestamps
* chunking
* long-form consistency
* latency
* caching

### Synchronization

* character → word mapping
* word → sentence mapping
* sentence → PDF segment mapping
* PDF bounding boxes
* click-to-seek accuracy
* scroll synchronization

### Storage

* IndexedDB capacity
* large audio files
* browser storage eviction
* offline playback
* cache management

### Future

* cloud synchronization
* authentication
* object storage
* database design

---

# 36. Most Important Design Principle

The product isn't fundamentally about AI.

It isn't fundamentally about TTS either.

The real product is the **synchronized relationship between the document and the narration**.

The experience we are trying to create is:

> **I have a PDF open. I press play. Someone reads it to me. I can see exactly where they are. If I click somewhere else, they immediately continue from there.**

That is the core.

---

# 37. Immediate Next Step in the New Chat

Do **not** jump directly into writing the entire application.

Start by designing the system in detail.

The first things to work through should be:

1. **Reader UX**
2. **PDF.js architecture**
3. **PDF extraction model**
4. **Text cleanup**
5. **Document segmentation**
6. **ElevenLabs integration**
7. **TTS chunking**
8. **Alignment data model**
9. **PDF ↔ audio synchronization engine**
10. **IndexedDB schema**
11. **Express API contracts**
12. **Frontend/backend boundaries**
13. **V1 processing lifecycle**
14. **Error/retry handling**
15. **Future V2 persistence architecture**

Only after these are designed should implementation begin.

---

# Final Technical Direction

### V1

```text
┌──────────────────────────────────────────┐
│                  WEB                     │
│              Next.js + TS                │
│                                          │
│  PDF.js                                  │
│  Reader                                  │
│  Audio Player                            │
│  Highlighting                            │
│  Sync Engine                             │
│  IndexedDB                               │
└────────────────────┬─────────────────────┘
                     │
                     │ HTTP
                     ▼
┌──────────────────────────────────────────┐
│                 BACKEND                  │
│             Express + TS                 │
│                                          │
│  Books                                   │
│  Documents                               │
│  PDF Processing                          │
│  Audio/TTS                               │
│  Infrastructure                          │
└────────────────────┬─────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  ElevenLabs  │
              └──────────────┘
```

### V2

```text
┌───────────────────┐
│     Next.js       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Express + TS API  │
└─────────┬─────────┘
          │
     ┌────┼───────────────┐
     │    │               │
     ▼    ▼               ▼
 Postgres  Object       ElevenLabs
           Storage
     │        │
     └────┬───┘
          ▼
       Cloud Sync
          │
          ▼
       IndexedDB
          │
          ▼
       Browser
```

### Future, only if justified

```text
Frontend
    │
    ▼
Backend
 ├── Books / Users / API
 ├── Processing
 └── Audio
```

with individual backend services extracted **only when scale or operational requirements justify it**.

---

## Canonical decisions

| Area                | Decision                                 |
| ------------------- | ---------------------------------------- |
| Product             | Synchronized PDF audiobook reader        |
| Core behavior       | Narrate actual PDF content               |
| Summarization       | ❌ Not part of core                       |
| LLM                 | ❌ Not required                           |
| Cleanup             | Deterministic initially                  |
| PDF renderer        | PDF.js                                   |
| Synchronization     | Core feature                             |
| Highlighting        | Sentence/paragraph → eventually word     |
| Click-to-seek       | Core feature                             |
| TTS                 | **ElevenLabs for V1**                    |
| TTS abstraction     | Yes                                      |
| Frontend            | **Next.js + TypeScript**                 |
| Backend             | **Express + TypeScript**                 |
| Architecture        | Monorepo                                 |
| Service granularity | High-level, not microservice-per-feature |
| V1 DB               | ❌ None                                   |
| V1 persistence      | **IndexedDB**                            |
| Small settings      | localStorage                             |
| Future DB           | PostgreSQL                               |
| Future files        | Object storage                           |
| Future auth         | Express backend                          |
| Future sync         | IndexedDB + cloud                        |
| Future AI           | Optional                                 |
| Deployment          | Separate high-level deployment package   |
| Monitoring          | Separate high-level monitoring package   |
| Primary goal        | Excellent PDF ↔ audio synchronization    |

```

