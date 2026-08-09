"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";

interface AudioPlayerBarProps {
  title: string;
  author: string;
  coverUrl?: string;
  duration: number;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onRateChange: (rate: number) => void;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function AudioPlayerBar({
  title, author, coverUrl, duration, isPlaying, currentTime,
  playbackRate, onPlayPause, onSeek, onSkipBack, onSkipForward, onRateChange,
}: AudioPlayerBarProps) {
  const [showRates, setShowRates] = useState(false);
  const progressRef = useRef<HTMLInputElement>(null);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSeek(parseFloat(e.target.value)),
    [onSeek]
  );

  return (
    <div className="liquid-glass" style={{ borderRadius: 24 }}>
      <div
        id="audio-player-bar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 20px",
          minWidth: 520,
          maxWidth: 660,
          background: "rgba(255,255,255,0.15)",
          borderRadius: 24,
        }}
      >
        {/* Cover art */}
        <div
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {coverUrl ? (
            <Image src={coverUrl} alt={title} width={52} height={52} style={{ objectFit: "cover" }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          )}
        </div>

        {/* Info + scrubber */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 600, color: "#fff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3,
              }}>{title}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{author}</p>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", flexShrink: 0, paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>

          {/* Progress */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            {/* Filled track overlay */}
            <div style={{
              position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
              height: 3, borderRadius: 99,
              width: `${progressPercent}%`,
              background: "var(--clr-accent)",
              pointerEvents: "none", zIndex: 1,
            }} />
            <input
              ref={progressRef}
              id="progress-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleProgressChange}
              style={{ position: "relative", zIndex: 2, height: 3 }}
            />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {/* Skip back */}
          <button
            id="btn-skip-back"
            onClick={onSkipBack}
            title="Rewind 10s"
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none",
              background: "transparent", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            id="btn-play-pause"
            onClick={onPlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            style={{
              width: 42, height: 42, borderRadius: "50%", border: "none",
              background: "#fff", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#111">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#111">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          {/* Skip forward */}
          <button
            id="btn-skip-forward"
            onClick={onSkipForward}
            title="Forward 10s"
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none",
              background: "transparent", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4"/>
            </svg>
          </button>

          {/* Speed */}
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button
              id="btn-speed"
              onClick={() => setShowRates((v) => !v)}
              style={{
                height: 30, padding: "0 12px", borderRadius: 99, border: "none",
                background: "rgba(255,255,255,0.18)", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                color: playbackRate !== 1 ? "var(--clr-accent)" : "#fff",
              }}
            >
              {playbackRate}×
            </button>
            {showRates && (
              <div
                id="speed-popover"
                style={{
                  position: "absolute", bottom: "calc(100% + 8px)", right: 0,
                  background: "rgba(20,20,20,0.92)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 14, overflow: "hidden", minWidth: 80,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {RATES.map((r) => (
                  <button
                    key={r}
                    id={`speed-${r}`}
                    onClick={() => { onRateChange(r); setShowRates(false); }}
                    style={{
                      width: "100%", padding: "9px 16px", border: "none",
                      background: "transparent", cursor: "pointer",
                      fontSize: 13, textAlign: "left",
                      color: r === playbackRate ? "var(--clr-accent)" : "#fff",
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
    </div>
  );
}
