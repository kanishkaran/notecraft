"use client";
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type SummaryRequest = {
  type: "weekly" | "monthly" | "yearly";
  from: string;
  to: string;
  label: string;
};

type Props = {
  request: SummaryRequest;
  onClose: () => void;
};

const TITLES = { weekly: "Weekly recap", monthly: "Monthly review", yearly: "Year in review" };

function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${keyBase}-${i}`} style={{ color: "#e8e6e1", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part,
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const key = `l${i}`;
        if (/^#{1,3} /.test(line)) {
          return (
            <div key={key} style={{
              fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#c8aa6e",
              marginTop: i === 0 ? 0 : 18, marginBottom: 6,
              paddingBottom: 5, borderBottom: "1px solid rgba(200,170,110,0.15)",
            }}>
              {renderInline(line.replace(/^#{1,3} /, ""), key)}
            </div>
          );
        }
        if (/^\s*[-•*] /.test(line)) {
          return (
            <div key={key} style={{ display: "flex", gap: 9, padding: "3px 0 3px 4px", fontSize: 13, lineHeight: 1.65, color: "#b8b4ae" }}>
              <span style={{ color: "#c8aa6e", flexShrink: 0 }}>·</span>
              <span>{renderInline(line.replace(/^\s*[-•*] /, ""), key)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={key} style={{ height: 6 }} />;
        return (
          <p key={key} style={{ fontSize: 13, lineHeight: 1.7, color: "#b8b4ae", margin: "3px 0" }}>
            {renderInline(line, key)}
          </p>
        );
      })}
    </>
  );
}

export function SummaryModal({ request, onClose }: Props) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"loading" | "streaming" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setErrorMsg(j?.message ?? "Something went wrong generating the summary.");
          setPhase("error");
          return;
        }
        setPhase("streaming");
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText(prev => prev + decoder.decode(value, { stream: true }));
        }
        setPhase("done");
      } catch (err) {
        if (!ctrl.signal.aborted) {
          console.error(err);
          setErrorMsg("Connection lost while generating — try again.");
          setPhase("error");
        }
      }
    })();
    return () => ctrl.abort();
  }, [request]);

  useEffect(() => {
    if (phase === "streaming") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [text, phase]);

  // Convert the model's markdown to aligned plain text for pasting anywhere
  const toPlainText = (md: string): string => {
    const lines = md.split("\n").map(line => {
      const clean = line.replace(/\*\*([^*]+)\*\*/g, "$1").trimEnd();
      if (/^#{1,3} /.test(clean)) {
        const heading = clean.replace(/^#{1,3} /, "");
        return `\n${heading}\n${"─".repeat(heading.length)}`;
      }
      if (/^\s*[-•*] /.test(clean)) return `  • ${clean.replace(/^\s*[-•*] /, "")}`;
      return clean;
    });
    const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return `${TITLES[request.type]} — ${request.label}\n\n${body}`;
  };

  const copy = () => {
    navigator.clipboard.writeText(toPlainText(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(5,5,8,0.7)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "8vh 16px 16px", animation: "overlayIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", maxHeight: "82vh",
          background: "linear-gradient(170deg, rgba(26,26,36,0.98), rgba(13,13,19,0.99))",
          border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,170,110,0.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 15 }}>✨</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8e6e1" }}>{TITLES[request.type]}</div>
            <div style={{ fontSize: 10, color: "#5a5a65", letterSpacing: "0.5px", marginTop: 1 }}>{request.label}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            {phase === "done" && (
              <button
                onClick={copy}
                style={{
                  background: copied ? "rgba(200,170,110,0.2)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${copied ? "rgba(200,170,110,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: copied ? "#c8aa6e" : "#8a8690", cursor: "pointer", fontSize: 11,
                  padding: "5px 12px", borderRadius: 7, fontFamily: "'DM Sans'", transition: "all 0.2s",
                }}
              >{copied ? "✓ Copied" : "⎘ Copy"}</button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", color: "#5a5a65", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
            >✕</button>
          </div>
        </div>

        <div ref={scrollRef} style={{ overflowY: "auto", padding: "16px 20px 20px" }}>
          {phase === "loading" && (
            <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "#8a8690" }}>
              <span style={{ animation: "pulse 1.2s ease infinite", display: "inline-block" }}>
                Reading your entries…
              </span>
              {request.type === "yearly" && (
                <div style={{ fontSize: 10, color: "#5a5a65", marginTop: 8 }}>
                  Summarizing each month first — the year review takes a little longer
                </div>
              )}
            </div>
          )}
          {phase === "error" && (
            <div style={{ padding: "26px 0", textAlign: "center", fontSize: 12, color: "#d47070", lineHeight: 1.6 }}>
              {errorMsg}
            </div>
          )}
          {(phase === "streaming" || phase === "done") && <Markdown text={text} />}
          {phase === "streaming" && (
            <span style={{ display: "inline-block", width: 7, height: 14, background: "#c8aa6e", marginLeft: 2, animation: "pulse 1s ease infinite", verticalAlign: "text-bottom" }} />
          )}
        </div>
      </div>
    </div>
  );
}
