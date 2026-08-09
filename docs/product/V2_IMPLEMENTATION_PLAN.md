# Software Development Plan (SDP): V2 Implementation — Multi-User Cloud Architecture & Sync

---

## 1. Executive Summary & Scope

### 1.1 Objective
The primary objective of **Version 2 (V2)** is to evolve the V1 local-first application into a robust, multi-user cloud platform. V2 introduces user accounts, server-side data persistence (PostgreSQL + Object Storage), cross-device reading progress synchronization, asynchronous background document processing, and multi-provider TTS capability, while retaining the client's offline-first performance via IndexedDB.

### 1.2 Boundary & Scope Expansion
- **Target Audience:** Multi-user cloud platform (SaaS-ready architecture).
- **Authentication:** Secure email/password authentication with JWT / HTTP-Only Cookie session management.
- **Backend Datastore:** PostgreSQL for relational data; S3-compatible Object Storage for binary assets (PDFs & Audio chunks).
- **Asynchronous Task Processing:** Redis + BullMQ for robust job queues handling PDF parsing, text extraction, and TTS synthesis.
- **Client Storage & Sync:** Hybrid `SyncingBookRepository` bridging local IndexedDB with remote cloud APIs via conflict-free resolution.
- **Multi-TTS:** Expand beyond ElevenLabs to support Azure, AWS Polly, and local fallback engines.

---

## 2. V2 Architecture & Data Topology

```text
                                   ┌───────────────────────────────────┐
                                   │       FRONTEND (Next.js + Bun)    │
                                   │                                   │
                                   │ ┌───────────────────────────────┐ │
                                   │ │      SyncingBookRepository    │ │
                                   │ └───────┬───────────────┬───────┘ │
                                   └─────────┼───────────────┼─────────┘
                                             │               │
                                   IndexedDB │ (Local)       │ HTTP / WebSockets (Cloud)
                                             ▼               ▼
┌───────────────────────────┐      ┌───────────────────────────────────┐
│     Browser IndexedDB     │      │      BACKEND (Express + Bun)      │
│(Offline Cache & Fast Sync)│      │                                   │
└───────────────────────────┘      │ ┌────────────┐     ┌────────────┐ │
                                   │ │ Auth Module│     │ Sync API   │ │
                                   │ └────────────┘     └────────────┘ │
                                   │ ┌────────────┐     ┌────────────┐ │
                                   │ │ Books API  │     │ Queue Workr│ │
                                   │ └──────┬─────┘     └─────┬──────┘ │
                                   └────────┼─────────────────┼────────┘
                                            │                 │
                      ┌─────────────────────┼─────────────────┼─────────────────────┐
                      │                     │                 │                     │
                      ▼                     ▼                 ▼                     ▼
             ┌─────────────────┐   ┌─────────────────┐   ┌─────────┐       ┌────────────────┐
             │   PostgreSQL    │   │ S3 Object Store │   │  Redis  │       │  TTS Providers │
             │(Users, Progress)│   │ (PDFs & Audio)  │   │ (Queue) │       │(ElevenLabs, etc)│
             └─────────────────┘   └─────────────────┘   └─────────┘       └────────────────┘
```

---

## 3. Subsystem Detailed Specifications & Components

### 3.1 Subsystem A: Authentication & User Domain (`packages/backend/src/modules/users`)

#### 3.1.1 Data Models (Drizzle ORM)
```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### 3.1.2 Session Management Strategy
- **Authentication Standard:** JWT (JSON Web Tokens).
- **Access Token:** Short-lived (15 minutes), returned in response body, stored in memory (Zustand) on the client.
- **Refresh Token:** Long-lived (7 days), attached to `Set-Cookie` as `HttpOnly, Secure, SameSite=Strict`. Prevents XSS attacks.
- **Middleware:** `requireAuth` middleware verifies Access Tokens on protected routes.

#### 3.1.3 Auth API Endpoints
- `POST /api/v2/auth/register` — Validates payload, hashes password (Argon2), creates User.
- `POST /api/v2/auth/login` — Verifies password, issues Access & Refresh tokens.
- `POST /api/v2/auth/refresh` — Validates HttpOnly cookie, issues new Access token.
- `POST /api/v2/auth/logout` — Clears HttpOnly cookie.
- `GET  /api/v2/auth/me` — Returns sanitized user profile.

---

### 3.2 Subsystem B: Relational Data Layer (PostgreSQL)

#### 3.2.1 Database Schema Extensons (`packages/backend/src/infrastructure/database/schema.ts`)
```typescript
export const books = pgTable('books', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  fileName: text('file_name').notNull(),
  processingStatus: varchar('processing_status').notNull(), // 'queued', 'extracting', etc.
  pdfObjectKey: text('pdf_object_key'), // S3 Key
  alignmentObjectKey: text('alignment_object_key'), // S3 Key for large JSON
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const audioChunks = pgTable('audio_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').references(() => books.id).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  audioObjectKey: text('audio_object_key').notNull(), // S3 Key
});

