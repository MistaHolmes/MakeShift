"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export interface SentenceTiming {
  sentenceId: string;
  text: string;
  audioStart: number;
  audioEnd: number;
  pageIndex: number;
  isChapterHeading?: boolean;
}

export interface ReaderPanelProps {
  isOpen: boolean;
  bookTitle: string;
  timings: SentenceTiming[];
  currentTime: number;
  isPlaying: boolean;
  onClose: () => void;
  onSeekToSentence: (audioStart: number) => void;
  onTogglePlay: () => void;
}

export default function ReaderPanel({
  isOpen,
  bookTitle,
  timings,
  currentTime,
  isPlaying,
  onClose,
  onSeekToSentence,
  onTogglePlay,
}: ReaderPanelProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [userScrolled, setUserScrolled] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find active sentence
  useEffect(() => {
    if (!timings.length) return;
    let idx = timings.findIndex(
      (t) => currentTime >= t.audioStart && currentTime < t.audioEnd
    );
    if (idx === -1) {
      if (currentTime >= timings[timings.length - 1].audioEnd) {
        idx = timings.length - 1;
      } else {
        idx = 0;
      }
    }
    setActiveIdx(idx);
  }, [currentTime, timings]);

  // Auto-scroll
  useEffect(() => {
    if (userScrolled) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, userScrolled]);

  const handleScroll = useCallback(() => {
    setUserScrolled(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setUserScrolled(false), 4000);
  }, []);

  const currentPage = timings[activeIdx]?.pageIndex ?? 0;
  const totalPages = timings.length > 0
    ? Math.max(...timings.map(t => t.pageIndex)) + 1
    : 0;
  const progressPct = timings.length > 0
    ? Math.round(((activeIdx + 1) / timings.length) * 100)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="rp-container" aria-label="Reader Panel">
      {/* ── Book Page Area ── */}
      <div className="rp-page">
        {/* Top bar inside page */}
        <div className="rp-page-header">
          <div className="rp-page-badge">
            Page {currentPage + 1} {totalPages > 0 && <span className="rp-of-total">of {totalPages}</span>}
          </div>
          <div className="rp-page-actions">
            <button
              id="rp-play-btn"
              className="rp-ctrl-btn"
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
              )}
            </button>
            <button
              id="rp-close-btn"
              className="rp-ctrl-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scroll body — the actual "page" text */}
        <div ref={scrollRef} className="rp-scroll" onScroll={handleScroll}>
          {timings.length === 0 ? (
            <div className="rp-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(120,100,80,0.25)" strokeWidth="1.2" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p>Upload a PDF to see the extracted text here.</p>
            </div>
          ) : (
            timings.map((sentence, i) => {
              const isActive = i === activeIdx;
              const isPast = i < activeIdx;

              // Render chapter headings as styled headers
              if (sentence.isChapterHeading) {
                return (
                  <div
                    key={sentence.sentenceId}
                    ref={isActive ? activeRef : undefined}
                    className="rp-chapter-heading"
                    onClick={() => onSeekToSentence(sentence.audioStart)}
                  >
                    {sentence.text}
                  </div>
                );
              }

              return (
                <div
                  key={sentence.sentenceId}
                  ref={isActive ? activeRef : undefined}
                  className={`rp-line ${isActive ? "rp-line--active" : ""} ${isPast ? "rp-line--past" : ""}`}
                  onClick={() => onSeekToSentence(sentence.audioStart)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSeekToSentence(sentence.audioStart)}
                >
                  {sentence.text}
                </div>
              );
            })
          )}
        </div>

        {/* Footer — progress */}
        {timings.length > 0 && (
          <div className="rp-footer">
            <div className="rp-progress-bar">
              <div className="rp-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="rp-progress-info">
              <span>Your Progress</span>
              <span className="rp-progress-pct">{progressPct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
