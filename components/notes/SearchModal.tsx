"use client";
import { useState, useRef, useEffect } from "react";
import { searchEntriesApi } from "@/lib/api";
import type { SearchResult } from "@/lib/api";
import { DAYS_FULL, MONTHS } from "@/lib/constants";
import { ordinal } from "@/lib/dateUtils";

type Props = {
  onClose: () => void;
  onNavigate: (result: SearchResult) => void;
};

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function SearchModal({ onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(false);
    setResults(null);
    // The embedding model loads on first use, which can take a while
    const hintTimer = setTimeout(() => setSlowHint(true), 3000);
    try {
      setResults(await searchEntriesApi(q));
    } catch {
      setError(true);
    } finally {
      clearTimeout(hintTimer);
      setSlowHint(false);
      setSearching(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(5,5,8,0.7)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "12vh 16px 16px", animation: "overlayIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: "linear-gradient(170deg, rgba(26,26,36,0.98), rgba(13,13,19,0.99))",
          border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,170,110,0.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8aa6e" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") search(); }}
            placeholder="Search your notes by meaning…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#e8e6e1", fontSize: 15, fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <span style={{ fontSize: 10, color: "#4a4a55", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "2px 6px", flexShrink: 0 }}>
            {searching ? "…" : "↵"}
          </span>
        </div>

        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {searching && (
            <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 12, color: "#8a8690" }}>
              <span style={{ animation: "pulse 1.2s ease infinite", display: "inline-block" }}>Searching…</span>
              {slowHint && (
                <div style={{ fontSize: 10, color: "#5a5a65", marginTop: 8 }}>
                  First search loads the AI model — this can take a moment
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 12, color: "#d47070" }}>
              Search failed — make sure the database is up and try again
            </div>
          )}

          {!searching && results !== null && results.length === 0 && (
            <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 12, color: "#5a5a65", fontStyle: "italic" }}>
              No matching notes found
            </div>
          )}

          {!searching && results !== null && results.length > 0 && (
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {results.map(r => {
                const d = parseDateKey(r.date);
                return (
                  <button
                    key={r.id}
                    onClick={() => onNavigate(r)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.18s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,170,110,0.07)"; e.currentTarget.style.borderColor = "rgba(200,170,110,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#c8aa6e", fontWeight: 600 }}>
                        {DAYS_FULL[d.getDay()]}, {MONTHS[d.getMonth()]} {ordinal(d.getDate())} {d.getFullYear()}
                      </span>
                      <span style={{ fontSize: 10, color: "#5a5a65" }}>{r.timeLabel}</span>
                      {r.category && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
                          background: `${r.category.color}18`, border: `1px solid ${r.category.color}28`,
                          color: r.category.color, letterSpacing: "0.4px", textTransform: "uppercase",
                        }}>{r.category.name}</span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#5a5a65", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "1px 7px", fontWeight: 600 }}>
                        {Math.round(r.similarity * 100)}% match
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, color: "#b8b4ae", lineHeight: 1.5,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{r.text}</div>
                  </button>
                );
              })}
            </div>
          )}

          {results === null && !searching && !error && (
            <div style={{ padding: "22px 16px", textAlign: "center", fontSize: 11, color: "#4a4a55" }}>
              Type what you remember and press Enter — finds the 3 closest notes by meaning, not just keywords
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
