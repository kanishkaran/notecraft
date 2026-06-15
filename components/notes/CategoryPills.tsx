"use client";
import { useState, useRef, useEffect } from "react";
import type { Category } from "@/lib/api";

type Props = {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAddCategory?: (name: string) => Promise<Category>;
  compact?: boolean;
};

export function CategoryPills({ categories, selected, onSelect, onAddCategory, compact }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed || !onAddCategory || saving) return;
    setSaving(true);
    try {
      const cat = await onAddCategory(trimmed);
      onSelect(cat.id);
    } catch { /* name conflict — ignore */ }
    setName("");
    setAdding(false);
    setSaving(false);
  };

  const cancel = () => { setName(""); setAdding(false); };

  const pillSize = compact ? { padding: "3px 9px", fontSize: 10 } : { padding: "5px 12px", fontSize: 11 };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" }}>
      {categories.map(cat => {
        const isSelected = selected === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(isSelected ? null : cat.id)}
            style={{
              ...pillSize,
              borderRadius: 20,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.3px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
              transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
              background: isSelected
                ? `linear-gradient(145deg, ${cat.color}55, ${cat.color}30)`
                : `linear-gradient(145deg, ${cat.color}18, ${cat.color}08)`,
              border: `1px solid ${isSelected ? cat.color + "60" : cat.color + "28"}`,
              color: isSelected ? cat.color : cat.color + "99",
              boxShadow: isSelected
                ? `0 1px 3px rgba(0,0,0,0.4), inset 0 2px 5px rgba(0,0,0,0.18), inset 0 -1px 0 ${cat.color}40`
                : `0 3px 8px rgba(0,0,0,0.25), 0 1px 0 ${cat.color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
              transform: isSelected ? "translateY(1px)" : "translateY(0)",
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.background = `linear-gradient(145deg, ${cat.color}28, ${cat.color}12)`;
                e.currentTarget.style.boxShadow = `0 6px 18px ${cat.color}28, 0 2px 0 ${cat.color}22, inset 0 1px 0 rgba(255,255,255,0.1)`;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.color = cat.color;
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.background = `linear-gradient(145deg, ${cat.color}18, ${cat.color}08)`;
                e.currentTarget.style.boxShadow = `0 3px 8px rgba(0,0,0,0.25), 0 1px 0 ${cat.color}18, inset 0 1px 0 rgba(255,255,255,0.06)`;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.color = cat.color + "99";
              }
            }}
          >
            {cat.name}
          </button>
        );
      })}

      {onAddCategory && !adding && (
        <button
          onClick={() => setAdding(true)}
          style={{
            ...pillSize,
            borderRadius: 20,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.12)",
            color: "#4a4a55",
            transition: "all 0.2s",
            boxShadow: "none",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(200,170,110,0.35)";
            e.currentTarget.style.color = "#c8aa6e";
            e.currentTarget.style.background = "rgba(200,170,110,0.06)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color = "#4a4a55";
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
          }}
        >
          + New
        </button>
      )}

      {onAddCategory && adding && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(200,170,110,0.3)",
          borderRadius: 20, padding: "3px 8px 3px 11px",
          animation: "catPillExpand 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
          flexShrink: 0,
        }}>
          <style>{`@keyframes catPillExpand { from { opacity:0; transform:scaleX(0.6); } to { opacity:1; transform:scaleX(1); } }`}</style>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") cancel();
            }}
            placeholder="Name…"
            maxLength={24}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#d4d0c8", fontSize: 11, fontFamily: "'DM Sans'", width: 100,
            }}
          />
          <button
            onClick={confirm}
            disabled={!name.trim() || saving}
            style={{
              background: name.trim() ? "rgba(200,170,110,0.2)" : "transparent",
              border: "none", cursor: name.trim() ? "pointer" : "default",
              color: name.trim() ? "#c8aa6e" : "#3a3a45",
              fontSize: 13, padding: "1px 4px", borderRadius: 4,
              transition: "all 0.15s", lineHeight: 1,
            }}
          >✓</button>
          <button
            onClick={cancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#4a4a55", fontSize: 12, padding: "0 2px", lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#d47070")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a4a55")}
          >✕</button>
        </div>
      )}
    </div>
  );
}