export const readingProgress = pgTable('reading_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  bookId: uuid('book_id').references(() => books.id).notNull(),
  audioTimestamp: real('audio_timestamp').notNull(),
  pageIndex: integer('page_index').notNull(),
  lastSyncedAt: timestamp('last_synced_at').notNull(), // Client UTC timestamp for Last-Write-Wins
}, (t) => ({
  unq: uniqueIndex('user_book_idx').on(t.userId, t.bookId),
}));
```

---

### 3.3 Subsystem C: Cloud Object Storage (`packages/backend/src/infrastructure/storage`)

Handles storage of PDFs and generated MP3 files securely.

#### 3.3.1 Provider Interface (S3 / R2)
```typescript
export interface ObjectStorageProvider {
  uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteDirectory(prefix: string): Promise<void>;
}
```

#### 3.3.2 Data Organization & Security
- **S3 Prefix Structure:** `tenant_{userId}/book_{bookId}/original.pdf`, `tenant_{userId}/book_{bookId}/chunk_001.mp3`.
- **Security:** S3 Bucket is strictly **private**. The backend issues short-lived (60 minute) Presigned URLs to the client. The frontend HTML5 `<audio>` player streams directly from S3 using these URLs, relieving bandwidth from the Express backend.

---

### 3.4 Subsystem D: Asynchronous Processing & Queue Infrastructure
Processing PDFs and synthesizing 100-page TTS audio takes time. We must use background workers.

#### 3.4.1 Job Queue (Redis + BullMQ)
Located in `packages/backend/src/modules/documents/queue.ts`.
- **Queue Initialization:** `new Queue('document-processing', { connection: redisClient })`
- **Worker Pipeline:**
  1. **Upload Handler:** Express route accepts file, uploads to S3, creates DB record `status: queued`, adds job to queue, returns `202 Accepted`.
  2. **Worker 1 (Extraction):** Downloads PDF from S3 to temp disk, runs spatial extraction & cleanup, updates DB `status: extracting`.
  3. **Worker 2 (Synthesis):** Chunks text, sends parallel requests to TTS Provider (respecting rate limits), uploads MP3s to S3, generates alignment JSON, uploads JSON to S3, updates DB `status: ready`.

#### 3.4.2 Real-time Notifications (Server-Sent Events)
- Endpoint: `GET /api/v2/books/:id/status/stream`
- Allows the frontend to display a live progress bar without aggressive HTTP polling.

---

### 3.5 Subsystem E: Cloud Sync & Offline-First Repository Engine
Bridging V1's local IndexedDB with V2's Cloud APIs.

#### 3.5.1 Hybrid Repository (`packages/frontend/lib/storage/syncingRepository.ts`)
Implements the same `BookRepository` interface from V1, but alters the logic:

1. **Write Path (Progress Update):** 
   - Write new progress immediately to IndexedDB (zero latency).
   - Add a sync mutation to a background queue.
   - Fire API request `PUT /api/v2/sync/progress` with client timestamp.
2. **Sync Protocol (Last-Write-Wins):**
   - When app opens, call `GET /api/v2/sync/state`.
   - Compare backend `lastSyncedAt` with IndexedDB `lastSyncedAt`.
   - If backend is newer, update IndexedDB. If local is newer (offline usage), push to backend.
3. **Asset Caching (Service Worker / idb):**
   - When a user opens a book, presigned URLs for audio chunks are prefetched and stored in IndexedDB as Blob data to ensure offline playback continues seamlessly.

---

### 3.6 Subsystem F: Multi-TTS Provider Infrastructure
V2 abstracts ElevenLabs to allow cost-effective or custom alternatives.

#### 3.6.1 Provider Registry
```typescript
export type TTSProviderType = 'elevenlabs' | 'azure' | 'polly';

