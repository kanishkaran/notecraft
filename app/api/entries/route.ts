import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeEntryEmbedding } from "@/lib/embeddings";
import { sessionUserId } from "@/auth";

type CategoryRaw = { id: string; name: string; color: string; isDefault: boolean; createdAt: Date };
type EntryRaw = {
  id: string; date: string; text: string; timeLabel: string; timestamp: bigint;
  categoryId: string | null; category: CategoryRaw | null; createdAt: Date; updatedAt: Date;
};

function serializeEntry(e: EntryRaw) {
  return { ...e, timestamp: Number(e.timestamp) };
}

// GET /api/entries?date=YYYY-MM-DD
// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (from && to) {
    const entries = await prisma.entry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { category: true },
      orderBy: { timestamp: "asc" },
    });
    const grouped: Record<string, ReturnType<typeof serializeEntry>[]> = {};
    for (const e of entries) {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(serializeEntry(e));
    }
    return NextResponse.json(grouped);
  }

  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date param required" }, { status: 400 });
  const entries = await prisma.entry.findMany({
    where: { userId, date },
    include: { category: true },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(entries.map(serializeEntry));
}

// POST /api/entries
export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, text, timeLabel, timestamp, categoryId } = body;
  if (!date || !text || !timeLabel || timestamp == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const entry = await prisma.entry.create({
    data: { date, text, timeLabel, timestamp: BigInt(timestamp), categoryId: categoryId ?? null, userId },
    include: { category: true },
  });
  void storeEntryEmbedding(entry.id, entry.text);
  return NextResponse.json(serializeEntry(entry), { status: 201 });
}
