import { ChatGroq } from "@langchain/groq";
import { StateGraph, Annotation, Send, START, END } from "@langchain/langgraph";
import type { AIMessageChunk } from "@langchain/core/messages";

export type SummaryType = "weekly" | "monthly" | "yearly";

export type SummaryEntry = {
  date: string;
  text: string;
  timeLabel: string;
  category: { name: string } | null;
};

// Override via env to use any Groq-hosted model
const FAST_MODEL = process.env.SUMMARY_FAST_MODEL ?? "openai/gpt-oss-20b";
const QUALITY_MODEL = process.env.SUMMARY_MODEL ?? "openai/gpt-oss-120b";

function makeModel(model: string, maxTokens: number, temperature: number): ChatGroq {
  return new ChatGroq({ model, apiKey: process.env.GROQ_API_KEY, maxTokens, temperature });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function weekday(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

function formatEntries(entries: SummaryEntry[], maxCharsPerEntry = 800): string {
  return entries
    .map(e => {
      const tag = e.category ? ` [${e.category.name}]` : "";
      const text = e.text.length > maxCharsPerEntry ? e.text.slice(0, maxCharsPerEntry) + "…" : e.text;
      return `${e.date} (${weekday(e.date)}) ${e.timeLabel}${tag}: ${text.replaceAll("\n", " / ")}`;
    })
    .join("\n");
}

export function buildStats(entries: SummaryEntry[]): string {
  const days = new Set(entries.map(e => e.date));
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    const name = e.category?.name ?? "Untagged";
    byCategory[name] = (byCategory[name] ?? 0) + 1;
  }
  const cats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name}: ${n}`)
    .join(", ");
  return `${entries.length} entries across ${days.size} active days. By tag — ${cats}.`;
}

const STYLE_RULES = `Rules:
- Be precise: reference what the entries actually say, never invent or pad.
- Be growth-focused: surface progress, momentum, recurring blockers, and concrete next steps.
- No filler, no praise for its own sake, no restating the rules.
- Use markdown: "## " section headers and "- " bullets. Bold key phrases sparingly.`;

const PROMPTS: Record<SummaryType, string> = {
  weekly: `You write a precise, growth-focused weekly recap of a personal work journal.

${STYLE_RULES}

Sections (omit any with nothing real to say):
## Highlights — 2-4 bullets, the things that mattered most
## Wins & progress — what moved forward, finished, or improved
## Patterns — recurring themes, blockers, or time sinks worth noticing
## Next week — 2-3 specific, actionable focus points derived from the entries`,

  monthly: `You write a precise, growth-focused monthly review of a personal work journal.

${STYLE_RULES}

Sections (omit any with nothing real to say):
## Overview — 2-3 sentences on the shape of the month
## Key accomplishments — concrete outcomes, grouped by theme or tag
## Growth & trends — how the month progressed week to week; skills or areas that visibly developed
## Worth improving — honest, specific friction points or neglected areas
## Next month — 2-3 focus points that follow from the above`,

  yearly: `You write a precise, growth-focused year-in-review from monthly summaries of a personal work journal.

${STYLE_RULES}

Sections:
## The year in brief — 3-4 sentences capturing the arc of the year
## Quarter by quarter — one short paragraph per quarter showing how focus and momentum shifted
## Biggest themes — the 3-5 threads that defined the year
## Growth trajectory — skills, scope, and habits that measurably changed from start to end
## Carry forward — what to keep doing, stop doing, and start doing next year`,
};

function chunkText(chunk: AIMessageChunk): string {
  return typeof chunk.content === "string"
    ? chunk.content
    : chunk.content.map(c => (c.type === "text" ? c.text : "")).join("");
}

async function* streamModel(model: ChatGroq, system: string, user: string): AsyncGenerator<string> {
  const stream = await model.stream([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  for await (const chunk of stream) {
    const text = chunkText(chunk);
    if (text) yield text;
  }
}

export function streamRangeSummary(
  type: "weekly" | "monthly",
  label: string,
  entries: SummaryEntry[],
): AsyncGenerator<string> {
  const model = makeModel(QUALITY_MODEL, 1500, 0.3);
  const user = `Period: ${label}\nStats: ${buildStats(entries)}\n\nJournal entries:\n${formatEntries(entries)}`;
  return streamModel(model, PROMPTS[type], user);
}

// ── Yearly review: LangGraph map-reduce ──
// Each month is summarized in parallel with the fast model, then a reducer
// node writes the final report from those summaries plus year-level stats.

type MonthData = { month: number; entries: SummaryEntry[] };

const YearState = Annotation.Root({
  year: Annotation<number>,
  months: Annotation<MonthData[]>,
  stats: Annotation<string>,
  monthSummaries: Annotation<{ month: number; summary: string }[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});

const MonthStep = Annotation.Root({
  year: Annotation<number>,
  month: Annotation<MonthData>,
});

const MONTH_PROMPT = `Condense one month of personal work-journal entries into a factual digest for a later year-in-review.
Output 4-8 plain bullets: main accomplishments, themes, and any notable blockers. No headers, no intro, no invention.`;

async function summarizeMonth(state: typeof MonthStep.State) {
  const model = makeModel(FAST_MODEL, 500, 0);
  const { month, entries } = state.month;
  const user = `${MONTH_NAMES[month]} ${state.year} — ${buildStats(entries)}\n\n${formatEntries(entries, 400)}`;
  const res = await model.invoke([
    { role: "system", content: MONTH_PROMPT },
    { role: "user", content: user },
  ]);
  return { monthSummaries: [{ month, summary: chunkText(res as AIMessageChunk) }] };
}

const yearGraph = new StateGraph(YearState)
  .addNode("summarizeMonth", summarizeMonth)
  .addNode("collect", async () => ({}))
  .addConditionalEdges(START, (s: typeof YearState.State) =>
    s.months.map(m => new Send("summarizeMonth", { year: s.year, month: m })),
  )
  .addEdge("summarizeMonth", "collect")
  .addEdge("collect", END)
  .compile();

export async function* streamYearlySummary(year: number, entries: SummaryEntry[]): AsyncGenerator<string> {
  const byMonth = new Map<number, SummaryEntry[]>();
  for (const e of entries) {
    const m = Number(e.date.split("-")[1]) - 1;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(e);
  }
  const months: MonthData[] = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, monthEntries]) => ({ month, entries: monthEntries }));

  const stats = buildStats(entries);
  const result = await yearGraph.invoke({ year, months, stats });

  const digest = result.monthSummaries
    .sort((a, b) => a.month - b.month)
    .map(s => `### ${MONTH_NAMES[s.month]}\n${s.summary}`)
    .join("\n\n");

  const model = makeModel(QUALITY_MODEL, 2500, 0.3);
  const user = `Year: ${year}\nStats: ${stats}\nActive months: ${months.length}\n\nMonthly digests:\n${digest}`;
  yield* streamModel(model, PROMPTS.yearly, user);
}
