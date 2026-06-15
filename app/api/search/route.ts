import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedText, toVectorLiteral, storeEntryEmbedding } from "@/lib/embeddings";
import { sessionUserId } from "@/auth";

const TOP_K = 3;

// Entries created before semantic search shipped (or whose background
// embedding failed) have a NULL embedding — fill them in before querying.
async function backfillMissingEmbeddings() {
  const missing = await prisma.$queryRaw<{ id: string; text: string }[]>`
    SELECT "id", "text" FROM "Entry" WHERE "embedding" IS NULL LIMIT 500
  `;
  for (const row of missing) {
    await storeEntryEmbedding(row.id, row.text);
  }
}

// GET /api/search?q=...
export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q param required" }, { status: 400 });

  try {
    await backfillMissingEmbeddings();
    const queryVec = toVectorLiteral(await embedText(q));

    const hits = await prisma.$queryRaw<{ id: string; similarity: number }[]>`
      SELECT "id", 1 - ("embedding" <=> ${queryVec}::vector) AS similarity
      FROM "Entry"
      WHERE "embedding" IS NOT NULL AND "userId" = ${userId}
      ORDER BY "embedding" <=> ${queryVec}::vector
      LIMIT ${TOP_K}
    `;
    if (hits.length === 0) return NextResponse.json([]);

    const entries = await prisma.entry.findMany({
      where: { id: { in: hits.map(h => h.id) }, userId },
      include: { category: true },
    });
    const byId = new Map(entries.map(e => [e.id, e]));
    const results = hits
      .filter(h => byId.has(h.id))
      .map(h => {
        const e = byId.get(h.id)!;
        return { ...e, timestamp: Number(e.timestamp), similarity: h.similarity };
      });
    return NextResponse.json(results);
  } catch (err) {
    console.error("Search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
