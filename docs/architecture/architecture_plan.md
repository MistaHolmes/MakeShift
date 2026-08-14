# MakeShift Audio - Backend Architecture Plan

This document outlines the architectural shift from a completely client-side application to a robust "Thin Client, Heavy Backend" model using **ElevenLabs** for high-quality, timestamped TTS and **NeonDB (PostgreSQL)** for persistence.

## 1. System Overview

### The Stack
- **Database**: NeonDB (Serverless PostgreSQL)
- **ORM**: Prisma
- **Backend Framework**: Express running on Bun (for speed and low memory footprint)
- **Audio Generation**: ElevenLabs API (`with-timestamps` endpoint)
- **File Storage**: (Recommendation) Cloudflare R2 or AWS S3 for storing PDFs and Audio files. *Free deployment services like Render or Railway have ephemeral filesystems, meaning if we save MP3s locally, they will be deleted when the server restarts.*

---

## 2. Database Schema (Prisma)

We will use Prisma to manage the relationship between uploaded PDFs and their generated audio pages.

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Points to NeonDB
}

generator client {
  provider = "prisma-client-js"
}

model Document {
  id        String   @id @default(cuid())
  title     String
  filename  String
  status    DocStatus @default(UPLOADED)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pages     Page[]
}

model Page {
  id             String     @id @default(cuid())
  documentId     String
  pageNumber     Int
  textContent    String
  audioUrl       String?    // URL to the stored MP3 in S3/R2
  alignmentData  Json?      // ElevenLabs timestamps: { chars: [], start_times: [], end_times: [] }
  status         PageStatus @default(PENDING)
  
  document       Document   @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

enum DocStatus {
  UPLOADED
  PARSING
  GENERATING_AUDIO
  READY
  ERROR
}

enum PageStatus {
  PENDING
  GENERATED
  ERROR
}
```

---

## 3. Step-by-Step Data Flow

### Step 1: PDF Ingestion & Parsing
1. **Upload**: User uploads a PDF from the mobile browser (`POST /api/documents/upload`).
2. **Server-side Parsing**: Instead of crashing the mobile browser, the Bun backend uses a library like `pdf-parse` or `pdfjs-dist` (running server-side) to read the PDF.
3. **Chunking**: The backend extracts text page-by-page.
4. **Database Storage**: The backend creates a `Document` record and a `Page` record for every page containing the extracted text.

### Step 2: ElevenLabs TTS Generation
*To avoid locking up the server and hitting ElevenLabs rate limits, this happens asynchronously.*
1. **API Call**: The backend sends the text of a `Page` to the ElevenLabs `POST /v1/text-to-speech/{voice_id}/with-timestamps` endpoint.
2. **Timestamp Extraction**: ElevenLabs returns the audio stream **AND** a JSON object mapping characters to exact millisecond timestamps.
3. **Storage**: The backend uploads the audio stream to Object Storage (e.g., Cloudflare R2) and gets a public URL (`audioUrl`).
4. **Update DB**: The `Page` record is updated with the `audioUrl` and the `alignmentData`.

### Step 3: Frontend Playback (Mobile Optimized)
1. **Fetch Data**: The frontend calls `GET /api/documents/:id/pages`.
2. **Native Audio**: The frontend uses the standard HTML5 `<audio>` element to play the `audioUrl`. This works perfectly in the background on mobile and integrates with lock-screen media controls.
3. **Highlighting Sync**: Using the `alignmentData` JSON from ElevenLabs, the frontend listens to the `<audio>` tag's `timeupdate` event. It compares the current time to the timestamps and applies a `text-highlight` CSS class to the currently spoken sentence or word.

---

## 4. Proposed API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/documents/upload` | Accepts a PDF file (`multipart/form-data`), parses it, saves pages to DB. Returns Document ID. |
| `GET` | `/api/documents` | Lists all uploaded books/documents. |
| `GET` | `/api/documents/:id` | Gets details for a specific document. |
| `GET` | `/api/documents/:id/pages` | Gets all pages for a document, including `audioUrl` and `alignmentData` (used by the frontend player). |
| `POST` | `/api/documents/:id/generate`| Triggers the ElevenLabs generation process for pending pages. |

---

## 5. Next Implementation Steps (Once Approved)
1. **Initialize Backend ORM**: Set up Prisma in the backend with the NeonDB URI.
2. **Configure Cloud Storage**: We need a place to store the MP3s. (I highly recommend Cloudflare R2 for generous free tier limits. Do you have an AWS/R2 account we can use?)
3. **Write the Ingestion Route**: Implement `multer` (or Bun native file upload) and `pdf-parse`.
4. **Integrate ElevenLabs**: Write the service that calls ElevenLabs and processes the timestamp data.
5. **Update Frontend**: Strip out the old client-side PDF logic and replace it with simple API fetch calls and HTML5 audio controls.
