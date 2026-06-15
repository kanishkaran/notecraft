import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
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

// PATCH /api/entries/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { text, categoryId } = body;
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const owned = await prisma.entry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const data: Record<string, unknown> = { text };
  if (categoryId !== undefined) data.categoryId = categoryId;

  try {
    const entry = await prisma.entry.update({
      where: { id },
      data,
      include: { category: true },
    });
    void storeEntryEmbedding(entry.id, entry.text);
    return NextResponse.json(serializeEntry(entry));
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    throw err;
  }
}

// DELETE /api/entries/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.entry.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
