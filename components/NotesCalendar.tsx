"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { DAYS_SHORT, DAYS_FULL, MONTHS, MONTHS_SHORT } from "@/lib/constants";
import { getWeekDates, getMonthDates, dk, isSameDay, timeStr, ordinal } from "@/lib/dateUtils";
import {
  fetchEntries, fetchEntriesRange, createEntry, updateEntryApi, deleteEntryApi,
  fetchCategories, createCategoryApi, deleteCategoryApi, CATEGORY_PALETTE,
} from "@/lib/api";
import type { Entry, Category, SearchResult } from "@/lib/api";
import { useWindowWidth } from "@/hooks/useWindowWidth";
import { signOut } from "next-auth/react";
import { SavedEntry } from "@/components/notes/SavedEntry";
import { QuickInput } from "@/components/notes/QuickInput";
import { CompactInput } from "@/components/notes/CompactInput";
import { NoteModal } from "@/components/notes/NoteModal";
import { SearchModal } from "@/components/notes/SearchModal";
import { SummaryModal } from "@/components/notes/SummaryModal";
import type { SummaryRequest } from "@/components/notes/SummaryModal";
import { CategoryManager } from "@/components/CategoryManager";
import { ActivityBackground } from "@/components/ActivityBackground";

type ModalState = { entry: Entry; date: Date };
type CopiedState = { dateKey: string; catId: string | null };
type UserInfo = { name: string | null; image: string | null };

