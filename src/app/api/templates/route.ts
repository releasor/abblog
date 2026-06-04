import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { MAX_PROMPT_CONTENT_LENGTH, CACHE_PRIVATE_MAX_AGE, CACHE_PRIVATE_STALE } from "@/lib/constants";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const templates = await prisma.postTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(templates, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE}, stale-while-revalidate=${CACHE_PRIVATE_STALE}` } });
  } catch (e) {
    console.error("[Templates] Failed to fetch templates:", e);
    return NextResponse.json({ error: "获取模板列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`template:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let name: string, description: string | undefined, content: string, category: string | undefined;
    try {
      const body = await request.json();
      name = body.name;
      description = body.description;
      content = body.content;
      category = body.category;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "请输入模板名称" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "模板名称不能超过100个字符" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请输入模板内容" }, { status: 400 });
    }
    if (content.length > MAX_PROMPT_CONTENT_LENGTH) {
      return NextResponse.json({ error: "模板内容过长" }, { status: 400 });
    }

    const template = await prisma.postTemplate.create({
      data: {
        userId,
        name: name.trim(),
        description: typeof description === "string" ? description.trim().slice(0, 500) || null : null,
        content: content.trim(),
        category: typeof category === "string" ? category.trim().slice(0, 50) || "通用" : "通用",
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (e) {
    console.error("[Templates] Failed to create template:", e);
    return NextResponse.json({ error: "创建模板失败" }, { status: 500 });
  }
}
