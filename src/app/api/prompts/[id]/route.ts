import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { MAX_TITLE_LENGTH, MAX_PROMPT_CONTENT_LENGTH, CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let promptId: number;
    try { promptId = requireId(id); } catch { return invalidIdResponse(); }

    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
    });

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    return NextResponse.json(prompt, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
  } catch (e) {
    console.error("[Prompt] Failed to fetch prompt:", e);
    return NextResponse.json({ error: "获取Prompt详情失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`prompt-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let promptId: number;
    try { promptId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
      select: { category: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { title, content, category, tags, variables, isPinned } = body;

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    if (title !== undefined && title.trim().length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `标题不能超过${MAX_TITLE_LENGTH}个字符` }, { status: 400 });
    }
    if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    if (content !== undefined && content.length > MAX_PROMPT_CONTENT_LENGTH) {
      return NextResponse.json({ error: "内容过长" }, { status: 400 });
    }

    const prompt = await prisma.prompt.update({
      where: { id: promptId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(category !== undefined && { category: typeof category === "string" ? category.trim().slice(0, 50) : existing.category }),
        ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
        ...(variables !== undefined && { variables: variables ? JSON.stringify(variables) : null }),
        ...(isPinned !== undefined && { isPinned: Boolean(isPinned) }),
      },
    });

    return NextResponse.json(prompt);
  } catch (e) {
    console.error("[Prompt] Failed to update prompt:", e);
    return NextResponse.json({ error: "更新Prompt失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let promptId: number;
    try { promptId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    await prisma.prompt.delete({ where: { id: promptId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Prompt] Failed to delete prompt:", e);
    return NextResponse.json({ error: "删除Prompt失败" }, { status: 500 });
  }
}
