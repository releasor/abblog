import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 24;
  const type = searchParams.get("type"); // image | video

  const where: Record<string, unknown> = { userId: parseInt(userId) };
  if (type === "image") where.mimeType = { startsWith: "image/" };
  if (type === "video") where.mimeType = { startsWith: "video/" };

  const [files, total] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mediaFile.count({ where }),
  ]);

  return NextResponse.json({
    files,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (!file || file.userId !== parseInt(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete physical file
  try {
    const filepath = path.join(process.cwd(), "public", "uploads", file.filename);
    await unlink(filepath);
  } catch {
    // File may already be deleted
  }

  await prisma.mediaFile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
