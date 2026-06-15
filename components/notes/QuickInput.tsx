"use client";
import { useState, useEffect, useRef } from "react";
import type { Category } from "@/lib/api";
import { CategoryPills } from "@/components/notes/CategoryPills";

type Props = {
  onSubmit: (text: string, categoryId: string | null) => Promise<void>;
  mobile?: boolean;
  placeholder?: string;
  categories?: Category[];
  onAddCategory?: (name: string) => Promise<Category>;
};

export function QuickInput({ onSubmit, mobile, placeholder, categories, onAddCategory }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const len = text.trim().length;
  const ready = len > 0 && !submitting;

  const submit = async () => {
    if (len === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim(), selectedCatId);
      setText("");
    } catch {
      // Keep the text so the user can retry; the parent shows the error toast
    } finally {
      setSubmitting(false);
      setTimeout(() => ref.current?.focus(), 30);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + "px";
    }
  }, [text]);

  return (
    <>
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: mobile ? "10px 12px" : "12px 16px",
        transition: "border-color 0.2s",
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: submitting ? "#5a5a65" : "linear-gradient(135deg, #c8aa6e, #a08945)",
          flexShrink: 0, marginBottom: 6,
          animation: submitting ? "none" : "pulse 2s ease-in-out infinite",
        }} />
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type an entry and press Enter..."}
          rows={1}
          disabled={submitting}
          style={{
            flex: 1, background: "transparent", border: "none",
            color: "#d4d0c8", fontFamily: "'DM Sans', sans-serif",
            fontSize: 14, lineHeight: 1.6, resize: "none", outline: "none",
            padding: 0, minHeight: 22, maxHeight: 120,
          }}
        />
        <button
          onClick={submit}
          disabled={!ready}
          style={{
            background: ready ? "rgba(200,170,110,0.2)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${ready ? "rgba(200,170,110,0.35)" : "rgba(255,255,255,0.06)"}`,
            color: ready ? "#c8aa6e" : "#3d3d48",
            cursor: ready ? "pointer" : "default",
            fontSize: 16, width: 32, height: 32,
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >↵</button>
      </div>

      {categories && categories.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <CategoryPills
            categories={categories}
            selected={selectedCatId}
            onSelect={setSelectedCatId}
            onAddCategory={onAddCategory}
          />
        </div>
      )}

    </>
  );
}
