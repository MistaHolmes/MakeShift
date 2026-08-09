"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import UploadZone from "@/components/UploadZone";
import AudioPlayerBar from "@/components/AudioPlayerBar";
import LibrarySidebar, { type Book } from "@/components/LibrarySidebar";
import ProcessingOverlay, { type ProcessingStage } from "@/components/ProcessingOverlay";



/* ── Realtime clock (client-only to avoid hydration mismatch) ── */
function useRealtimeClock() {
  const [time, setTime] = useState(""); // start empty — no SSR value
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    setTime(fmt()); // set immediately on mount
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

/* ── Top-bar pill button ────────────────────────────────────── */
function PillButton({ id, onClick, icon, label }: {
  id: string; onClick: () => void;
  icon: React.ReactNode; label: string;
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div className="liquid-glass" style={{ borderRadius: 99 }}>
        <button
          id={id}
          onClick={onClick}
          className="hover:scale-105 hover:bg-white/20 active:scale-95 transition-all duration-200"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "9px 20px", border: "none",
            background: "rgba(255,255,255,0.15)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#fff",
            fontFamily: "inherit", whiteSpace: "nowrap",
            outline: "none",
          }}
        >
          {icon}
          {label}
        </button>
      </div>
    </div>
  );
}

/* ── App ────────────────────────────────────────────────────── */
type AppView = "landing" | "reader";

