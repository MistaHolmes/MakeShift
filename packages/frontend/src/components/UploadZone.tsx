"use client";

import React, { useCallback, useState } from "react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") onFileSelect(file);
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div className="liquid-glass" style={{ borderRadius: 32 }}>
      <div
        id="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          width: 500, padding: 32,
          background: "rgba(255,255,255,0.08)", borderRadius: 32,
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Dashed inner drop zone */}
        <div 
          onClick={() => document.getElementById("pdf-file-input")?.click()}
          className={`cursor-pointer transition-all duration-200 hover:bg-white/5 hover:scale-[1.01] ${isDragOver ? "bg-white/5 border-white/60 scale-[1.02]" : "bg-transparent border-white/20"}`}
          style={{
            borderWidth: "1.5px", borderStyle: "dashed",
            borderColor: isDragOver ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
            borderRadius: 24, padding: "48px 32px 36px",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}
        >
          {/* Document icon */}
          <div style={{ position: "relative", marginBottom: 28 }}>
            <svg width="48" height="56" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
              <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
            </svg>
            {/* PDF badge */}
            <div style={{
              position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
              background: "#d9423e", color: "#fff", fontSize: 9, fontWeight: 800,
              padding: "2px 5px", borderRadius: 4, letterSpacing: "0.05em"
            }}>
              PDF
            </div>
          </div>
          
          <p style={{ fontSize: 16, fontWeight: 500, color: "#fff", marginBottom: 18 }}>
            {isDragOver ? "Drop file now..." : "Drag & drop your PDF here"}
          </p>
          
          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 16, marginBottom: 18, maxWidth: 160 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
          </div>
          
          {/* Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); document.getElementById("pdf-file-input")?.click(); }}
            className="hover:scale-105 hover:bg-white/20 active:scale-95 transition-all duration-200"
            style={{ 
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.1)", 
              padding: "10px 24px", borderRadius: 99, display: "flex", alignItems: "center", gap: 8, 
              color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", outline: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Browse files
          </button>
          
          <input
            id="pdf-file-input"
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Your files are private and secure.</span>
        </div>
      </div>
    </div>
  );
}
