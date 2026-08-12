# TTS Architectures & Alternatives

When building MakeShift Audio, a synchronized audiobook reader, the choice of Text-to-Speech (TTS) architecture dictates the cost, latency, and overall user experience. Below are the architectural options we've considered, ranging from highly-optimized premium options to completely free browser fallbacks.

## 1. On-Demand / Just-In-Time Synthesis (Recommended)

Instead of batch-processing the entire book upfront, the system only extracts and cleans the text during the initial upload. Audio is synthesized strictly on-the-fly.

*   **How it works:** When a book is opened, the frontend loads the extracted text instantly. When the user clicks "Play", the frontend requests TTS generation for only the current chunk (e.g., the current paragraph). While the user listens, the application silently pre-fetches the next chunk in the background.
*   **Pros:**
    *   **Zero Token Waste:** Users only pay for the exact audio they listen to.
    *   **Lightning Fast Load Times:** Initial PDF upload time drops from minutes to just a few seconds since it only involves text parsing.
*   **Cons:** Requires a more complex frontend state machine to manage buffering, pre-fetching, and seamless chunk transitions.

## 2. Browser Built-in Web Speech API (Free / Default Fallback)

Modern web browsers come with a built-in TTS engine accessible via `window.speechSynthesis`.

*   **How it works:** The application completely bypasses external APIs (like ElevenLabs) and feeds the extracted text directly to the browser's TTS engine.
*   **Pros:**
    *   **100% Free:** No API costs or rate limits.
    *   **Zero Latency:** Audio plays instantly without waiting for network requests.
    *   **Native Word Highlighting:** Supports the `onboundary` event natively, allowing for word-level or sentence-level highlighting synchronization without needing complex backend alignment calculations.
*   **Cons:** Voice quality is highly dependent on the user's operating system. While macOS and modern Windows have decent default voices, they generally sound more robotic and lack the emotional depth and pacing of premium AI voices.

## 3. "Premium Voice" Toggle Mode (Hybrid Approach)

A hybrid architecture combining the cost-efficiency of Option 2 with the high quality of Option 1.

*   **How it works:** By default, books are read using the free Web Speech API (Option 2). If the user decides they want high-quality narration for a specific book, they can toggle a "Premium Voice" setting, which switches the player over to the ElevenLabs On-Demand pipeline (Option 1).
*   **Pros:** Gives the user total control over when to spend their expensive API tokens. Excellent for skimming books quickly before committing to a premium listen.
*   **Cons:** Requires building and maintaining both the Web Speech and ElevenLabs playback pipelines in the frontend.

## 4. Local Open-Source TTS Backend (Self-Hosted)

Replacing ElevenLabs entirely with a self-hosted, open-source AI voice engine (like Piper TTS or Coqui TTS).

*   **How it works:** The backend runs a Python microservice hosting an open-source TTS model. The application functions similarly to the original batch-processing architecture, but requests are routed to the local service instead of a paid API.
*   **Pros:** Completely free to run (excluding server hardware costs), with voice quality that is significantly better than the Web Speech API.
*   **Cons:** Extremely heavy to host. Real-time inference usually requires a dedicated GPU, which inflates cloud hosting costs, effectively replacing API costs with server costs. It also makes local development setups much harder.

---

## What About Whisper?

**Whisper cannot be used for Text-to-Speech.**

Whisper is an **Automatic Speech Recognition (ASR)** model built by OpenAI. It is designed to take *audio in* and output *text* (Speech-to-Text). What we need is **Text-to-Speech (TTS)**—taking *text in* and outputting *audio*.

*Note: OpenAI does offer a TTS API (simply called `tts-1`), which is a direct competitor to ElevenLabs and can be used as a backend provider for Option 1. However, Whisper itself is strictly for transcription.*