export interface TTSProviderRegistry {
  registerProvider(type: TTSProviderType, provider: TTSProvider): void;
  getProvider(type: TTSProviderType): TTSProvider;
}
```

#### 3.6.2 Dynamic Configuration
- Users can select their preferred TTS engine in settings.
- **Azure TTS Provider:** Cheaper alternative. Uses SSML `<bookmark>` tags or word-boundary events to generate timestamps equivalent to ElevenLabs character alignment.
- **API Key Delegation:** Allow power users to supply their own API keys (encrypted at rest in PostgreSQL using KMS/AES-256) to bypass platform limits.

---

## 4. Implementation Phasing & Roadmap

```text
Phase 1: Authentication & Database Foundations (Days 1–5)
├── Setup PostgreSQL, Redis, and Drizzle ORM schema migrations.
├── Build Auth API (JWT/Cookies) and User Management routes.
└── Implement Frontend Next.js Auth Context & Login/Register UI.

Phase 2: Object Storage & Cloud Book API (Days 6–9)
├── Implement S3/R2 Storage Provider abstraction & Presigned URLs.
├── Refactor V1 Book Upload API to store in S3 and Postgres.
└── Build Cloud Document Library UI (fetching from backend API).

Phase 3: Background Worker Queue & Processing (Days 10–14)
├── Setup BullMQ Job Queue workers for Extraction and Synthesis.
├── Refactor V1 Processing Pipeline to run inside BullMQ workers.
└── Implement Server-Sent Events (SSE) for frontend processing progress.

Phase 4: Cross-Device Sync & Progress Engine (Days 15–18)
├── Implement `SyncingBookRepository` (IndexedDB ↔ Cloud API).
├── Build Reading Progress Sync protocol with Last-Write-Wins logic.
└── Build Device Sync Status indicator UI (Offline/Online/Syncing).

Phase 5: Multi-TTS Extension & Security Polish (Days 19–22)
├── Integrate Azure TTS provider utilizing SSML word boundaries.
├── Implement API key encryption for Bring-Your-Own-Key features.
└── Conduct Tenant Isolation & Presigned URL expiry security audits.
```

---

## 5. Security, Privacy & Performance Standards

### 5.1 Multi-Tenant Security
- **Data Isolation:** Every PostgreSQL query MUST enforce user ownership (`WHERE user_id = :userId` or via Row-Level Security in Postgres).
- **Storage Isolation:** S3 prefixes explicitly scoped per user ID (`tenant_{userId}/...`).
- **URL Protection:** Direct public access to S3 buckets is disabled. Client assets require authenticated presigned URLs with strict expiry (max 60 mins).

### 5.2 Storage & Network Efficiency
- **Chunk Streaming:** Audio files streamed in byte ranges (`Range: bytes=0-`) to prevent browser memory spikes for 10+ hour audiobooks.
- **Lazy Loading Asset Sync:** Books are not downloaded to IndexedDB until the user explicitly marks them "Available Offline" or opens the book.

---

## 6. Acceptance Criteria & Validation

### 6.1 Authentication & Multi-Tenancy
- [ ] Users can register, log in, maintain active sessions across tabs, and log out securely.
- [ ] JWT access tokens expire correctly; refresh token rotation works seamlessly.
- [ ] Users receive 403/404 errors if attempting to access another tenant's books.

### 6.2 Cloud Library & Async Processing
- [ ] Large PDFs (>300 pages) process entirely in the background. UI remains responsive.
- [ ] SSE real-time progress updates reflect document conversion stages accurately across multiple open tabs.
- [ ] BullMQ workers automatically retry failed TTS network requests up to 3 times before marking a book as `error`.

### 6.3 Cross-Device Synchronization
- [ ] Reading position (page & audio timestamp) updated on Device A reflects on Device B within <3 seconds of opening the document.
- [ ] Documents opened offline play seamless audio from IndexedDB and sync their reading position back to the cloud automatically when the connection returns.

---

## 7. Document Matrix

| Document | Path | Status |
|----------|------|--------|
| **Project Plan & Scope** | `docs/product/PROJECT_PLAN.md` | Complete |
| **V1 Implementation Plan** | `docs/product/V1_IMPLEMENTATION_PLAN.md` | Complete |
| **V2 Implementation Plan** | `docs/product/V2_IMPLEMENTATION_PLAN.md` | Complete (This file) |