export default function HomePage() {
  const time = useRealtimeClock();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [view, setView]                     = useState<AppView>("landing");
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [books, setBooks]                   = useState<Book[]>([]);
  const [activeBook, setActiveBook]         = useState<Book | null>(null);

  const [processing, setProcessing]         = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [pendingFileName, setPendingFileName] = useState("");

  const [isPlaying, setIsPlaying]           = useState(false);
  const [currentTime, setCurrentTime]       = useState(5);
  const [duration]                          = useState(224);
  const [playbackRate, setPlaybackRate]     = useState(1);

  /* ── Simulate processing ─────────────────────────────────── */
  const simulateProcessing = useCallback((file: File) => {
    setPendingFileName(file.name);
    setProcessing(true);
    setProcessingStage("uploading");
    setProcessingProgress(0);

    const steps: { stage: ProcessingStage; progress: number; delay: number }[] = [
      { stage: "uploading",    progress: 15,  delay: 0 },
      { stage: "uploading",    progress: 30,  delay: 700 },
      { stage: "extracting",   progress: 45,  delay: 1400 },
      { stage: "extracting",   progress: 55,  delay: 2100 },
      { stage: "cleaning",     progress: 65,  delay: 2800 },
      { stage: "synthesizing", progress: 78,  delay: 3600 },
      { stage: "synthesizing", progress: 91,  delay: 4500 },
      { stage: "ready",        progress: 100, delay: 5400 },
    ];
    steps.forEach(({ stage, progress, delay }) =>
      setTimeout(() => { setProcessingStage(stage); setProcessingProgress(progress); }, delay)
    );
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => simulateProcessing(file), [simulateProcessing]
  );

  const handleProcessingComplete = useCallback(() => {
    const newBook: Book = {
      id: `book-${Date.now()}`,
      title: pendingFileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
      author: "Unknown Author",
      fileName: pendingFileName,
      pageCount: Math.floor(Math.random() * 200) + 50,
      lastReadAt: Date.now(),
      processingStatus: "ready",
      coverAccent: ["#c0784a", "#4a7fc0", "#6a9e68", "#9c6ac0"][Math.floor(Math.random() * 4)],
    };
    setBooks((prev) => [newBook, ...prev]);
    setActiveBook(newBook);
    setProcessing(false);
    setView("reader");
  }, [pendingFileName]);

  /* ── Dummy playback ticker ───────────────────────────────── */
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= duration) { setIsPlaying(false); return duration; }
        return prev + 0.25;
      });
    }, 250);
    return () => clearInterval(t);
  }, [isPlaying, duration]);

  const handlePlayPause   = useCallback(() => setIsPlaying((v) => !v), []);
  const handleSeek        = useCallback((t: number) => setCurrentTime(t), []);
  const handleSkipBack    = useCallback(() => setCurrentTime((t) => Math.max(0, t - 10)), []);
  const handleSkipForward = useCallback(() => setCurrentTime((t) => Math.min(duration, t + 10)), []);

  const handleSelectBook = useCallback((book: Book) => {
    setActiveBook(book); setView("reader"); setSidebarOpen(false);
  }, []);
  const handleDeleteBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    if (activeBook?.id === id) { setActiveBook(null); setView("landing"); }
  }, [activeBook]);

  const displayBook = activeBook ?? books[0] ?? null;

  /* ── Upload icon ─────────────────────────────────────────── */
  const uploadIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
  const libraryIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div style={{
      position: "relative", height: "100vh", width: "100vw",
      overflow: "hidden", fontFamily: "var(--font-sans)",
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Background — plain, no vignette ─────────────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Image
          src="/bg.png?v=2"
          alt="Background"
          fill
          style={{ objectFit: "cover" }}
          priority
          quality={90}
          unoptimized
        />
      </div>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header style={{
        position: "relative", zIndex: 20, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "36px 6vw",
        pointerEvents: "none",
      }}>
        {/* Logo — left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--clr-accent)">
            <circle cx="8" cy="16" r="3.5" fill="rgba(255,255,255,0.9)"/>
            <circle cx="16" cy="16" r="3.5" fill="rgba(255,255,255,0.9)"/>
            <circle cx="12" cy="8" r="3.5" fill="var(--clr-accent)"/>
          </svg>
          <span style={{
            fontSize: 20, fontWeight: 600,
            color: "#fff",
            textShadow: "0 1px 8px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            letterSpacing: "0.01em",
          }}>
            MakeShift Audio
          </span>
        </div>

        {/* Right buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <PillButton id="btn-open-library" onClick={() => setSidebarOpen(true)} icon={libraryIcon} label="Library" />
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <main style={{
        position: "relative", zIndex: 10, flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "flex-start", justifyContent: "center",
        paddingLeft: "6vw",
        paddingBottom: "8vh",
      }}>
        {view === "landing" ? (
          /* ── LANDING ──────────────────────────────────────── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 28,
            animation: "fadeIn 0.6s ease both",
            width: "100%", maxWidth: 640,
          }}>
            {/* Hero text */}
            <div>
              <h1 style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(3rem, 5.5vw, 4.5rem)",
                fontWeight: 700, lineHeight: 1.15,
                letterSpacing: "-0.03em", color: "#fff",
                marginBottom: 20,
                textShadow: "0 2px 24px rgba(0,0,0,0.6)",
              }}>
                Listen to your<br />
                PDFs. <span style={{ color: "var(--clr-accent)" }}>Naturally.</span>
              </h1>
              <p style={{
                fontSize: 16, color: "rgba(255,255,255,0.85)",
                maxWidth: 480, lineHeight: 1.6,
                fontWeight: 400,
                textShadow: "0 1px 12px rgba(0,0,0,0.7)",
              }}>
                Upload any PDF and turn it into a synchronized audiobook. Follow along as we highlight every word, sentence, and idea.
              </p>
            </div>


            {/* Upload zone */}
            <div style={{ position: "relative", display: "flex", justifyContent: "flex-start", width: "100%", marginTop: 8 }}>
              <UploadZone onFileSelect={handleFileSelect} />
            </div>

            {/* Recent books */}
            {books.length > 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                animation: "fadeUp 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both",
              }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em",
                  textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}>
                  — continue reading —
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {books.slice(0, 3).map((b) => (
                    <div key={b.id} style={{ position: "relative", display: "inline-flex" }}>
                      <div className="liquid-glass" style={{ borderRadius: 99 }}>
                        <button
                          id={`recent-book-${b.id}`}
                          onClick={() => handleSelectBook(b)}
                          className="hover:scale-105 hover:bg-white/20 active:scale-95 transition-all duration-200"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "9px 20px", border: "none",
                            background: "rgba(255,255,255,0.15)", cursor: "pointer",
                            fontSize: 13, fontWeight: 600, color: "#fff",
                            fontFamily: "inherit", whiteSpace: "nowrap",
                            outline: "none",
                          }}
                        >
                          {b.title}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── READER ───────────────────────────────────────── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 16, marginBottom: 140,
            animation: "fadeIn 0.6s ease both",
          }}>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(4rem, 10vw, 9rem)",
              fontWeight: 700, lineHeight: 1.0,
              letterSpacing: "-0.02em",
              color: "#fff", textAlign: "center",
              textShadow: "0 4px 48px rgba(0,0,0,0.5)",
              maxWidth: "88vw",
            }}>
              {displayBook?.title ?? "Untitled"}
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 500,
              textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              {displayBook?.author ?? "Unknown Author"}
            </p>

            {/* Phase 2 placeholder */}
            <div style={{ position: "relative", display: "inline-flex" }}>
              <div className="liquid-glass" style={{ borderRadius: 99 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 20px",
                  fontSize: 12, color: "rgba(255,255,255,0.8)",
                  whiteSpace: "nowrap",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  PDF viewer coming in Phase 2 · player controls are live ↓
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Audio Player Bar ─────────────────────────────────── */}
      {view === "reader" && displayBook && (
        <div style={{
          position: "absolute", bottom: 36, left: 0, right: 0, zIndex: 20,
          display: "flex", justifyContent: "center",
          animation: "fadeIn 0.5s 0.1s ease both",
        }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <AudioPlayerBar
              title={displayBook.title}
              author={displayBook.author}
              duration={duration}
              isPlaying={isPlaying}
              currentTime={currentTime}
              playbackRate={playbackRate}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onSkipBack={handleSkipBack}
              onSkipForward={handleSkipForward}
              onRateChange={setPlaybackRate}
            />
          </div>
        </div>
      )}

      {/* ── Library sidebar ──────────────────────────────────── */}
      <LibrarySidebar
        books={books}
        activeBookId={activeBook?.id ?? null}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectBook={handleSelectBook}
        onDeleteBook={handleDeleteBook}
      />

      {/* ── Processing overlay ───────────────────────────────── */}
      {processing && (
        <ProcessingOverlay
          stage={processingStage}
          progress={processingProgress}
          fileName={pendingFileName}
          onComplete={handleProcessingComplete}
        />
      )}

      <audio ref={audioRef} />
    </div>
  );
}
