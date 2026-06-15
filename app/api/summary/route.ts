import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamRangeSummary, streamYearlySummary } from "@/lib/summary";
import type { SummaryType, SummaryEntry } from "@/lib/summary";
import { sessionUserId } from "@/auth";

export const maxDuration = 300;

// POST /api/summary  { type: "weekly" | "monthly" | "yearly", from, to, label }
export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, from, to, label } = body as { type: SummaryType; from: string; to: string; label: string };
  if (!["weekly", "monthly", "yearly"].includes(type) || !from || !to) {
    return NextResponse.json({ error: "type, from, to required" }, { status: 400 });
  }

  const entries: SummaryEntry[] = await prisma.entry.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: { date: true, text: true, timeLabel: true, category: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { timestamp: "asc" }],
  });

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "no_entries", message: "No entries in this period — nothing to summarize yet." },
      { status: 404 },
    );
  }

  const generator = type === "yearly"
    ? streamYearlySummary(Number(from.slice(0, 4)), entries)
    : streamRangeSummary(type, label ?? `${from} – ${to}`, entries);

  // Pull the first chunk before committing to a 200, so credential and model
  // errors (missing ~/.aws, Bedrock model not enabled, …) become readable JSON
  let first: IteratorResult<string>;
  try {
    first = await generator[Symbol.asyncIterator]().next();
  } catch (err) {
    console.error("Summary generation failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "bedrock_failed", message: `Couldn't reach AWS Bedrock — check your local AWS credentials and model access. (${detail})` },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of generator) {
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        console.error("Summary generation failed:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
