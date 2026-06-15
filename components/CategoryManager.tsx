"use client";
import { useState } from "react";
import type { Category } from "@/lib/api";
import { CATEGORY_PALETTE } from "@/lib/api";

type Props = {
  categories: Category[];
  onAdd: (name: string) => Promise<Category>;
  onDelete: (id: string) => Promise<void>;
  mobile?: boolean;
};

export function CategoryManager({ categories, onAdd, onDelete, mobile }: Props) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      await onAdd(name);
      setNewName("");
    } catch { /* name conflict */ }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setConfirmDelete(null);
    setDeleting(null);
  };

  const nextColor = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: mobile ? "28px 0" : "44px 0" }}>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: mobile ? 28 : 40 }}>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "2px", color: "#c8aa6e", marginBottom: 10 }}>
          Manage
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: mobile ? 32 : 48, fontWeight: 400, lineHeight: 1.1, color: "#e8e6e1", letterSpacing: "-0.5px" }}>
          Categories
        </h1>
        <p style={{ fontSize: 13, color: "#4a4a55", marginTop: 8, fontWeight: 300 }}>
          Tag entries by category to copy them selectively from the weekly view.
        </p>
      </div>

      {/* Add new */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: mobile ? "16px" : "20px 24px",
        marginBottom: 24,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1.5px", color: "#5a5a65", fontWeight: 500, marginBottom: 12 }}>
          New Category
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Color preview swatch */}
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${nextColor}cc, ${nextColor}66)`,
            boxShadow: `0 4px 12px ${nextColor}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
            border: `1px solid ${nextColor}50`,
          }} />
          <div style={{
            flex: 1,
            display: "flex", gap: 8, alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 14px",
          }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Category name…"
              maxLength={30}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#d4d0c8", fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans'",
              letterSpacing: "0.3px",
              cursor: newName.trim() && !adding ? "pointer" : "default",
              opacity: newName.trim() && !adding ? 1 : 0.4,
              background: `linear-gradient(160deg, ${nextColor}28, ${nextColor}10)`,
              border: `1px solid ${nextColor}38`,
              borderBottom: `2px solid ${nextColor}45`,
              color: nextColor,
              boxShadow: `0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)`,
              transform: "perspective(300px) rotateX(-2deg)",
              transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!newName.trim() || adding) return;
              e.currentTarget.style.transform = "perspective(300px) rotateX(-5deg) translateY(-2px) translateZ(4px)";
              e.currentTarget.style.boxShadow = `0 8px 22px ${nextColor}30, inset 0 1px 0 rgba(255,255,255,0.12)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "perspective(300px) rotateX(-2deg)";
              e.currentTarget.style.boxShadow = `0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)`;
            }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#2a2a35", fontSize: 13, fontStyle: "italic" }}>
          No categories yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((cat, idx) => {
            const isDeleting = deleting === cat.id;
            const isConfirming = confirmDelete === cat.id;
            return (
              <div
                key={cat.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "rgba(255,255,255,0.018)",
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderLeft: `3px solid ${cat.color}`,
                  borderRadius: 12,
                  padding: mobile ? "12px 14px" : "14px 20px",
                  transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  opacity: isDeleting ? 0.4 : 1,
                  animation: `cardIn 0.35s ease ${idx * 0.05}s both`,
                  boxShadow: `0 2px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.03)`,
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${cat.color}, ${cat.color}88)`,
                  boxShadow: `0 0 8px ${cat.color}60`,
                }} />

                {/* Name + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#d4d0c8", fontFamily: "'DM Sans'" }}>
                      {cat.name}
                    </span>
                    {cat.isDefault && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#5a5a65", letterSpacing: "0.5px", textTransform: "uppercase",
                      }}>
                        Default
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isConfirming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#6a4a4a" }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      style={{ background: "rgba(200,80,80,0.15)", border: "none", color: "#d47070", cursor: "pointer", fontSize: 11, padding: "4px 10px", borderRadius: 6, fontFamily: "'DM Sans'", fontWeight: 500 }}
                    >Yes</button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#8a8690", cursor: "pointer", fontSize: 11, padding: "4px 10px", borderRadius: 6, fontFamily: "'DM Sans'" }}
                    >No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(cat.id)}
                    disabled={isDeleting}
                    style={{
                      background: "none", border: "none",
                      color: "#3d3d48", cursor: "pointer", fontSize: 13,
                      padding: "4px 8px", borderRadius: 6,
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#d47070")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#3d3d48")}
                  >✕</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
