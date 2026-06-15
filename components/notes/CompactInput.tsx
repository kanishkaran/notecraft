"use client";
import { useState } from "react";

type Props = {
  onSubmit: (text: string) => Promise<void>;
};

export function CompactInput({ onSubmit }: Props) {
  const [text, setText] = useState("");

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && text.trim().length > 0) {
      try {
        await onSubmit(text.trim());
        setText("");
      } catch {
        // Keep the text so the user can retry; the parent shows the error toast
      }
    }
  };

  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="+ type..."
      style={{
        width: "100%", background: "transparent", border: "none",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        color: "#8a8690", fontFamily: "'DM Sans', sans-serif",
        fontSize: 10, outline: "none", padding: "5px 6px",
        marginTop: "auto",
      }}
    />
  );
}
