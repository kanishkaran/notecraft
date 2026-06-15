"use client";
import { useEffect, useState } from "react";
import type { Entry, Category } from "@/lib/api";
import { DAYS_FULL, MONTHS } from "@/lib/constants";
import { ordinal } from "@/lib/dateUtils";
import { CategoryPills } from "@/components/notes/CategoryPills";

type Props = {
  entry: Entry;
  date: Date;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  categories?: Category[];
  onUpdateCategory?: (id: string, categoryId: string | null) => Promise<void>;
  onAddCategory?: (name: string) => Promise<Category>;
};

const roll: React.CSSProperties = {
  height: 18,
  background: "linear-gradient(to bottom, #2e1a06 0%, #7a5020 30%, #c4964a 50%, #7a5020 70%, #2e1a06 100%)",
  borderRadius: "50% / 9px",
  boxShadow: "0 3px 10px rgba(0,0,0,0.45)",
};

export function NoteModal({ entry, date, onDelete, onClose, categories, onUpdateCategory, onAddCategory }: Props) {
  const [catId, setCatId] = useState<string | null>(entry.categoryId);
  const [changingCat, setChangingCat] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cat = categories?.find(c => c.id === catId) ?? null;

  const handleCatSelect = async (id: string | null) => {
    setCatId(id);
    setChangingCat(false);
    if (onUpdateCategory) await onUpdateCategory(entry.id, id);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(4,4,8,0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px", animation: "overlayIn 0.18s ease",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, animation: "scrollUnfurl 0.28s cubic-bezier(0.34,1.2,0.64,1)" }}>
        <div style={{ ...roll, marginBottom: -1, position: "relative", zIndex: 1 }} />

        <div style={{
          background: "linear-gradient(175deg, #f7eed8 0%, #f0e4c0 100%)",
          padding: "32px 40px 26px",
          boxShadow: "0 0 0 1px rgba(50,25,5,0.22), 0 8px 40px rgba(0,0,0,0.45)",
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "rgba(50,25,5,0.28)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 4, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(50,25,5,0.65)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(50,25,5,0.28)")}
          >✕</button>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(60,30,8,0.4)", fontFamily: "'DM Sans'", marginBottom: 5 }}>
              {DAYS_FULL[date.getDay()]}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: "#1e1008", letterSpacing: "-0.2px" }}>
              {MONTHS[date.getMonth()]} {ordinal(date.getDate())}, {date.getFullYear()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "rgba(60,30,8,0.42)", fontFamily: "'DM Sans'" }}>{entry.timeLabel}</span>
              {categories && categories.length > 0 && !changingCat && (
                <button
                  onClick={() => setChangingCat(true)}
                  style={{
                    background: cat ? `linear-gradient(135deg, ${cat.color}22, ${cat.color}0c)` : "rgba(50,25,5,0.06)",
                    border: cat ? `1px solid ${cat.color}35` : "1px dashed rgba(50,25,5,0.15)",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.5px", textTransform: "uppercase",
                    color: cat ? cat.color : "rgba(60,30,8,0.35)",
                    cursor: "pointer",
                    fontFamily: "'DM Sans'",
                    boxShadow: cat ? `0 2px 6px ${cat.color}15, inset 0 1px 0 rgba(255,255,255,0.4)` : "none",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  {cat ? cat.name : "Tag…"}
                </button>
              )}
              {categories && categories.length > 0 && changingCat && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CategoryPills
                    categories={categories}
                    selected={catId}
                    onSelect={handleCatSelect}
                    onAddCategory={onAddCategory}
                    compact
                  />
                  <button
                    onClick={() => setChangingCat(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(60,30,8,0.3)", fontSize: 11, padding: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(60,30,8,0.7)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(60,30,8,0.3)")}
                  >✕</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(50,25,5,0.12)", marginBottom: 20 }} />

          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, lineHeight: 1.95, color: "#1e1008", whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: 56 }}>
            {entry.text}
          </div>

          <div style={{ height: 1, background: "rgba(50,25,5,0.08)", margin: "20px 0 16px" }} />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => { onDelete(entry.id); onClose(); }}
              style={{ background: "none", border: "none", color: "rgba(90,20,10,0.45)", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans'", letterSpacing: "0.5px", padding: "4px 0", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(90,20,10,0.85)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(90,20,10,0.45)")}
            >Delete entry</button>
          </div>
        </div>

        <div style={{ ...roll, marginTop: -1 }} />
      </div>
    </div>
  );
}
