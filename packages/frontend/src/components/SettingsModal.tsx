"use client";

import React, { useState, useEffect } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  setThemeColor: (c: string) => void;
  grainOpacity: number;
  setGrainOpacity: (o: number) => void;
  bgImage: string;
  setBgImage: (bg: string) => void;
}

const PRESET_THEMES = [
  { id: "gold", color: "#e8b86d" },
  { id: "amber", color: "#e8976d" },
  { id: "rose", color: "#e86d7f" },
  { id: "blue", color: "#6d8be8" },
  { id: "emerald", color: "#6de88b" },
  { id: "silver", color: "#c4c4c4" },
];

const PRESET_BACKGROUNDS = [
  { id: "bg-default", file: "/bg.png", color: "#e8b86d", label: "Classic" },
  { id: "bg-1", file: "/bg-1.jpg", color: "#6a7b82", label: "Slate" },
  { id: "bg-2", file: "/bg-2.jpg", color: "#7a5c58", label: "Clay" },
  { id: "bg-3", file: "/bg-3.jpg", color: "#566246", label: "Moss" },
  { id: "bg-4", file: "/bg-4.jpg", color: "#8a7a9e", label: "Twilight" },
];

export default function SettingsModal({
  isOpen, onClose, themeColor, setThemeColor, grainOpacity, setGrainOpacity, bgImage, setBgImage
}: SettingsModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      animation: "fadeIn 0.2s ease both"
    }}>
      <div className="liquid-glass" style={{
        position: "relative",
        width: 480, maxWidth: "90vw",
        background: "rgba(16,14,12,0.9)",
        borderRadius: 24, padding: "32px 28px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        animation: "fadeUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both"
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 20, right: 20,
            background: "none", border: "none",
            color: "rgba(255,255,255,0.5)", cursor: "pointer",
          }}
          className="hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, fontFamily: "var(--font-display)" }}>Settings</h2>

        {/* Background Section */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
            Background
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESET_BACKGROUNDS.map(bg => (
              <button
                key={bg.id}
                onClick={() => {
                  setBgImage(bg.file);
                  setThemeColor(bg.color);
                }}
                style={{
                  width: 108, height: 75, borderRadius: 12,
                  backgroundImage: `url(${bg.file})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  border: bgImage === bg.file ? "2px solid #fff" : "2px solid transparent",
                  outline: bgImage === bg.file ? `1px solid ${bg.color}` : "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  paddingBottom: 6
                }}
                className="hover:scale-105 active:scale-95"
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                  {bg.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Section */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
            Theme Accent
          </h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {PRESET_THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setThemeColor(t.color)}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: t.color,
                  border: themeColor === t.color ? "3px solid #fff" : "3px solid transparent",
                  outline: themeColor === t.color ? `1px solid ${t.color}` : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                className="hover:scale-110 active:scale-95"
              />
            ))}
          </div>
        </div>

        {/* Grain Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Film Grain
            </h3>
            <span style={{ fontSize: 12, color: "var(--clr-accent)", fontWeight: 600 }}>
              {Math.round(grainOpacity * 100)}%
            </span>
          </div>
          <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
            <div style={{
              position: "absolute", left: 0, right: 0, height: 4, borderRadius: 99,
              background: "rgba(255,255,255,0.1)"
            }} />
            <div style={{
              position: "absolute", left: 0, height: 4, borderRadius: 99,
              background: "var(--clr-accent)",
              width: `${(grainOpacity / 0.5) * 100}%`
            }} />
            <input
              type="range"
              min="0" max="0.5" step="0.01"
              value={grainOpacity}
              onChange={(e) => setGrainOpacity(parseFloat(e.target.value))}
              style={{ position: "relative", zIndex: 10, opacity: 0, cursor: "pointer" }}
            />
            {/* Custom thumb just for display */}
            <div style={{
              position: "absolute",
              left: `${(grainOpacity / 0.5) * 100}%`,
              transform: "translateX(-50%)",
              width: 14, height: 14, borderRadius: "50%",
              background: "#fff", pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
