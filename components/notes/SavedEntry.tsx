"use client";
import { useState } from "react";
import type { Entry, Category } from "@/lib/api";
import { CategoryPills } from "@/components/notes/CategoryPills";

type Props = {
  entry: Entry;
  onUpdate: (id: string, text: string, categoryId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  mobile?: boolean;
  noConfirm?: boolean;
  categories?: Category[];
  onAddCategory?: (name: string) => Promise<Category>;
};

export function SavedEntry({ entry, onUpdate, onDelete, mobile, noConfirm, categories, onAddCategory }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [editCatId, setEditCatId] = useState<string | null>(entry.categoryId);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (text.trim().length === 0) return;
    setSaving(true);
    try {
      await onUpdate(entry.id, text.trim(), editCatId);
      setEditing(false);
    } catch {
      // Stay in edit mode so the user can retry; the parent shows the error toast
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setText(entry.text); setEditCatId(entry.categoryId); setEditing(false); };

  const cat = entry.category;

  return (
    <div style={{
      background: editing ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
      border: `1px solid ${editing ? "rgba(200,170,110,0.2)" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 10, padding: mobile ? "10px 12px" : "12px 16px",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 8 : 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: cat ? `linear-gradient(135deg, ${cat.color}, ${cat.color}99)` : "linear-gradient(135deg, #c8aa6e, #a08945)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#c8aa6e", fontWeight: 500, letterSpacing: "0.3px", flexShrink: 0 }}>{entry.timeLabel}</span>
          {cat && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
              background: `linear-gradient(135deg, ${cat.color}28, ${cat.color}10)`,
              border: `1px solid ${cat.color}30`,
              color: cat.color,
              letterSpacing: "0.5px", textTransform: "uppercase",
              boxShadow: `0 2px 6px ${cat.color}18, inset 0 1px 0 rgba(255,255,255,0.07)`,
              transform: "perspective(100px) rotateX(-2deg)",
              display: "inline-block", flexShrink: 0,
            }}>
              {cat.name}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {!editing && (
            <button
              onClick={() => { setEditing(true); setText(entry.text); setEditCatId(entry.categoryId); }}
              style={{ background: "none", border: "none", color: "#5a5a65", cursor: "pointer", fontSize: 11, padding: "2px 6px", borderRadius: 4, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c8aa6e")}
              onMouseLeave={e => (e.currentTarget.style.color = "#5a5a65")}
            >Edit</button>
          )}
          {!noConfirm && confirmDel ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#6a4a4a" }}>Delete?</span>
              <button onClick={() => onDelete(entry.id)} style={{ background: "rgba(200,80,80,0.15)", border: "none", color: "#d47070", cursor: "pointer", fontSize: 10, padding: "2px 8px", borderRadius: 4 }}>Yes</button>
              <button onClick={() => setConfirmDel(false)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#8a8690", cursor: "pointer", fontSize: 10, padding: "2px 8px", borderRadius: 4 }}>No</button>
            </div>
          ) : (
            <button
              onClick={() => noConfirm ? onDelete(entry.id) : setConfirmDel(true)}
              style={{ background: "none", border: "none", color: "#3d3d48", cursor: "pointer", fontSize: 12, padding: "2px 6px", borderRadius: 4, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#d47070")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d3d48")}
            >✕</button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") cancel();
            }}
            style={{
              width: "100%", minHeight: 60, background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
              color: "#d4d0c8", fontFamily: "'DM Sans', sans-serif",
              fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none", padding: 10,
            }}
          />
          {categories && categories.length > 0 && (
            <div style={{ marginTop: 8, paddingBottom: 2 }}>
              <CategoryPills
                categories={categories}
                selected={editCatId}
                onSelect={setEditCatId}
                onAddCategory={onAddCategory}
                compact
              />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={cancel} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#8a8690", cursor: "pointer", fontSize: 11, padding: "4px 10px", borderRadius: 6, fontFamily: "'DM Sans'" }}>Cancel</button>
              <button
                onClick={save}
                disabled={saving || text.trim().length === 0}
                style={{ background: "rgba(200,170,110,0.15)", border: "1px solid rgba(200,170,110,0.3)", color: "#c8aa6e", cursor: (saving || text.trim().length === 0) ? "default" : "pointer", fontSize: 11, padding: "4px 12px", borderRadius: 6, fontWeight: 500, fontFamily: "'DM Sans'", opacity: (saving || text.trim().length === 0) ? 0.4 : 1 }}
              >{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#b8b4ae", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.text}</div>
      )}
    </div>
  );
}
