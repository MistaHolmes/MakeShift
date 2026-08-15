"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import UploadZone from "@/components/UploadZone";
import AudioPlayerBar from "@/components/AudioPlayerBar";
import LibrarySidebar, { type Book } from "@/components/LibrarySidebar";
import ProcessingOverlay, { type ProcessingStage } from "@/components/ProcessingOverlay";
import ReaderPanel, { type SentenceTiming } from "@/components/ReaderPanel";
import SettingsModal from "@/components/SettingsModal";
import BGMPlayer from "@/components/BGMPlayer";
import { savePdfBlob, getPdfBlob, deletePdfBlob } from "@/lib/storage/db";



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
          className="pill-btn hover:scale-105 hover:bg-white/20 active:scale-95 transition-all duration-200"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 99,
            background: "rgba(255,255,255,0.1)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#fff",
            fontFamily: "inherit", whiteSpace: "nowrap",
            outline: "none",
          }}
        >
          {icon}
          <span className="pill-btn-label">{label}</span>
        </button>
      </div>
    </div>
  );
}

const HINDI_PHRASES = [
  { line1: "असीम", line2: "शांति" },
  { line1: "सुहाना", line2: "सफर" },
  { line1: "लोफ़ी", line2: "धुन" },
  { line1: "धीमी", line2: "हवा" },
  { line1: "सुनहरा", line2: "पल" },
  { line1: "रूहानी", line2: "सफर" },
  { line1: "मीठे", line2: "तराने" },
  { line1: "शांत", line2: "शाम" },
  { line1: "अनकही", line2: "बातें" },
];

/* ── App ────────────────────────────────────────────────────── */
type AppView = "landing" | "reader";

