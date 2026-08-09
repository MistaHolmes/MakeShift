"use client";

import React, { useEffect, useState } from "react";

export type ProcessingStage =
  | "uploading" | "extracting" | "cleaning" | "synthesizing" | "ready";

interface ProcessingOverlayProps {
  stage: ProcessingStage;
  progress: number;
  fileName: string;
  onComplete: () => void;
}

const STAGES: { key: ProcessingStage; label: string; description: string }[] = [
  { key: "uploading",    label: "Uploading",        description: "Transferring your PDF" },
  { key: "extracting",   label: "Extracting Text",  description: "Parsing pages & coordinates" },
  { key: "cleaning",     label: "Cleaning Content", description: "Fixing headers, hyphenation" },
  { key: "synthesizing", label: "Generating Audio", description: "Creating narration via ElevenLabs" },
  { key: "ready",        label: "Ready",            description: "Your audiobook is ready!" },
];

export default function ProcessingOverlay({ stage, progress, fileName, onComplete }: ProcessingOverlayProps) {
  const [visible, setVisible] = useState(true);
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  useEffect(() => {
    if (stage === "ready") {
      const t = setTimeout(() => { setVisible(false); onComplete(); }, 1400);
      return () => clearTimeout(t);
    }
  }, [stage, onComplete]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(16px)",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div className="liquid-glass" style={{ borderRadius: 28 }}>
        <div style={{
          width: 420, padding: "48px 40px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
          background: "rgba(255,255,255,0.15)", borderRadius: 28,
        }}>
          {/* Spinner or checkmark */}
          <div style={{ position: "relative" }}>
            {stage === "ready" ? (
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(232,184,109,0.2)",
                border: "1px solid rgba(232,184,109,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8b86d" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.12)",
                borderTop: "2px solid var(--clr-accent)",
                animation: "spin 0.9s linear infinite",
              }} />
            )}
          </div>

          {/* Stage label */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              Processing
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {STAGES[currentIdx]?.label}
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {STAGES[currentIdx]?.description}
            </p>
          </div>

          {/* File name pill */}
          <div style={{
            padding: "6px 14px", borderRadius: 99,
            background: "rgba(255,255,255,0.1)",
            fontSize: 12, color: "rgba(255,255,255,0.55)",
            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {fileName}
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              <span>Progress</span><span>{progress}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${progress}%`,
                background: "linear-gradient(90deg, #c9943a, #e8b86d)",
                transition: "width 0.5s ease-out",
              }} />
            </div>
          </div>

          {/* Step dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {STAGES.map((s, i) => (
              <div key={s.key} style={{
                height: 4, width: i === currentIdx ? 24 : 16, borderRadius: 99,
                background: i < currentIdx ? "var(--clr-accent)"
                  : i === currentIdx ? "rgba(232,184,109,0.7)"
                  : "rgba(255,255,255,0.15)",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
