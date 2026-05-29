import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 24;
    const type = searchParams.get("type"); // image | video

    const where: Record<string, unknown> = { userId };
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
    }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[MediaManage] Failed to fetch media:", e);
    return NextResponse.json({ error: "获取媒体文件失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await request.json();
    const file = await prisma.mediaFile.findUnique({ where: { id } });
    if (!file || file.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    // Delete physical file
    try {
      const filepath = path.join(process.cwd(), "public", "uploads", file.filename);
      await unlink(filepath);
    } catch (e) {
      // File may already be deleted
      console.warn("[MediaManage] Physical file deletion skipped:", e);
    }

    await prisma.mediaFile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[MediaManage] Failed to delete media:", e);
    return NextResponse.json({ error: "删除媒体文件失败" }, { status: 500 });
  }
}
