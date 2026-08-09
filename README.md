# PDF Audiobook — Synchronized PDF Reader

> **Upload PDF → Press Play → Hear the document → See the text highlighted → Click anywhere to jump narration.**

A web application that transforms any PDF into a synchronized audiobook experience. The original PDF remains the source of truth — rendered visually with PDF.js while a high-quality TTS narrator reads it aloud, keeping document and narration perfectly in sync.

## Architecture

- **Frontend:** Next.js + TypeScript
- **Backend:** Express + TypeScript
- **PDF Rendering:** PDF.js
- **TTS Provider (V1):** ElevenLabs
- **Storage (V1):** IndexedDB (browser-local)
- **Future DB:** PostgreSQL
- **Future Storage:** Object Storage (S3-compatible)

## Monorepo Structure

```
packages/
├── frontend/web/       # Next.js application
├── backend/api/        # Express API server
├── deployment/         # Docker, K8s, Terraform
└── monitoring/         # Logging, metrics, tracing

docs/                   # Architecture, API, product, decisions
scripts/                # Development & deployment scripts
```

## Documentation

- [Project Plan & Scope](docs/product/PROJECT_PLAN.md)
- [V1 Implementation Plan](docs/product/V1_IMPLEMENTATION_PLAN.md)
- [V2 Implementation Plan](docs/product/V2_IMPLEMENTATION_PLAN.md)

## Getting Started

> 🚧 Under construction — see docs for implementation plans.

## License

Private — All rights reserved.
