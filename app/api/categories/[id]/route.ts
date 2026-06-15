import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.category.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
