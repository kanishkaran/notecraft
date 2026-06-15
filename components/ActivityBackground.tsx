"use client";
import { useMemo } from "react";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

const TILE_STYLES: Record<string, React.CSSProperties> = {
  base: {
    borderRadius: "clamp(8px, 1.1vw, 18px)",
    position: "relative",
    overflow: "hidden",
  },
  0: {
    background: "linear-gradient(145deg, #1e1828, #161220)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  1: {
    background: "linear-gradient(145deg, #5a2e1a, #471f10)",
    border: "1px solid #6b3820",
    boxShadow: "0 4px 14px rgba(0,0,0,0.5), 0 0 22px rgba(217,119,86,0.10), inset 0 1px 0 rgba(217,119,86,0.18)",
  },
  2: {
    background: "linear-gradient(145deg, #8c3e22, #6e2e16)",
    border: "1px solid #a04c2a",
    boxShadow: "0 6px 20px rgba(0,0,0,0.5), 0 0 36px rgba(217,119,86,0.18), inset 0 1px 0 rgba(240,148,108,0.24)",
  },
  3: {
    background: "linear-gradient(145deg, #b85236, #923f26)",
    border: "1px solid rgba(217,119,86,0.60)",
    boxShadow: "0 8px 26px rgba(0,0,0,0.48), 0 0 50px rgba(217,119,86,0.26), inset 0 1px 0 rgba(248,162,124,0.32)",
  },
  4: {
    background: "linear-gradient(145deg, #d97756, #b85c3c)",
    border: "1px solid rgba(217,119,86,0.80)",
    boxShadow: "0 10px 34px rgba(0,0,0,0.48), 0 0 65px rgba(217,119,86,0.38), 0 0 110px rgba(217,119,86,0.15), inset 0 1px 0 rgba(255,188,158,0.42)",
  },
  today: {
    background: "linear-gradient(145deg, #e8845e, #c8582e)",
    border: "1px solid rgba(240,148,112,0.90)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(217,119,86,0.42), 0 0 70px rgba(217,119,86,0.48), 0 0 120px rgba(217,119,86,0.18), inset 0 1px 0 rgba(255,200,172,0.52)",
  },
  future: {
    background: "#0e0e18",
    border: "1px solid rgba(255,255,255,0.03)",
    boxShadow: "none",
    opacity: 0.35,
  },
};

interface Props {
  data: Record<string, number>;
  year: number;
  month: number;
}

export function ActivityBackground({ data, year, month }: Props) {
  const today = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const COLS = daysInMonth <= 28 ? 7 : daysInMonth <= 30 ? 6 : 7;
  const ROWS = Math.ceil(daysInMonth / COLS);

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const key = dateKey(date);
      const count = data[key] ?? 0;
      const isToday = isSameDay(date, today);
      const isFuture = date > today && !isToday;
      return { isToday, isFuture, level: heatLevel(count) };
    });
  }, [data, year, month]); // eslint-disable-line

  return (
    <>
      {/* tile grid */}
      <div style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "94vw",
        height: "75vh",
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gap: "clamp(6px, 1.1vw, 16px)",
        pointerEvents: "none",
        zIndex: 1,
      }}>
        {days.map(({ isToday, isFuture, level }, i) => {
          const variant = isFuture ? "future" : isToday ? "today" : String(level);
          return (
            <div
              key={i}
              style={{ ...TILE_STYLES.base, ...TILE_STYLES[variant] }}
            />
          );
        })}
      </div>

      {/* vignette */}
      <div style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        background: `
          linear-gradient(to right, rgba(10,10,16,0.90) 0%, transparent 6%, transparent 94%, rgba(10,10,16,0.90) 100%),
          linear-gradient(to bottom, rgba(10,10,16,0.92) 0%, transparent 6%, transparent 92%, rgba(10,10,16,0.92) 100%)
        `,
      }} />
    </>
  );
}
