import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/auth";

// GET /api/entries/heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { "YYYY-MM-DD": count, ... }
export async function GET(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const grouped = await prisma.entry.groupBy({
    by: ["date"],
    where: { userId, date: { gte: from, lte: to } },
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  for (const g of grouped) result[g.date] = g._count.id;
  return NextResponse.json(result);
}
