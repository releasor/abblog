import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let templateId: number;
    try { templateId = requireId(id); } catch { return invalidIdResponse(); }

    const template = await prisma.postTemplate.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    return NextResponse.json(template, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Template] Failed to fetch template:", e);
    return NextResponse.json({ error: "获取模板详情失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`template-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let templateId: number;
    try { templateId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.postTemplate.findUnique({ where: { id: templateId }, select: { userId: true, category: true } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, description, content, category } = data;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "模板名称不能为空" }, { status: 400 });
    }
    if (name !== undefined && name.trim().length > 100) {
      return NextResponse.json({ error: "模板名称不能超过100个字符" }, { status: 400 });
    }
    if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
      return NextResponse.json({ error: "模板内容不能为空" }, { status: 400 });
    }
    if (content !== undefined && content.length > 50000) {
      return NextResponse.json({ error: "模板内容过长" }, { status: 400 });
    }

    const template = await prisma.postTemplate.update({
      where: { id: templateId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim().slice(0, 500) || null }),
        ...(content !== undefined && { content: content.trim() }),
        ...(category !== undefined && { category: typeof category === "string" ? category.trim().slice(0, 50) : existing.category }),
      },
    });

    return NextResponse.json(template);
  } catch (e) {
    console.error("[Template] Failed to update template:", e);
    return NextResponse.json({ error: "更新模板失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let templateId: number;
    try { templateId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.postTemplate.findUnique({ where: { id: templateId }, select: { userId: true } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    await prisma.postTemplate.delete({ where: { id: templateId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Template] Failed to delete template:", e);
    return NextResponse.json({ error: "删除模板失败" }, { status: 500 });
  }
}