export default function HomePage() {
  const time = useRealtimeClock();

  const [view, setView]                     = useState<AppView>("landing");
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [books, setBooks]                   = useState<Book[]>([]);
  const [activeBook, setActiveBook]         = useState<Book | null>(null);

  const [processing, setProcessing]         = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [pendingFileName, setPendingFileName] = useState("");
  const [activePdfUrl, setActivePdfUrl]     = useState<string | null>(null);
  const [showPdfView, setShowPdfView]       = useState(true);

  const [jobResult, setJobResult]           = useState<any>(null);
  const [timings, setTimings]               = useState<SentenceTiming[]>([]);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [duration, setDuration]             = useState(0);
  const [currentTime, setCurrentTime]       = useState(0);
  const [readerPanelOpen, setReaderPanelOpen] = useState(false);

  const [isPlaying, setIsPlaying]           = useState(false);
  const [playbackRate, setPlaybackRate]     = useState(1);

  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [themeColor, setThemeColor]         = useState("#e8b86d");
  const [grainOpacity, setGrainOpacity]     = useState(0.14);
  const [bgImage, setBgImage]               = useState("/bg.png");
  const [bgmPlaylist, setBgmPlaylist]       = useState("PLk4TWo67UoXhMcfG-af8ZXFlBdGr_NKkH");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [landingMode, setLandingMode]       = useState<"default" | "music">("default");
  const [hindiPhrase]                       = useState(() => HINDI_PHRASES[Math.floor(Math.random() * HINDI_PHRASES.length)]);

  // Restore settings on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("makeshift_settings");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.themeColor) setThemeColor(data.themeColor);
        if (typeof data.grainOpacity === "number") setGrainOpacity(data.grainOpacity);
        if (data.bgImage) setBgImage(data.bgImage);
        if (data.bgmPlaylist) setBgmPlaylist(data.bgmPlaylist);
      }
    } catch {}
    setSettingsLoaded(true);
  }, []);

  // Apply CSS vars and save to local storage when settings change
  useEffect(() => {
    if (!settingsLoaded) return; // wait until we've loaded from localStorage
    document.documentElement.style.setProperty("--clr-accent", themeColor);
    document.documentElement.style.setProperty("--clr-accent-dim", themeColor + "d9");
    document.documentElement.style.setProperty("--grain-opacity", grainOpacity.toString());
    try {
      localStorage.setItem("makeshift_settings", JSON.stringify({ themeColor, grainOpacity, bgImage, bgmPlaylist }));
    } catch {}
  }, [themeColor, grainOpacity, bgImage, bgmPlaylist, settingsLoaded]);

  // We use a ref to track the latest book data so we can save it on unmount/tick without frequent re-renders
  const stateRef = useRef({ activeBook, timings, duration, jobResult, currentTime, books, activeSentenceIdx });
  useEffect(() => {
    stateRef.current = { activeBook, timings, duration, jobResult, currentTime, books, activeSentenceIdx };
  }, [activeBook, timings, duration, jobResult, currentTime, books, activeSentenceIdx]);

  /* ── Persistence: restore from localStorage ────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("makeshift_library_v3");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.books?.length) {
           setBooks(data.books);
        }
      }
    } catch {}
  }, []);

  /* ── Persistence: save to localStorage on change (throttled) ───────── */
  useEffect(() => {
    const saveState = () => {
      const state = stateRef.current;

      try {
        const existingData = JSON.parse(localStorage.getItem("makeshift_library_v3") || '{"bookData":{}}');

        if (state.activeBook) {
           existingData.bookData = existingData.bookData || {};
           existingData.bookData[state.activeBook.id] = {
             timings: state.timings,
             duration: state.duration,
             jobResult: state.jobResult,
             currentTime: state.currentTime,
             activeSentenceIdx: state.activeSentenceIdx,
           };
        }

        existingData.books = state.books;
        localStorage.setItem("makeshift_library_v3", JSON.stringify(existingData));
      } catch {}
    };

    const interval = setInterval(saveState, 2000);
    window.addEventListener("beforeunload", saveState);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", saveState);
      saveState(); // Save on unmount
    };
  }, []);

  /* ── Process PDF via Real Backend ────────────────────────── */
  const processFile = useCallback(async (file: File) => {
    setPendingFileName(file.name);
    setProcessing(true);

    try {
      // 1. Upload & Parse
      setProcessingStage("uploading");
      setProcessingProgress(10);

      const formData = new FormData();
      formData.append("pdf", file);

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;

      const uploadRes = await fetch(`${backendUrl}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Backend upload failed");

      const uploadData = await uploadRes.json();
      const documentId = uploadData.documentId;

      // 2. Generate Audio (this might take time as it processes the whole book)
      setProcessingStage("audio_generation" as any); // using any for stage as it might not be in the enum
      setProcessingProgress(40);

      const genRes = await fetch(`${backendUrl}/api/documents/${documentId}/generate`, {
        method: "POST",
      });
      if (!genRes.ok) throw new Error("Audio generation failed");

      // 3. Fetch all generated pages
      setProcessingStage("ready" as any);
      setProcessingProgress(90);

      const pagesRes = await fetch(`${backendUrl}/api/documents/${documentId}/pages`);
      if (!pagesRes.ok) throw new Error("Failed to fetch generated pages");

      const pagesData = await pagesRes.json();

      // Convert backend pages format to frontend timings format
      let currentStartTime = 0;
      const combinedTimings: SentenceTiming[] = [];
      let totalDuration = 0;

      for (const page of pagesData) {
        if (!page.audioUrl || !page.alignmentData) continue;

        const chars = page.alignmentData.characters;
        const startTimes = page.alignmentData.character_start_times_seconds;
        const endTimes = page.alignmentData.character_end_times_seconds;

        if (!chars || chars.length === 0) continue;

        let currentSentence = "";
        let sentenceStart = -1;
        let sentenceEnd = 0;

        for (let i = 0; i < chars.length; i++) {
           const char = chars[i];
           const start = startTimes[i];
           const end = endTimes[i];

           if (sentenceStart === -1) sentenceStart = start;
           currentSentence += char;
           sentenceEnd = end;

           const isLastChar = i === chars.length - 1;
           const isDelimiter = ['.', '!', '?', '\n'].includes(char);

           if (isDelimiter || isLastChar) {
              const trimmed = currentSentence.trim();
              if (trimmed.length > 0) {
                 combinedTimings.push({
                   sentenceId: `p${page.pageNumber}-s${i}`,
                   text: trimmed,
                   audioStart: currentStartTime + sentenceStart,
                   audioEnd: currentStartTime + sentenceEnd,
                   pageIndex: page.pageNumber - 1,
                   audioUrl: page.audioUrl
                 } as any);
              }
              currentSentence = "";
              sentenceStart = -1;
           }
        }

        const pageDuration = endTimes[endTimes.length - 1];
        currentStartTime += pageDuration;
        totalDuration += pageDuration;
      }

      setProcessingProgress(100);

      const fakeJobResult = { pageCount: pagesData.length };
      setJobResult(fakeJobResult);
      setTimings(combinedTimings);
      setDuration(totalDuration);
      setCurrentTime(0);
      setActiveSentenceIdx(0);

      handleProcessingComplete(fakeJobResult, file);

    } catch (e: any) {
      alert("Error: " + e.message);
      setProcessing(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => processFile(file), [processFile]
  );

  const handleProcessingComplete = useCallback(async (result: any, rawFile?: File) => {
    const bookId = `book-${Date.now()}`;
    let finalTitle = "Untitled Book";

    if (rawFile) {
      await savePdfBlob(bookId, rawFile);
      setActivePdfUrl(URL.createObjectURL(rawFile));
      finalTitle = rawFile.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
    } else if (pendingFileName) {
      finalTitle = pendingFileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
    }

    const newBook: Book = {
      id: bookId,
      title: finalTitle || "Untitled Book",
      author: "MakeShift Audio",
      fileName: rawFile?.name || pendingFileName || "unknown.pdf",
      pageCount: result?.pageCount || 0,
      lastReadAt: Date.now(),
      processingStatus: "ready",
      coverAccent: ["#c0784a", "#4a7fc0", "#6a9e68", "#9c6ac0"][Math.floor(Math.random() * 4)],
    };
    setBooks((prev) => [newBook, ...prev]);
    setActiveBook(newBook);
    setProcessing(false);
    setView("reader");
    setReaderPanelOpen(true);
  }, [pendingFileName]);

  /* ── Audio playback via HTML5 Audio ────────────────── */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Handle page transitions and audio source loading
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preservesPitch = true;
    }

    const audio = audioRef.current;

    if (activeSentenceIdx >= timings.length) {
      setIsPlaying(false);
      return;
    }

    const sentence = timings[activeSentenceIdx] as any;
    if (!sentence || !sentence.audioUrl) {
      setIsPlaying(false);
      return;
    }

    // Only change source if it's different to prevent resetting playback when pausing/resuming
    if (audio.src !== sentence.audioUrl) {
       audio.src = sentence.audioUrl;
       audio.load();
    }

    audio.playbackRate = playbackRate;

    const handleEnded = () => {
      setCurrentTime(sentence.audioEnd);
      setActiveSentenceIdx(prev => {
        const next = prev + 1;
        if (next >= timings.length) {
           setIsPlaying(false);
        }
        return next;
      });
    };

    const handleTimeUpdate = () => {
      if (audio) {
         setCurrentTime(sentence.audioStart + audio.currentTime);
      }
    };

    const handleError = (e: any) => {
      console.error("Audio playback error:", e);
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);

    if (isPlayingRef.current) {
      audio.play().catch(e => {
         console.warn("Autoplay prevented:", e);
         setIsPlaying(false);
      });
    } else {
      audio.pause();
    }

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [activeSentenceIdx, isPlaying, timings, playbackRate]);

  // Strictly ensure audio is paused when not in reader view
  useEffect(() => {
    if (view === "landing" && isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [view, isPlaying]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((v) => !v);
  }, []);

  const handleSeek = useCallback((t: number) => {
    const clampedTime = Math.max(0, Math.min(duration - 0.1, t));
    setCurrentTime(clampedTime);

    let idx = timings.findIndex(s => s.audioStart <= clampedTime && s.audioEnd > clampedTime);
    if (idx === -1) idx = timings.findIndex(s => s.audioStart >= clampedTime);
    if (idx !== -1) {
      setActiveSentenceIdx(idx);
      if (audioRef.current) {
         const relativeTime = clampedTime - timings[idx].audioStart;
         // Set current time asynchronously to avoid DOM exceptions if source is still loading
         setTimeout(() => {
           if (audioRef.current) audioRef.current.currentTime = relativeTime;
         }, 50);
      }
    }
  }, [duration, timings]);

  const handleSkipBack = useCallback(() => {
    setActiveSentenceIdx(prev => {
      const nextIdx = Math.max(0, prev - 1);
      setCurrentTime(timings[nextIdx]?.audioStart || 0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      return nextIdx;
    });
  }, [timings]);

  const handleSkipForward = useCallback(() => {
    setActiveSentenceIdx(prev => {
      const nextIdx = Math.min(timings.length - 1, prev + 1);
      setCurrentTime(timings[nextIdx]?.audioStart || 0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      return nextIdx;
    });
  }, [timings]);

  const handleSelectBook = useCallback((book: Book) => {
    setActiveBook(book);

    // Fetch local PDF blob if available
    getPdfBlob(book.id).then(blob => {
      if (blob) {
        setActivePdfUrl(URL.createObjectURL(blob));
      } else {
        setActivePdfUrl(null);
      }
    });

    // Load book state from library
    try {
      const saved = localStorage.getItem("makeshift_library_v3");
      if (saved) {
        const data = JSON.parse(saved);
        const bookState = data.bookData?.[book.id];
        if (bookState) {
          setTimings(bookState.timings || []);
          setDuration(bookState.duration || 0);
          setJobResult(bookState.jobResult || null);
          setCurrentTime(bookState.currentTime || 0);

          if (bookState.activeSentenceIdx !== undefined) {
             setActiveSentenceIdx(bookState.activeSentenceIdx);
          } else if (bookState.timings && bookState.timings.length > 0) {
             // Fallback recovery if they have old format data without activeSentenceIdx saved
             const ct = bookState.currentTime || 0;
             let idx = bookState.timings.findIndex((s: any) => s.audioStart <= ct && s.audioEnd > ct);
             if (idx === -1) idx = bookState.timings.findIndex((s: any) => s.audioStart >= ct);
             setActiveSentenceIdx(idx !== -1 ? idx : 0);
          } else {
             setActiveSentenceIdx(0);
          }
        } else {
          // Reset if no saved state
          setTimings([]);
          setDuration(0);
          setJobResult(null);
          setCurrentTime(0);
          setActiveSentenceIdx(0);
        }
      }
    } catch {}

    setView("reader");
    setSidebarOpen(false);
  }, []);

  const handleDeleteBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));

    // Clean up local storage data
    try {
      const saved = localStorage.getItem("makeshift_library_v3");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.bookData?.[id]) {
           delete data.bookData[id];
        }
        if (data.books) {
           data.books = data.books.filter((b: Book) => b.id !== id);
        }
        localStorage.setItem("makeshift_library_v3", JSON.stringify(data));
      }
      // Also purge raw file from IndexedDB
      deletePdfBlob(id).catch(console.error);
    } catch {}

    if (activeBook?.id === id) {
      setActiveBook(null);
      setView("landing");
    }
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
      opacity: settingsLoaded ? 1 : 0,
      transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      backgroundColor: "#050505",
    }}>
      {/* ── Background with subtle gradient overlay ─────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Image
          src={`${bgImage}?v=2`}
          alt="Background"
          fill
          style={{ objectFit: "cover" }}
          priority
          quality={90}
          unoptimized
        />
        {/* Minimal gradient dim */}
        <div className="bg-dim-overlay" />
        {/* Film grain texture */}
        <div className="bg-grain-overlay" />
      </div>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header style={{
        position: "relative", zIndex: 20, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "36px 6vw",
        pointerEvents: "none",
      }}>
        {/* Left */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto", justifyContent: "flex-start" }}>
          {(view === "reader" || (view === "landing" && landingMode === "music")) ? (
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.02em",
            }}>
              {time.split(":").map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="animate-blink">:</span>}
                </React.Fragment>
              ))}
            </span>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--clr-accent)">
                <circle cx="8" cy="16" r="3.5" fill="rgba(255,255,255,0.9)"/>
                <circle cx="16" cy="16" r="3.5" fill="rgba(255,255,255,0.9)"/>
                <circle cx="12" cy="8" r="3.5" fill="var(--clr-accent)"/>
              </svg>
              <button
                onClick={() => {
                  setView("landing");
                  setIsPlaying(false);
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 20, fontWeight: 600,
                  color: "#fff",
                  textShadow: "0 1px 8px rgba(0,0,0,0.4)",
                  letterSpacing: "0.01em",
                  padding: 0,
                  fontFamily: "inherit"
                }}
              >
                MakeShift Audio
              </button>
            </>
          )}
        </div>

        {/* Center: View Change Toggle (Landing Only) */}
        {view === "landing" && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", pointerEvents: "auto" }}>
            <PillButton
              id="btn-toggle-landing-mode"
              onClick={() => setLandingMode(m => m === "default" ? "music" : "default")}
              icon={
                landingMode === "default" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                )
              }
              label={landingMode === "default" ? "Music View" : "Reader View"}
            />
          </div>
        )}
        {view === "reader" && <div style={{ flex: 1 }} />}

        {/* Right buttons */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto", justifyContent: "flex-end" }}>
          {view === "reader" && (
            <PillButton
              id="btn-go-home"
              onClick={() => {
                setView("landing");
                setIsPlaying(false);
                window.speechSynthesis.cancel();
              }}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              }
              label="Home"
            />
          )}
          {view === "landing" && landingMode === "music" ? (
            <PillButton
              id="btn-yt-music"
              onClick={() => window.open(`https://music.youtube.com/playlist?list=${bgmPlaylist}`, "_blank")}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              }
              label="YT Music ↗"
            />
          ) : (
            <PillButton id="btn-open-library" onClick={() => setSidebarOpen(true)} icon={libraryIcon} label="Library" />
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="landing-main" style={{
        position: "relative", zIndex: 10, flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: landingMode === "music" ? "center" : "flex-start",
        justifyContent: "center",
        paddingLeft: landingMode === "music" ? 0 : "6vw",
        paddingBottom: landingMode === "music" ? 0 : "8vh",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {view === "landing" ? (
          landingMode === "music" ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              width: "100%", height: "100%", paddingBottom: "35vh",
              animation: "fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both"
            }}>
              <h1 style={{
                fontSize: "clamp(7rem, 5vw, 4.5rem)", fontWeight: 800,
                color: "#fff",
                fontFamily: "var(--font-display)",
                lineHeight: 1.2,
                textShadow: "0 8px 32px rgba(0,0,0,0.7)",
                textAlign: "center",
                letterSpacing: "0.02em"
              }}>
                {hindiPhrase.line1}<br/>{hindiPhrase.line2}
              </h1>
            </div>
          ) : (
            <div className="landing-content" style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 28,
              animation: "fadeIn 0.6s ease both",
              width: "100%", maxWidth: 640,
            }}>
              {/* Hero text */}
              <div className="landing-hero-text">
                <h1 style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(3rem, 5.5vw, 3rem)",
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
              <div className="landing-upload-wrapper" style={{ position: "relative", display: "flex", justifyContent: "flex-start", width: "100%", marginTop: 8 }}>
                <UploadZone onFileSelect={handleFileSelect} />
              </div>

              {/* Recent books */}
              {books.length > 0 && (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
                  animation: "fadeUp 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both",
                }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em",
                    textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}>
                    — continue reading —
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
                    {books.slice(0, 3).map((b) => (
                      <div key={b.id} style={{ position: "relative", display: "inline-flex" }}>
                        <div className="liquid-glass" style={{ borderRadius: 99 }}>
                          <button
                            id={`recent-book-${b.id}`}
                            onClick={() => handleSelectBook(b)}
                            className="hover:scale-105 hover:bg-white/20 active:scale-95 transition-all duration-200"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              padding: "9px 20px", border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 99,
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
          )
        ) : (
          /* ── READER ───────────────────────────────────────── */
          <div className={`main-reader-content ${readerPanelOpen ? "panel-open" : ""} ${showPdfView && activePdfUrl ? "pdf-open" : ""}`}>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: readerPanelOpen
                ? "clamp(1.5rem, 4vw, 2.5rem)"
                : (showPdfView && activePdfUrl)
                  ? "clamp(2rem, 4vw, 3rem)"
                  : "clamp(3rem, 4vw, 6rem)",
              fontWeight: 700, lineHeight: 1.0,
              letterSpacing: "-0.02em",
              color: "#fff",
              textAlign: "center",
              textShadow: "0 4px 48px rgba(0,0,0,0.5)",
              maxWidth: "88vw",
              transition: "font-size 0.4s ease",
            }}>
              {displayBook?.title || "Untitled"}
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 500,
              textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              {displayBook?.author || "MakeShift Audio"}
            </p>

            {/* Status indicator */}
            {timings.length > 0 && (
              <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div className="liquid-glass" style={{ borderRadius: 99 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 20px",
                    fontSize: 12, color: "rgba(255,255,255,0.8)",
                    whiteSpace: "nowrap",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                    {timings.length} sentences ready · {Math.round(duration)}s audio
                  </div>
                </div>

                {/* PDF Viewer Toggle */}
                {activePdfUrl && (
                  <button
                    onClick={() => setShowPdfView(v => !v)}
                    style={{
                      padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    className="hover:bg-white/10 hover:text-white"
                  >
                    {showPdfView ? "Hide PDF Viewer" : "Show PDF Viewer"}
                  </button>
                )}
              </div>
            )}

            {/* PDF Viewer */}
            <motion.div
              initial={false}
              animate={showPdfView && activePdfUrl ? "open" : "closed"}
              variants={{
                open: { opacity: 1, height: "45vh", y: 0, filter: "blur(0px)", marginTop: 24, pointerEvents: "auto" },
                closed: { opacity: 0, height: 0, y: 10, filter: "blur(10px)", marginTop: 0, pointerEvents: "none" }
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`pdf-viewer-container ${readerPanelOpen ? "panel-open" : ""}`}
              style={{}}>
              {activePdfUrl && (
                <iframe
                  src={`${activePdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="PDF Document Viewer"
                />
              )}
            </motion.div>
          </div>
        )}
      </main>

      {/* ── Audio Player Bar ─────────────────────────────────── */}
      {view === "reader" && displayBook && (
        <div className={`audio-bar-wrapper ${readerPanelOpen ? "panel-open" : ""}`}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <AudioPlayerBar
              title={displayBook.title}
              author={displayBook.author}
              coverAccent={displayBook.coverAccent}
              duration={duration}
              isPlaying={isPlaying}
              currentTime={currentTime}
              playbackRate={playbackRate}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onSkipBack={handleSkipBack}
              onSkipForward={handleSkipForward}
              onRateChange={setPlaybackRate}
              readerPanelOpen={readerPanelOpen}
              onToggleReader={() => setReaderPanelOpen(v => !v)}
              activePdfUrl={activePdfUrl}
            />
          </div>
        </div>
      )}

      {/* ── Reader Panel ─────────────────────────────────────── */}
      {view === "reader" && displayBook && (
        <ReaderPanel
          isOpen={readerPanelOpen}
          bookTitle={displayBook.title}
          timings={timings}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onClose={() => setReaderPanelOpen(false)}
          onSeekToSentence={(t) => setCurrentTime(t)}
          onTogglePlay={handlePlayPause}
        />
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
          onComplete={() => {}}
        />
      )}

      {/* ── Settings Button & Modal ──────────────────────────── */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="liquid-glass hover:scale-110 active:scale-95 transition-all duration-200"
        style={{
          position: "fixed", bottom: 20, left: 20, zIndex: 40,
          width: 48, height: 48, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.05)", cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.7)"
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeColor={themeColor}
        setThemeColor={setThemeColor}
        grainOpacity={grainOpacity}
        setGrainOpacity={setGrainOpacity}
        bgImage={bgImage}
        setBgImage={setBgImage}
        bgmPlaylist={bgmPlaylist}
        setBgmPlaylist={setBgmPlaylist}
      />

      {/* ── Background Music Player (Landing Only) ────────────── */}
      {view === "landing" && <BGMPlayer key={bgmPlaylist} playlistId={bgmPlaylist} centered={landingMode === "music"} settingsLoaded={settingsLoaded} />}
    </div>
  );
}
