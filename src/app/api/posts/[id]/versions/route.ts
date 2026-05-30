import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const versions = await prisma.postVersion.findMany({
      where: { postId },
      orderBy: { version: "desc" },
      select: { id: true, title: true, excerpt: true, version: true, createdAt: true },
    });

    return NextResponse.json({ versions }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Versions] Failed to fetch versions:", e);
    return NextResponse.json({ error: "获取版本历史失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { versionId } = body;
    if (!versionId) {
      return NextResponse.json({ error: "缺少版本ID" }, { status: 400 });
    }
    let versionIdNum: number;
    try { versionIdNum = requireId(versionId); } catch { return invalidIdResponse(); }

    const version = await prisma.postVersion.findUnique({ where: { id: versionIdNum } });
    if (!version || version.postId !== postId) return NextResponse.json({ error: "版本不存在" }, { status: 404 });

    await prisma.post.update({
      where: { id: postId },
      data: { title: version.title, content: version.content, excerpt: version.excerpt },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Versions] Failed to restore version:", e);
    return NextResponse.json({ error: "恢复版本失败" }, { status: 500 });
  }
}
