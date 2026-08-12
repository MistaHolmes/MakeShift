"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";

interface AudioPlayerBarProps {
  title: string;
  author: string;
  coverUrl?: string;
  coverAccent?: string;
  duration: number;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onRateChange: (rate: number) => void;
  readerPanelOpen: boolean;
  onToggleReader: () => void;
  activePdfUrl?: string | null;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function AudioPlayerBar({
  title, author, coverUrl, coverAccent, duration, isPlaying, currentTime,
  playbackRate, onPlayPause, onSeek, onSkipBack, onSkipForward, onRateChange,
  readerPanelOpen, onToggleReader, activePdfUrl
}: AudioPlayerBarProps) {
  const [showRates, setShowRates] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const progressRef = useRef<HTMLInputElement>(null);

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIsScrubbing(true);
    setScrubTime(parseFloat(e.target.value));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isScrubbing) {
      onSeek(scrubTime);
      setIsScrubbing(false);
    }
  }, [isScrubbing, scrubTime, onSeek]);

  return (
    <>
      <style>{`
        @keyframes vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .vinyl-cover {
          position: relative;
          flex-shrink: 0;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 4px solid #111;
          overflow: hidden;
          background: #222;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .vinyl-cover::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: #111;
          border-radius: 50%;
          border: 2px solid #333;
        }
        .vinyl-playing {
          animation: vinyl-spin 4s linear infinite;
        }
        .vinyl-paused {
          animation: vinyl-spin 4s linear infinite;
          animation-play-state: paused;
        }
      `}</style>

      <div 
        id="audio-player-bar"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 24px 12px 12px",
          minWidth: 580,
          maxWidth: 720,
          background: "linear-gradient(135deg, rgba(80, 20, 20, 0.85), rgba(40, 10, 10, 0.9))",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 99,
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Vinyl Cover Art (Poking out of the left) */}
        <div className={`vinyl-cover ${isPlaying ? 'vinyl-playing' : 'vinyl-paused'}`}>
          {coverUrl ? (
            <Image src={coverUrl} alt={title} fill style={{ objectFit: "cover", opacity: 0.85 }} />
          ) : activePdfUrl ? (
            <div style={{ position: 'absolute', inset: -2, pointerEvents: 'none', background: '#fff' }}>
              <iframe 
                src={`${activePdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
                style={{ width: '100%', height: '400%', border: 'none', overflow: 'hidden' }} 
              />
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(45deg, ${coverAccent || '#c0784a'}, #4a7fc0)`, opacity: 0.8 }} />
          )}
        </div>

        {/* Info + scrubber */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, marginLeft: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: 16, fontWeight: 700, color: "#fff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2,
                textShadow: "0 1px 4px rgba(0,0,0,0.5)"
              }}>{title}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{author}</p>
            </div>
            
          </div>

          {/* Progress */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", marginTop: 4 }}>
            {/* Filled track overlay */}
            <div style={{
              position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
              height: 4, borderRadius: 99,
              width: `${progressPercent}%`,
              background: "#fff",
              pointerEvents: "none", zIndex: 1,
              boxShadow: "0 0 8px rgba(255,255,255,0.4)"
            }} />
            <input
              ref={progressRef}
              id="progress-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={displayTime}
              onChange={handleProgressChange}
              onPointerUp={handlePointerUp}
              onTouchEnd={handlePointerUp}
              style={{ position: "relative", zIndex: 2, height: 4, background: "rgba(255,255,255,0.2)" }}
            />
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            {formatTime(displayTime)} / {formatTime(duration)}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 16 }}>
          {/* Skip back */}
          <button
            onClick={onSkipBack}
            title="Rewind Sentence"
            style={{
              width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", 
              display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.9)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            style={{
              width: 48, height: 48, borderRadius: "50%", border: "none",
              background: "#fff", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#111">
                <rect x="6" y="4" width="4" height="16" rx="2"/><rect x="14" y="4" width="4" height="16" rx="2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" style={{ marginLeft: 3 }}>
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          {/* Skip forward */}
          <button
            onClick={onSkipForward}
            title="Next Sentence"
            style={{
              width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", 
              display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.9)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

          {/* Reader Panel Toggle */}
          <button
            onClick={onToggleReader}
            title={readerPanelOpen ? "Hide Text" : "Show Text"}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none",
              background: readerPanelOpen ? "rgba(255,255,255,0.2)" : "transparent", 
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", 
              color: "#fff", transition: "all 0.15s ease"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 6h16M4 12h10M4 18h12"/>
            </svg>
          </button>

          {/* Speed */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowRates((v) => !v)}
              style={{
                height: 32, padding: "0 10px", borderRadius: 99, border: "none",
                background: "rgba(255,255,255,0.1)", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                color: playbackRate !== 1 ? "#4ade80" : "#fff",
              }}
            >
              {playbackRate}×
            </button>
            {showRates && (
              <div
                style={{
                  position: "absolute", bottom: "calc(100% + 12px)", right: 0,
                  background: "rgba(20,20,20,0.95)", backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, overflow: "hidden", 
                  minWidth: 80, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 100
                }}
              >
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { onRateChange(r); setShowRates(false); }}
                    style={{
                      width: "100%", padding: "10px 16px", border: "none", background: "transparent", 
                      cursor: "pointer", fontSize: 13, textAlign: "center", fontWeight: 600,
                      color: r === playbackRate ? "#4ade80" : "#fff",
                    }}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
