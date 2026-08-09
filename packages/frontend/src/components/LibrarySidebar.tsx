"use client";

import React from "react";
import LiquidGlass from "liquid-glass-react";

export interface Book {
  id: string;
  title: string;
  author: string;
  fileName: string;
  pageCount: number;
  lastReadAt: number;
  processingStatus: "ready" | "processing" | "error";
  coverAccent?: string;
}

interface LibrarySidebarProps {
  books: Book[];
  activeBookId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACCENTS = ["#c0784a", "#4a7fc0", "#6a9e68", "#9c6ac0", "#c0a24a"];

export default function LibrarySidebar({
  books, activeBookId, isOpen, onClose, onSelectBook, onDeleteBook,
}: LibrarySidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            animation: "fadeIn 0.25s ease both",
          }}
        />
      )}

      {/* Sidebar panel */}
      <aside
        id="library-sidebar"
        style={{
          position: "fixed", top: 0, left: 0, height: "100%",
          width: 320, zIndex: 40,
          display: "flex", flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
          background: "rgba(10,10,10,0.75)",
          backdropFilter: "blur(40px) saturate(160%)",
          borderRight: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "36px 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Library</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
              {books.length} book{books.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            id="close-sidebar"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "rgba(255,255,255,0.1)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 24px" }} />

        {/* Book list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 24px" }}>
          {books.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", lineHeight: 1.6 }}>
                No books yet.<br />Upload a PDF to get started.
              </p>
            </div>
          ) : (
            books.map((book, idx) => {
              const accent = book.coverAccent ?? ACCENTS[idx % ACCENTS.length];
              const isActive = book.id === activeBookId;
              return (
                <div
                  key={book.id}
                  id={`book-${book.id}`}
                  onClick={() => onSelectBook(book)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 14, cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                    transition: "background 0.15s ease", marginBottom: 2,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Book spine icon */}
                  <div style={{
                    flexShrink: 0, width: 40, height: 52, borderRadius: 10,
                    background: `${accent}25`, border: `1px solid ${accent}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {book.title}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                      {book.pageCount} pages · {timeAgo(book.lastReadAt)}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    id={`delete-book-${book.id}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteBook(book.id); }}
                    aria-label="Delete"
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "rgba(255,80,80,0.6)", opacity: 0, transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,0,0,0.12)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
