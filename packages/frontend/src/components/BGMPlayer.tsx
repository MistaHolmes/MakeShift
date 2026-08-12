"use client";

import React, { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const PLAYLIST_ID = "PLk4TWo67UoXhMcfG-af8ZXFlBdGr_NKkH";

const formatTime = (secs: number) => {
  if (isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function BGMPlayer() {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState("Loading music...");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          setProgress(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration() || 1);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player("bgm-yt-player", {
        height: "1",
        width: "1",
        playerVars: {
          listType: "playlist",
          list: PLAYLIST_ID,
          autoplay: 1,
          controls: 0,
          disablekb: 1,
        },
        events: {
          onReady: (event: any) => {
            const player = event.target;
            player.setShuffle(true);
            const playlist = player.getPlaylist();
            if (playlist && playlist.length > 0) {
              const randomIdx = Math.floor(Math.random() * playlist.length);
              player.playVideoAt(randomIdx);
              setTimeout(() => {
                updateVideoData();
              }, 300);
            } else {
              updateVideoData();
            }
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              updateVideoData();
            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.UNSTARTED) {
              updateVideoData();
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const updateVideoData = () => {
    if (!playerRef.current || !playerRef.current.getVideoData) return;
    const data = playerRef.current.getVideoData();
    if (data && data.video_id) {
      setVideoId(data.video_id);
      setSongTitle(data.title || "Lofi Beats");
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playerRef.current || !playerRef.current.playVideo) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const playNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerRef.current && playerRef.current.nextVideo) playerRef.current.nextVideo();
  };

  const playPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerRef.current && playerRef.current.previousVideo) playerRef.current.previousVideo();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const time = parseFloat(e.target.value);
    setProgress(time);
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time, true);
    }
  };

  const coverUrl = videoId 
    ? `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`
    : "linear-gradient(135deg, #111, #333)";

  return (
    <div style={{
      position: "fixed", bottom: 40, right: "6vw", zIndex: 40,
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
    }}>
      {/* Hidden container for YT iframe */}
      <div id="bgm-yt-player" style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />

      <div 
        className="liquid-glass"
        onClick={() => setExpanded(!expanded)}
        style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "flex-start",
          borderRadius: expanded ? 48 : 99,
          padding: 8,
          width: expanded ? 500 : 80,
          height: 80,
          transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        {/* Expanded Controls (Rendered horizontally when expanded) */}
        <div style={{
           display: "flex", flexDirection: "row", alignItems: "center",
           width: expanded ? 420 : 0,
           opacity: expanded ? 1 : 0,
           pointerEvents: expanded ? "auto" : "none",
           transition: "opacity 0.3s ease, width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
           paddingLeft: expanded ? 16 : 0,
           overflow: "hidden",
           whiteSpace: "nowrap"
        }}>
           
           {/* 1. Play Controls (Left) */}
           <div style={{ display: "flex", alignItems: "center", gap: 16, marginRight: 24, flexShrink: 0 }}>
             <button onClick={playPrev} className="hover:text-white transition-colors" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
             </button>
             <button onClick={togglePlay} className="hover:scale-110 active:scale-95 transition-all" style={{ background: "var(--clr-accent)", border: "none", color: "#000", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                {isPlaying ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
             </button>
             <button onClick={playNext} className="hover:text-white transition-colors" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
             </button>
           </div>
           
           {/* 2. Middle Section: Title, Slider, Time (Center) */}
           <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, paddingRight: 24, paddingTop: 4 }}>
             <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", color: "#fff", textOverflow: "ellipsis", overflow: "hidden" }}>
               {songTitle}
             </span>
             <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
               YouTube Music
             </span>
             
             {/* Progress Slider */}
             <div 
               style={{ position: "relative", height: 12, display: "flex", alignItems: "center", width: "100%", marginBottom: 4 }}
               onClick={e => e.stopPropagation()}
             >
               <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99 }} />
               <div style={{ position: "absolute", left: 0, height: 3, background: "var(--clr-accent)", borderRadius: 99, width: `${(progress / duration) * 100}%` }} />
               <input 
                 type="range" min="0" max={duration} step="0.1" 
                 value={progress} onChange={handleSeek} 
                 style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer", zIndex: 10 }} 
               />
               <div style={{ 
                 position: "absolute", left: `${(progress / duration) * 100}%`, transform: "translateX(-50%)", 
                 width: 10, height: 10, background: "#fff", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
               }} />
             </div>
             
             {/* Time Text */}
             <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
               {formatTime(progress)} / {formatTime(duration)}
             </span>
           </div>

        </div>

        {/* 3. The spinning CD toggle (Right) */}
        <div 
          style={{
            position: "absolute", right: 8,
            flexShrink: 0,
            width: 64, height: 64, borderRadius: "50%",
            backgroundImage: coverUrl,
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "spin 8s linear infinite",
            animationPlayState: isPlaying ? "running" : "paused",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
          className="hover:scale-105 active:scale-95 transition-transform"
        >
          {/* CD Reflection Overlay */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.1) 45deg, transparent 90deg, rgba(255,255,255,0.1) 135deg, transparent 180deg, rgba(255,255,255,0.1) 225deg, transparent 270deg, rgba(255,255,255,0.1) 315deg, transparent 360deg)"
          }} />
          
          {/* CD Grooves */}
          <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", inset: 12, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", inset: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />
          
          {/* Center Hole Label */}
          <div style={{ 
            width: 20, height: 20, borderRadius: "50%", 
            background: "rgba(0,0,0,0.8)", 
            backdropFilter: "blur(4px)",
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.2)"
          }}>
            {/* Center Hole */}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", opacity: 0.8 }} />
          </div>
        </div>

      </div>
    </div>
  );
}
