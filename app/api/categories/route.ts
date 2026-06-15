import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/auth";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, color } = await req.json();
  if (!name?.trim() || !color) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    const category = await prisma.category.create({ data: { name: name.trim(), color, userId } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
  }
}
