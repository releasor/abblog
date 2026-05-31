import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { unlink } from "fs/promises";
import path from "path";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 24 });
    const type = searchParams.get("type"); // image | video

    const where: Record<string, unknown> = { userId };
    if (type === "image") where.mimeType = { startsWith: "image/" };
    if (type === "video") where.mimeType = { startsWith: "video/" };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.mediaFile.count({ where }),
    ]);

    return NextResponse.json({
      files,
      pagination: paginationMeta(page, limit, total),
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

    const rl = checkRateLimit(`media-delete:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let id: string;
    try {
      const body = await request.json();
      id = body.id;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "缺少文件ID" }, { status: 400 });
    let fileId: number;
    try { fileId = requireId(id); } catch { return invalidIdResponse(); }

    const file = await prisma.mediaFile.findUnique({ where: { id: fileId } });
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

    await prisma.mediaFile.delete({ where: { id: fileId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[MediaManage] Failed to delete media:", e);
    return NextResponse.json({ error: "删除媒体文件失败" }, { status: 500 });
  }
}