export default function NotesCalendar({ user }: { user?: UserInfo }) {
  const today = new Date();
  const [view, setView] = useState<"today" | "weekly" | "monthly" | "categories">("today");
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [mounted, setMounted] = useState(false);
  const [expandedWeekDay, setExpandedWeekDay] = useState<number | null>(null);
  const [copied, setCopied] = useState<CopiedState | null>(null);
  const [modalEntry, setModalEntry] = useState<ModalState | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null); // category id, "untagged", or null = all
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [summaryReq, setSummaryReq] = useState<SummaryRequest | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const width = useWindowWidth();
  const mobile = width < 680;
  const tablet = width < 960;


  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const fromKey = `${y}-${String(m+1).padStart(2,"0")}-01`;
    const lastDay = new Date(y, m+1, 0).getDate();
    const toKey = `${y}-${String(m+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    fetch(`/api/entries/heatmap?from=${fromKey}&to=${toKey}`)
      .then(r => r.json())
      .then(setHeatmapData)
      .catch(() => {});
  }, [currentDate.getFullYear(), currentDate.getMonth()]); // eslint-disable-line

  // Keep heatmap in sync — only for days already loaded in the entries cache
  useEffect(() => {
    if (Object.keys(entries).length === 0) return;
    setHeatmapData(prev => {
      const next = { ...prev };
      let changed = false;
      for (const [key, dayEntries] of Object.entries(entries)) {
        if (dayEntries === undefined) continue;
        const count = dayEntries.length;
        if (next[key] !== count) { next[key] = count; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  const loadDate = useCallback(async (d: Date) => {
    const key = dk(d);
    if (entries[key] !== undefined || loadingDates.has(key)) return;
    setLoadingDates(prev => new Set(prev).add(key));
    const data = await fetchEntries(key);
    setEntries(prev => ({ ...prev, [key]: data }));
    setLoadingDates(prev => { const s = new Set(prev); s.delete(key); return s; });
  }, [entries, loadingDates]);

  useEffect(() => { loadDate(today); }, []); // eslint-disable-line

  const weekDates = getWeekDates(currentDate);
  const monthCells = getMonthDates(currentDate.getFullYear(), currentDate.getMonth());

  useEffect(() => {
    if (view !== "weekly") return;
    const uncached = weekDates.filter(d => entries[dk(d)] === undefined);
    if (uncached.length === 0) return;
    const from = dk(weekDates[0]);
    const to = dk(weekDates[6]);
    setRangeLoading(true);
    fetchEntriesRange(from, to).then(grouped => {
      setEntries(prev => {
        const next = { ...prev };
        weekDates.forEach(d => { const k = dk(d); if (next[k] === undefined) next[k] = grouped[k] ?? []; });
        return next;
      });
    }).finally(() => setRangeLoading(false));
  }, [view, currentDate]); // eslint-disable-line

  useEffect(() => {
    if (view !== "monthly") return;
    const dates = monthCells.map(c => c.date);
    const uncached = dates.filter(d => entries[dk(d)] === undefined);
    if (uncached.length === 0) return;
    const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
    const from = dk(sorted[0]);
    const to = dk(sorted[sorted.length - 1]);
    setRangeLoading(true);
    fetchEntriesRange(from, to).then(grouped => {
      setEntries(prev => {
        const next = { ...prev };
        dates.forEach(d => { const k = dk(d); if (next[k] === undefined) next[k] = grouped[k] ?? []; });
        return next;
      });
    }).finally(() => setRangeLoading(false));
  }, [view, currentDate, selectedDate]); // eslint-disable-line

  const getEntries = useCallback((d: Date): Entry[] => entries[dk(d)] ?? [], [entries]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // Entries visible in the weekly view after the tag filter is applied
  const getFilteredEntries = useCallback((d: Date): Entry[] => {
    const all = entries[dk(d)] ?? [];
    if (!tagFilter) return all;
    if (tagFilter === "untagged") return all.filter(e => !e.categoryId);
    return all.filter(e => e.categoryId === tagFilter);
  }, [entries, tagFilter]);

  // Floating tag filter widget — sits outside the week table, on its left
  const renderTagWidget = () => {
    if (categories.length === 0) return null;
    const counts: Record<string, number> = {};
    let untaggedCount = 0, totalCount = 0;
    weekDates.forEach(d => (entries[dk(d)] ?? []).forEach(e => {
      totalCount++;
      if (e.categoryId) counts[e.categoryId] = (counts[e.categoryId] ?? 0) + 1;
      else untaggedCount++;
    }));
    return (
      <>
        {tagFilterOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 89 }} onClick={() => setTagFilterOpen(false)} />
        )}
        <div
          className="tag-widget"
          style={mobile
            ? { position: "fixed", left: 14, top: "auto", bottom: 22 }
            // Keep the button on-screen when the page margin is narrower than the full 64px offset
            : { left: -Math.min(64, Math.max((width - 1200) / 2, 0) + 26) }}
        >
          <button
            className={`tag-widget-btn${tagFilterOpen ? " open" : ""}`}
            onClick={() => setTagFilterOpen(o => !o)}
            title="Filter by tag"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {tagFilter && <span className="filter-dot" />}
          </button>
          <div
            className={`tag-widget-panel${tagFilterOpen ? " open" : ""}`}
            style={mobile ? { top: "auto", bottom: 56, transformOrigin: "left bottom" } : undefined}
          >
            <div className="tag-widget-title">Filter by tag</div>
            <button
              className="tag-widget-item"
              style={{
                ["--i" as string]: 0,
                ...(tagFilter === null ? { background: "rgba(200,170,110,0.12)", borderColor: "rgba(200,170,110,0.35)", color: "#c8aa6e" } : {}),
              }}
              onClick={() => setTagFilter(null)}
            >
              <span className="pill-dot" style={{ background: "#c8aa6e", opacity: tagFilter === null ? 1 : 0.5 }} />
              All
              <span className="tag-count">{totalCount}</span>
            </button>
            {categories.map((cat, idx) => {
              const active = tagFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  className="tag-widget-item"
                  style={{
                    ["--i" as string]: idx + 1,
                    ...(active ? { background: `${cat.color}1c`, borderColor: `${cat.color}50`, color: cat.color } : {}),
                  }}
                  onClick={() => setTagFilter(active ? null : cat.id)}
                >
                  <span className="pill-dot" style={{ background: cat.color, opacity: active ? 1 : 0.55, boxShadow: active ? `0 0 8px ${cat.color}90` : "none" }} />
                  {cat.name}
                  <span className="tag-count">{counts[cat.id] ?? 0}</span>
                </button>
              );
            })}
            {untaggedCount > 0 && (
              <button
                className="tag-widget-item"
                style={{
                  ["--i" as string]: categories.length + 1,
                  ...(tagFilter === "untagged" ? { background: "rgba(107,114,128,0.15)", borderColor: "rgba(107,114,128,0.5)", color: "#9ca3af" } : {}),
                }}
                onClick={() => setTagFilter(tagFilter === "untagged" ? null : "untagged")}
              >
                <span className="pill-dot" style={{ background: "#6b7280", opacity: tagFilter === "untagged" ? 1 : 0.55 }} />
                Untagged
                <span className="tag-count">{untaggedCount}</span>
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  // All mutations apply to the UI immediately and roll back with a toast if the API call fails
  const addEntry = useCallback(async (d: Date, text: string, categoryId: string | null = null) => {
    const now = new Date();
    const key = dk(d);
    const tempId = `temp-${now.getTime()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Entry = {
      id: tempId, date: key, text, timeLabel: timeStr(now), timestamp: now.getTime(),
      categoryId, category: categories.find(c => c.id === categoryId) ?? null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
    setEntries(prev => ({ ...prev, [key]: [...(prev[key] ?? []), optimistic] }));
    try {
      const entry = await createEntry(key, text, timeStr(now), now.getTime(), categoryId);
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === tempId ? entry : e) }));
    } catch (err) {
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(e => e.id !== tempId) }));
      showToast("Couldn't save the entry — check your connection and try again");
      throw err;
    }
  }, [categories, showToast]);

  const updateEntry = useCallback(async (d: Date, entryId: string, text: string, categoryId?: string | null) => {
    const key = dk(d);
    const snapshot = entries[key]?.find(e => e.id === entryId);
    if (!snapshot) return;
    const nextCatId = categoryId === undefined ? snapshot.categoryId : categoryId;
    const optimistic: Entry = {
      ...snapshot, text, categoryId: nextCatId,
      category: nextCatId ? categories.find(c => c.id === nextCatId) ?? null : null,
    };
    setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? optimistic : e) }));
    try {
      const updated = await updateEntryApi(entryId, text, categoryId);
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? updated : e) }));
    } catch (err) {
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? snapshot : e) }));
      showToast("Couldn't save your changes — check your connection and try again");
      throw err;
    }
  }, [entries, categories, showToast]);

  const updateEntryCategory = useCallback(async (d: Date, entryId: string, categoryId: string | null) => {
    const key = dk(d);
    const existing = entries[key]?.find(e => e.id === entryId);
    if (!existing) return null;
    const optimistic: Entry = {
      ...existing, categoryId,
      category: categoryId ? categories.find(c => c.id === categoryId) ?? null : null,
    };
    setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? optimistic : e) }));
    try {
      const updated = await updateEntryApi(entryId, existing.text, categoryId);
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? updated : e) }));
      return updated;
    } catch {
      setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => e.id === entryId ? existing : e) }));
      showToast("Couldn't change the tag — check your connection and try again");
      return existing;
    }
  }, [entries, categories, showToast]);

  const deleteEntry = useCallback(async (d: Date, entryId: string) => {
    const key = dk(d);
    const snapshot = entries[key] ?? [];
    setEntries(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(e => e.id !== entryId) }));
    try {
      await deleteEntryApi(entryId);
    } catch {
      setEntries(prev => ({ ...prev, [key]: snapshot }));
      showToast("Couldn't delete the entry — check your connection and try again");
    }
  }, [entries, showToast]);

  const handleAddCategory = useCallback(async (name: string): Promise<Category> => {
    const color = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length];
    const cat = await createCategoryApi(name, color);
    setCategories(prev => [...prev, cat]);
    return cat;
  }, [categories]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    await deleteCategoryApi(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    setTagFilter(prev => prev === id ? null : prev);
    // Strip the deleted category from all cached entries
    setEntries(prev => {
      const next: Record<string, Entry[]> = {};
      for (const [key, dayEntries] of Object.entries(prev)) {
        next[key] = dayEntries.map(e => e.categoryId === id ? { ...e, categoryId: null, category: null } : e);
      }
      return next;
    });
  }, []);

  const copyEntries = useCallback((d: Date, entriesToCopy: Entry[], catId: string | null) => {
    const header = `${DAYS_FULL[d.getDay()]}, ${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}`;
    const lines = entriesToCopy.map(e => `• ${e.text}`).join("\n");
    navigator.clipboard.writeText(lines ? `${header}\n${lines}` : header);
    const dateKey = dk(d);
    setCopied({ dateKey, catId });
    setTimeout(() => setCopied(prev => prev?.dateKey === dateKey ? null : prev), 2000);
  }, []);

  const renderCopyBar = useCallback((d: Date, dayEntries: Entry[]) => {
    if (dayEntries.length === 0) return null;
    const dateKey = dk(d);

    const catsWithEntries = categories.filter(cat => dayEntries.some(e => e.categoryId === cat.id));
    const untaggedEntries = dayEntries.filter(e => !e.categoryId);
    const groupCount = catsWithEntries.length + (untaggedEntries.length > 0 ? 1 : 0);

    const makeBtn = (label: string, count: number, color: string, catId: string | null, entriesToCopy: Entry[]) => {
      const isCopied = copied?.dateKey === dateKey && copied?.catId === catId;
      return (
        <button
          key={label}
          onClick={() => !isCopied && copyEntries(d, entriesToCopy, catId)}
          style={{
            padding: "7px 15px",
            borderRadius: 10,
            fontSize: 11, fontWeight: 600,
            fontFamily: "'DM Sans'",
            cursor: isCopied ? "default" : "pointer",
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
            WebkitTapHighlightColor: "transparent",
            background: isCopied
              ? `linear-gradient(160deg, ${color}45, ${color}25)`
              : `linear-gradient(160deg, ${color}1a, ${color}08)`,
            border: `1px solid ${isCopied ? color + "50" : color + "28"}`,
            borderBottom: isCopied ? `2px solid ${color}50` : `2px solid ${color}38`,
            color: isCopied ? color : `${color}bb`,
            boxShadow: isCopied
              ? `0 1px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.12)`
              : `0 4px 14px rgba(0,0,0,0.28), 0 2px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)`,
            transform: isCopied
              ? "perspective(500px) rotateX(0deg) translateY(1px)"
              : "perspective(500px) rotateX(-3deg) translateZ(0)",
            transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onMouseEnter={e => {
            if (isCopied) return;
            e.currentTarget.style.background = `linear-gradient(160deg, ${color}30, ${color}14)`;
            e.currentTarget.style.borderBottom = `2px solid ${color}55`;
            e.currentTarget.style.boxShadow = `0 10px 28px ${color}30, 0 4px 0 rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.12)`;
            e.currentTarget.style.transform = "perspective(500px) rotateX(-6deg) translateY(-3px) translateZ(6px)";
            e.currentTarget.style.color = color;
          }}
          onMouseLeave={e => {
            if (isCopied) return;
            e.currentTarget.style.background = `linear-gradient(160deg, ${color}1a, ${color}08)`;
            e.currentTarget.style.borderBottom = `2px solid ${color}38`;
            e.currentTarget.style.boxShadow = `0 4px 14px rgba(0,0,0,0.28), 0 2px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07)`;
            e.currentTarget.style.transform = "perspective(500px) rotateX(-3deg) translateZ(0)";
            e.currentTarget.style.color = `${color}bb`;
          }}
          onMouseDown={e => {
            if (isCopied) return;
            e.currentTarget.style.transform = "perspective(500px) rotateX(0deg) translateY(1px)";
            e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.14)`;
            e.currentTarget.style.borderBottom = `1px solid ${color}38`;
          }}
          onMouseUp={e => {
            if (isCopied) return;
            e.currentTarget.style.transform = "perspective(500px) rotateX(-6deg) translateY(-3px) translateZ(6px)";
            e.currentTarget.style.boxShadow = `0 10px 28px ${color}30, 0 4px 0 rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.12)`;
            e.currentTarget.style.borderBottom = `2px solid ${color}55`;
          }}
        >
          {isCopied ? `✓ Copied!` : `⎘ ${label} (${count})`}
        </button>
      );
    };

    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14, marginBottom: 2 }}>
        {catsWithEntries.map(cat => makeBtn(cat.name, dayEntries.filter(e => e.categoryId === cat.id).length, cat.color, cat.id, dayEntries.filter(e => e.categoryId === cat.id)))}
        {untaggedEntries.length > 0 && makeBtn("Untagged", untaggedEntries.length, "#6b7280", "untagged", untaggedEntries)}
        {groupCount > 1 && makeBtn("All", dayEntries.length, "#c8aa6e", null, dayEntries)}
        {groupCount <= 1 && makeBtn("Copy", dayEntries.length, "#c8aa6e", null, dayEntries)}
      </div>
    );
  }, [categories, copied, copyEntries]);

  const navPrev = () => {
    if (view === "weekly") setCurrentDate(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; });
    else if (view === "monthly") setCurrentDate(p => { const d = new Date(p); d.setMonth(d.getMonth() - 1); return d; });
  };
  const navNext = () => {
    if (view === "weekly") setCurrentDate(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; });
    else if (view === "monthly") setCurrentDate(p => { const d = new Date(p); d.setMonth(d.getMonth() + 1); return d; });
  };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); setView("today"); };

  const handleSearchNavigate = useCallback((r: SearchResult) => {
    const [y, m, d] = r.date.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    setSearchOpen(false);
    setView("monthly");
    setCurrentDate(target);
    setSelectedDate(target);
  }, []);

  // Global shortcuts: ⌘K search, 1-4 switch views, ←/→ navigate, T jumps to today
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (searchOpen || modalEntry || summaryReq || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "1": setView("today"); setCurrentDate(new Date()); loadDate(new Date()); break;
        case "2": setView("weekly"); break;
        case "3": setView("monthly"); break;
        case "4": setView("categories"); break;
        case "t": case "T": goToday(); break;
        case "ArrowLeft": if (view === "weekly" || view === "monthly") navPrev(); break;
        case "ArrowRight": if (view === "weekly" || view === "monthly") navNext(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-registered each render so handlers always see fresh state

  const px = mobile ? "16px" : "32px";

  return (
    <>
    {view === "today" && (
      <ActivityBackground
        data={heatmapData}
        year={currentDate.getFullYear()}
        month={currentDate.getMonth()}
      />
    )}
    <div style={{
      minHeight: "100vh", background: view === "today" ? "transparent" : "#0a0a0f",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#e8e6e1",
      opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease", overflowX: "hidden",
      position: "relative", zIndex: 3,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=Playfair+Display:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }

        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .skeleton {
          border-radius: 10px;
          background: linear-gradient(90deg, rgba(255,255,255,0.025) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.025) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease infinite;
        }

        .search-btn {
          display: flex; align-items: center; gap: 7px; flex-shrink: 0;
          padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px;
          border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
          color: #8a8690; cursor: pointer; transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .search-btn:hover { border-color: rgba(200,170,110,0.3); color: #c8aa6e; }
        .search-btn .kbd-hint {
          font-size: 10px; color: #4a4a55; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 4px; padding: 1px 5px;
        }

        .ai-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 13px; border-radius: 6px;
          border: 1px solid rgba(167,139,250,0.3); background: rgba(167,139,250,0.07);
          color: #b9a5f5; font-size: 11px; font-weight: 500; cursor: pointer;
          transition: all 0.2s; font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.3px; -webkit-tap-highlight-color: transparent; white-space: nowrap;
        }
        .ai-btn:hover { background: rgba(167,139,250,0.15); border-color: rgba(167,139,250,0.5); }

        .nav-pill {
          padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 500;
          letter-spacing: 0.5px; cursor: pointer; transition: all 0.25s ease;
          border: 1px solid transparent; text-transform: uppercase;
          user-select: none; -webkit-tap-highlight-color: transparent; white-space: nowrap;
        }
        .nav-pill:hover { background: rgba(255,255,255,0.04); }
        .nav-pill.active {
          background: linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.05));
          border-color: rgba(200,170,110,0.3); color: #c8aa6e;
        }

        .month-cell {
          aspect-ratio: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start;
          padding-top: 6px; border-radius: 10px; cursor: pointer;
          transition: all 0.2s; position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .month-cell:hover { background: rgba(255,255,255,0.04); }
        .month-cell.today-cell { background: rgba(200,170,110,0.08); }
        .month-cell.selected-cell { background: rgba(200,170,110,0.15); box-shadow: inset 0 0 0 1px rgba(200,170,110,0.3); }
        .month-cell.other-month { opacity: 0.25; }
        .month-cell.has-entries::after {
          content: ''; width: 4px; height: 4px; border-radius: 50%;
          background: #c8aa6e; position: absolute; bottom: 4px;
        }

        .arrow-btn {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
          color: #8a8690; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; font-size: 16px;
          -webkit-tap-highlight-color: transparent;
        }
        .arrow-btn:hover { border-color: rgba(200,170,110,0.3); color: #c8aa6e; }

        .today-btn {
          padding: 5px 12px; border-radius: 6px;
          border: 1px solid rgba(200,170,110,0.25); background: rgba(200,170,110,0.08);
          color: #c8aa6e; font-size: 11px; font-weight: 500; cursor: pointer;
          transition: all 0.2s; font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.3px; -webkit-tap-highlight-color: transparent;
        }
        .today-btn:hover { background: rgba(200,170,110,0.15); }

        .week-day-card {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; overflow: hidden; transition: all 0.25s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .week-day-card.expanded { border-color: rgba(200,170,110,0.15); background: rgba(255,255,255,0.02); }
        .week-day-card.is-today { border-color: rgba(200,170,110,0.2); }

        .week-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; cursor: pointer; -webkit-tap-highlight-color: transparent;
        }

        .entry-card:hover { border-color: rgba(255,255,255,0.1) !important; }

        .week-grid-chip {
          padding: 3px 6px; margin: 2px 3px;
          background: rgba(200,170,110,0.08); border-left: 2px solid #c8aa6e;
          border-radius: 0 4px 4px 0; font-size: 10px; color: #c8aa6e;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          cursor: pointer; transition: all 0.15s; user-select: none;
        }
        .week-grid-chip:hover { background: rgba(200,170,110,0.18); border-left-color: #e0c080; }

        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scrollUnfurl {
          from { opacity: 0; transform: scaleY(0.6) translateY(-10px); }
          to   { opacity: 1; transform: scaleY(1) translateY(0); }
        }

        .week-grid-col {
          flex: 1; border-right: 1px solid rgba(255,255,255,0.04);
          min-width: 0; display: flex; flex-direction: column;
        }
        .week-grid-col:last-child { border-right: none; }

        .week-header-cell {
          cursor: pointer; transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .week-header-cell:hover { background: rgba(255,255,255,0.03); }
        .week-header-cell.copied { background: rgba(200,170,110,0.07); }

        .tag-widget {
          position: absolute; left: -64px; top: 0; z-index: 90;
        }
        .tag-widget-btn {
          width: 46px; height: 46px; border-radius: 14px; position: relative;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(160deg, rgba(28,28,38,0.92), rgba(14,14,20,0.96));
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          color: #8a8690; display: flex; align-items: center; justify-content: center;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
          transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tag-widget-btn:hover {
          border-color: rgba(200,170,110,0.4); color: #c8aa6e;
          transform: scale(1.08);
          box-shadow: 0 12px 36px rgba(200,170,110,0.18), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .tag-widget-btn.open {
          border-color: rgba(200,170,110,0.45); color: #c8aa6e;
          background: linear-gradient(160deg, rgba(200,170,110,0.18), rgba(20,18,12,0.95));
          box-shadow: 0 12px 36px rgba(200,170,110,0.22), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .tag-widget-btn svg { transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .tag-widget-btn.open svg { transform: rotate(90deg) scale(0.92); }
        .tag-widget-btn .filter-dot {
          position: absolute; top: -3px; right: -3px; width: 9px; height: 9px;
          border-radius: 50%; background: #c8aa6e; border: 2px solid #0a0a0f;
          box-shadow: 0 0 8px rgba(200,170,110,0.8);
          animation: pulse 2s ease infinite;
        }

        .tag-widget-panel {
          position: absolute; left: 0; top: 56px;
          min-width: 195px; max-height: 70vh; overflow-y: auto; padding: 10px;
          border-radius: 16px; border: 1px solid rgba(255,255,255,0.09);
          background: linear-gradient(170deg, rgba(26,26,36,0.97), rgba(13,13,19,0.98));
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,170,110,0.06), inset 0 1px 0 rgba(255,255,255,0.05);
          display: flex; flex-direction: column; gap: 3px;
          opacity: 0; pointer-events: none;
          transform: translateY(-10px) scale(0.9);
          transform-origin: left top;
          transition: opacity 0.25s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tag-widget-panel.open {
          opacity: 1; pointer-events: auto;
          transform: translateY(0) scale(1);
        }

        .tag-widget-title {
          font-size: 9px; text-transform: uppercase; letter-spacing: 2px;
          color: #5a5a65; font-weight: 600; padding: 4px 11px 7px;
        }

        .tag-widget-item {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 8px 11px; border-radius: 10px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px;
          border: 1px solid transparent; background: transparent; color: #9a96a0;
          cursor: pointer; transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
          text-align: left; -webkit-tap-highlight-color: transparent;
        }
        .tag-widget-item:hover { background: rgba(255,255,255,0.05); color: #d8d4ce; }
        .tag-widget-item .pill-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
        }
        .tag-widget-item:hover .pill-dot { transform: scale(1.45); }
        .tag-widget-item .tag-count {
          margin-left: auto; font-size: 10px; font-weight: 600; color: #5a5a65;
          background: rgba(255,255,255,0.05); border-radius: 8px; padding: 1px 7px;
        }
        .tag-widget-panel.open .tag-widget-item {
          animation: tagItemIn 0.45s cubic-bezier(0.22, 1.2, 0.36, 1) both;
          animation-delay: calc(var(--i) * 0.05s);
        }
        @keyframes tagItemIn {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.45s ease forwards; }
        .fade-up-d1 { animation: fadeUp 0.45s ease 0.08s forwards; opacity: 0; }
      `}</style>

      {/* ─── HEADER ─── */}
      <header style={{
        padding: mobile ? "12px 16px" : "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: mobile ? 10 : 14, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #c8aa6e, #8a7340)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#0a0a0f",
          }}>N</div>
          {!mobile && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 500, letterSpacing: "-0.3px", color: "#e8e6e1" }}>Notecraft</span>}
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {(["today", "weekly", "monthly", "categories"] as const).map(id => (
            <div
              key={id}
              className={`nav-pill ${view === id ? "active" : ""}`}
              onClick={() => { setView(id); if (id === "today") { setCurrentDate(new Date()); loadDate(today); } }}
            >{id === "today" ? "Today" : id === "weekly" ? "Week" : id === "monthly" ? "Month" : "Tags"}</div>
          ))}
        </nav>
        <button
          className="search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Search notes"
          title="Search notes (⌘K)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {!mobile && <span>Search</span>}
          {!mobile && <span className="kbd-hint">⌘K</span>}
        </button>
        {user && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setAccountOpen(o => !o)}
              aria-label="Account"
              title={user.name ?? "Account"}
              style={{
                width: 32, height: 32, borderRadius: "50%", padding: 0,
                border: "1px solid rgba(200,170,110,0.3)", cursor: "pointer",
                background: "rgba(200,170,110,0.1)", color: "#c8aa6e",
                fontSize: 13, fontWeight: 600, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {user.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.image} alt="" width={32} height={32} style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />
                : (user.name?.[0]?.toUpperCase() ?? "?")}
            </button>
            {accountOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 110 }} onClick={() => setAccountOpen(false)} />
                <div style={{
                  position: "absolute", right: 0, top: 40, zIndex: 111, minWidth: 170,
                  background: "linear-gradient(170deg, rgba(26,26,36,0.98), rgba(13,13,19,0.99))",
                  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
                  boxShadow: "0 18px 44px rgba(0,0,0,0.6)", padding: 8,
                }}>
                  <div style={{ fontSize: 12, color: "#b8b4ae", padding: "6px 10px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.name ?? "Signed in"}
                  </div>
                  <button
                    onClick={() => signOut()}
                    style={{
                      display: "block", width: "100%", textAlign: "left", marginTop: 4,
                      background: "none", border: "none", color: "#d47070", cursor: "pointer",
                      fontSize: 12, padding: "7px 10px", borderRadius: 8, fontFamily: "'DM Sans'",
                    }}
                  >Sign out</button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* ─── MAIN ─── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: `0 ${px}` }}>

        {/* ══════ TODAY VIEW ══════ */}
        {view === "today" && (
          <div className="fade-up" style={{ padding: mobile ? "28px 0" : "44px 0 32px" }}>

            {/* Date heading */}
            <div style={{ maxWidth: 680, margin: "0 auto", marginBottom: mobile ? 24 : 32 }}>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "2px", color: "#c8aa6e", marginBottom: 10 }}>
                {DAYS_FULL[today.getDay()]}
              </p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: mobile ? 36 : 56, fontWeight: 400, lineHeight: 1.1, color: "#e8e6e1", letterSpacing: "-0.5px" }}>
                {MONTHS[today.getMonth()]} {ordinal(today.getDate())}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "#4a4a55", fontWeight: 300 }}>{today.getFullYear()}</span>
                {getEntries(today).length > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(200,170,110,0.1)", color: "#c8aa6e", fontWeight: 500 }}>
                    {getEntries(today).length} {getEntries(today).length === 1 ? "entry" : "entries"}
                  </span>
                )}
              </div>
            </div>

            {/* Input + entries */}
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <div className="fade-up-d1" style={{ marginBottom: 16 }}>
                <QuickInput
                  onSubmit={(text, catId) => addEntry(today, text, catId)}
                  mobile={mobile}
                  placeholder="What's on your mind? Press Enter to save..."
                  categories={categories}
                  onAddCategory={handleAddCategory}
                />
                <div style={{ fontSize: 10, color: "#2a2a35", marginTop: 6, textAlign: "center" }}>
                  Press Enter to save · Shift+Enter for new line · ⌘K to search
                </div>
              </div>

              {entries[dk(today)] === undefined && loadingDates.has(dk(today)) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <div className="skeleton" style={{ height: 64 }} />
                  <div className="skeleton" style={{ height: 64, opacity: 0.6 }} />
                </div>
              )}

              {getEntries(today).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {[...getEntries(today)].reverse().map(entry => (
                    <SavedEntry
                      key={entry.id}
                      entry={entry}
                      onUpdate={(id, t, catId) => updateEntry(today, id, t, catId)}
                      onDelete={(id) => deleteEntry(today, id)}
                      mobile={mobile}
                      noConfirm
                      categories={categories}
                      onAddCategory={handleAddCategory}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ WEEKLY VIEW ══════ */}
        {view === "weekly" && (
          <div className="fade-up" style={{ padding: "20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="arrow-btn" onClick={navPrev}>&#8249;</button>
                <button className="arrow-btn" onClick={navNext}>&#8250;</button>
                <button className="today-btn" onClick={goToday}>Today</button>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mobile ? 16 : 22, fontWeight: 400, color: "#e8e6e1" }}>
                {mobile
                  ? `${MONTHS_SHORT[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[0].getMonth() !== weekDates[6].getMonth() ? MONTHS_SHORT[weekDates[6].getMonth()] + " " : ""}${weekDates[6].getDate()}`
                  : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[0].getMonth() !== weekDates[6].getMonth() ? MONTHS[weekDates[6].getMonth()] + " " : ""}${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`
                }
              </h2>
              <button
                className="ai-btn"
                onClick={() => setSummaryReq({
                  type: "weekly",
                  from: dk(weekDates[0]),
                  to: dk(weekDates[6]),
                  label: `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[0].getMonth() !== weekDates[6].getMonth() ? MONTHS[weekDates[6].getMonth()] + " " : ""}${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`,
                })}
                title="AI recap of this week"
              >✨ Recap</button>
            </div>

            {mobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {renderTagWidget()}
                {weekDates.map((d, i) => {
                  const isToday = isSameDay(d, today);
                  const dayEntries = getFilteredEntries(d);
                  const isExpanded = expandedWeekDay === i || (expandedWeekDay === null && isToday);
                  return (
                    <div key={i} className={`week-day-card ${isExpanded ? "expanded" : ""} ${isToday ? "is-today" : ""}`}>
                      <div className="week-card-header" onClick={() => setExpandedWeekDay(isExpanded ? -1 : i)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: isToday ? "rgba(200,170,110,0.12)" : "rgba(255,255,255,0.03)",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", color: isToday ? "#c8aa6e" : "#5a5a65", fontWeight: 600 }}>{DAYS_SHORT[d.getDay()]}</span>
                            <span style={{ fontSize: 16, fontWeight: isToday ? 600 : 400, color: isToday ? "#c8aa6e" : "#8a8690", fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{d.getDate()}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: isToday ? "#c8aa6e" : "#a8a4a0" }}>
                              {DAYS_FULL[d.getDay()]}
                              {isToday && <span style={{ marginLeft: 8, fontSize: 9, padding: "2px 6px", background: "rgba(200,170,110,0.15)", borderRadius: 4, color: "#c8aa6e", verticalAlign: "middle", fontWeight: 600 }}>TODAY</span>}
                            </div>
                            {dayEntries.length > 0 && !isExpanded && (
                              <div style={{ fontSize: 11, color: "#5a5a65", marginTop: 2 }}>
                                {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {dayEntries.length > 0 && (
                            <span style={{ fontSize: 10, color: "#c8aa6e", background: "rgba(200,170,110,0.1)", padding: "2px 7px", borderRadius: 8, fontWeight: 600 }}>{dayEntries.length}</span>
                          )}
                          <span style={{ fontSize: 14, color: "#4a4a55", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>&#8250;</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <QuickInput onSubmit={(text, catId) => addEntry(d, text, catId)} mobile={true} placeholder="Type and press Enter..." categories={categories} onAddCategory={handleAddCategory} />
                          {renderCopyBar(d, dayEntries)}
                          {[...dayEntries].reverse().map(entry => (
                            <div
                              key={entry.id}
                              onClick={() => setModalEntry({ entry, date: d })}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 12px", cursor: "pointer",
                                background: "rgba(255,255,255,0.015)",
                                border: "1px solid rgba(255,255,255,0.05)",
                                borderRadius: 10, transition: "all 0.18s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,170,110,0.06)"; e.currentTarget.style.borderColor = "rgba(200,170,110,0.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.015)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                            >
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: entry.category ? `linear-gradient(135deg,${entry.category.color},${entry.category.color}99)` : "linear-gradient(135deg,#c8aa6e,#a08945)", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontSize: 10, color: "#c8aa6e", fontWeight: 500 }}>{entry.timeLabel}</span>
                                  {entry.category && (
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: `${entry.category.color}18`, border: `1px solid ${entry.category.color}28`, color: entry.category.color, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                                      {entry.category.name}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: "#b8b4ae", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text.split("\n")[0]}</div>
                              </div>
                              <span style={{ fontSize: 12, color: "#3a3a45", flexShrink: 0 }}>›</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {renderTagWidget()}
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {weekDates.map((d, i) => {
                    const isToday = isSameDay(d, today);
                    const count = getFilteredEntries(d).length;
                    const isCopied = copied?.dateKey === dk(d) && copied?.catId === null;
                    return (
                      <div
                        key={i}
                        className={`week-grid-col week-header-cell${isCopied ? " copied" : ""}`}
                        style={{ padding: "14px 8px", textAlign: "center", alignItems: "center" }}
                        onClick={() => count > 0 && copyEntries(d, getFilteredEntries(d), null)}
                        title={count > 0 ? `Copy ${count} ${count === 1 ? "entry" : "entries"}` : undefined}
                      >
                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1px", color: isToday ? "#c8aa6e" : "#5a5a65", fontWeight: 500, marginBottom: 3 }}>{DAYS_SHORT[i]}</div>
                        <div style={{ fontSize: tablet ? 18 : 22, fontWeight: isToday ? 600 : 300, color: isToday ? "#c8aa6e" : "#8a8690", fontFamily: "'Playfair Display', serif" }}>{d.getDate()}</div>
                        {isCopied
                          ? <div style={{ fontSize: 9, color: "#c8aa6e", marginTop: 4, background: "rgba(200,170,110,0.15)", padding: "1px 8px", borderRadius: 8, fontWeight: 600, display: "inline-block" }}>✓</div>
                          : count > 0 && <div style={{ fontSize: 9, color: "#c8aa6e", marginTop: 4, background: "rgba(200,170,110,0.1)", padding: "1px 6px", borderRadius: 8, fontWeight: 600, display: "inline-block" }}>{count}</div>
                        }
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", minHeight: 380 }}>
                  {weekDates.map((d, i) => {
                    const dayEntries = getFilteredEntries(d);
                    return (
                      <div key={i} className="week-grid-col" style={{ padding: "6px 0", overflow: "auto" }}>
                        {entries[dk(d)] === undefined && rangeLoading && (
                          <>
                            <div className="skeleton" style={{ height: 20, margin: "2px 3px" }} />
                            <div className="skeleton" style={{ height: 20, margin: "2px 3px", opacity: 0.6 }} />
                          </>
                        )}
                        {dayEntries.map(entry => (
                          <div
                            key={entry.id}
                            className="week-grid-chip"
                            style={{ borderLeftColor: entry.category ? entry.category.color : "#c8aa6e" }}
                            title={entry.text}
                            onClick={() => setModalEntry({ entry, date: d })}
                          >
                            <span style={{ fontWeight: 600, marginRight: 4 }}>{entry.timeLabel}</span>
                            {entry.text.split("\n")[0].slice(0, 18)}
                          </div>
                        ))}
                        <CompactInput onSubmit={(text) => addEntry(d, text, null)} />
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ MONTHLY VIEW ══════ */}
        {view === "monthly" && (
          <div className="fade-up" style={{ padding: "20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="arrow-btn" onClick={navPrev}>&#8249;</button>
                <button className="arrow-btn" onClick={navNext}>&#8250;</button>
                <button className="today-btn" onClick={goToday}>Today</button>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mobile ? 18 : 26, fontWeight: 400, color: "#e8e6e1" }}>
                {mobile ? `${MONTHS_SHORT[currentDate.getMonth()]} ${currentDate.getFullYear()}` : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              </h2>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="ai-btn"
                  onClick={() => {
                    const y = currentDate.getFullYear();
                    const m = currentDate.getMonth();
                    const lastDay = new Date(y, m + 1, 0).getDate();
                    setSummaryReq({
                      type: "monthly",
                      from: `${y}-${String(m + 1).padStart(2, "0")}-01`,
                      to: `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
                      label: `${MONTHS[m]} ${y}`,
                    });
                  }}
                  title="AI review of this month"
                >✨ Review</button>
                <button
                  className="ai-btn"
                  onClick={() => {
                    const y = currentDate.getFullYear();
                    setSummaryReq({ type: "yearly", from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` });
                  }}
                  title="AI year-in-review"
                >✨ Year</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? 16 : 24 }}>
              <div style={{
                flex: mobile ? "none" : "0 0 420px",
                background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14, padding: mobile ? 12 : 20, alignSelf: "flex-start",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
                  {(mobile ? ["S", "M", "T", "W", "T", "F", "S"] : DAYS_SHORT).map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: mobile ? 10 : 11, textTransform: "uppercase", letterSpacing: "1px", color: "#5a5a65", fontWeight: 500, padding: "6px 0" }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {monthCells.map((cell, i) => {
                    const isToday = isSameDay(cell.date, today);
                    const isSelected = isSameDay(cell.date, selectedDate);
                    const hasEntries = getEntries(cell.date).length > 0;
                    return (
                      <div
                        key={i}
                        className={`month-cell ${!cell.current ? "other-month" : ""} ${isToday ? "today-cell" : ""} ${isSelected ? "selected-cell" : ""} ${hasEntries ? "has-entries" : ""}`}
                        onClick={() => setSelectedDate(new Date(cell.date))}
                      >
                        <span style={{ fontSize: mobile ? 12 : 14, fontWeight: isToday ? 600 : 400, color: isToday ? "#c8aa6e" : isSelected ? "#e8e6e1" : "#8a8690" }}>{cell.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{
                flex: 1, background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
                padding: mobile ? "20px 16px" : "24px 28px",
                display: "flex", flexDirection: "column", minHeight: mobile ? 240 : 380,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "#c8aa6e", fontWeight: 500, marginBottom: 4 }}>{DAYS_FULL[selectedDate.getDay()]}</p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: mobile ? 22 : 28, fontWeight: 400, color: "#e8e6e1" }}>
                      {MONTHS[selectedDate.getMonth()]} {ordinal(selectedDate.getDate())}
                    </h3>
                    <p style={{ fontSize: 11, color: "#4a4a55", marginTop: 3 }}>{selectedDate.getFullYear()}</p>
                  </div>
                  {getEntries(selectedDate).length > 0 && (
                    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: "rgba(200,170,110,0.1)", color: "#c8aa6e", fontWeight: 600, marginTop: 4 }}>
                      {getEntries(selectedDate).length}
                    </span>
                  )}
                </div>

                <div style={{ height: 1, background: "linear-gradient(90deg, rgba(200,170,110,0.2), transparent)", marginBottom: 12 }} />

                <QuickInput
                  onSubmit={(text, catId) => addEntry(selectedDate, text, catId)}
                  mobile={mobile}
                  placeholder={`Add entry for ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}...`}
                  categories={categories}
                  onAddCategory={handleAddCategory}
                />

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", marginTop: 12 }}>
                  {entries[dk(selectedDate)] === undefined && rangeLoading && (
                    <>
                      <div className="skeleton" style={{ height: 56 }} />
                      <div className="skeleton" style={{ height: 56, opacity: 0.6 }} />
                    </>
                  )}
                  {[...getEntries(selectedDate)].reverse().map(entry => (
                    <SavedEntry
                      key={entry.id}
                      entry={entry}
                      onUpdate={(id, t, catId) => updateEntry(selectedDate, id, t, catId)}
                      onDelete={(id) => deleteEntry(selectedDate, id)}
                      mobile={mobile}
                      categories={categories}
                      onAddCategory={handleAddCategory}
                    />
                  ))}
                </div>

                {getEntries(selectedDate).length === 0 && !(entries[dk(selectedDate)] === undefined && rangeLoading) && (
                  <div style={{ textAlign: "center", paddingTop: 20, fontSize: 12, color: "#2a2a35", fontStyle: "italic" }}>
                    No entries yet — type above to start
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* ══════ CATEGORIES VIEW ══════ */}
        {view === "categories" && (
          <div className="fade-up" style={{ padding: `0 ${mobile ? "0" : "0"}` }}>
            <CategoryManager
              categories={categories}
              onAdd={handleAddCategory}
              onDelete={handleDeleteCategory}
              mobile={mobile}
            />
          </div>
        )}
      </main>
      {mobile && <div style={{ height: 24 }} />}

      {summaryReq && (
        <SummaryModal
          request={summaryReq}
          onClose={() => setSummaryReq(null)}
        />
      )}

      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 300, maxWidth: "calc(100vw - 32px)",
          background: "linear-gradient(170deg, rgba(48,24,24,0.97), rgba(28,14,14,0.98))",
          border: "1px solid rgba(200,80,80,0.35)", borderRadius: 10,
          color: "#e0a8a8", padding: "10px 18px", fontSize: 12, fontWeight: 500,
          boxShadow: "0 12px 36px rgba(0,0,0,0.55)", animation: "fadeUp 0.3s ease",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {toast}
        </div>
      )}

      {modalEntry && (
        <NoteModal
          entry={modalEntry.entry}
          date={modalEntry.date}
          onDelete={(id) => deleteEntry(modalEntry.date, id)}
          onClose={() => setModalEntry(null)}
          categories={categories}
          onAddCategory={handleAddCategory}
          onUpdateCategory={async (id, catId) => {
            const updated = await updateEntryCategory(modalEntry.date, id, catId);
            if (updated) setModalEntry(prev => prev ? { ...prev, entry: updated } : null);
          }}
        />
      )}
    </div>
    </>
  );
}
