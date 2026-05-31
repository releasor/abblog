import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { userId };
    if (category && category !== "全部") {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const prompts = await prisma.prompt.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(prompts, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[Prompts] Failed to fetch prompts:", e);
    return NextResponse.json({ error: "获取Prompt列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`prompt:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { title, content, category, tags, variables } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    if (title.trim().length > 200) {
      return NextResponse.json({ error: "标题不能超过200个字符" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    if (content.length > 50000) {
      return NextResponse.json({ error: "内容过长" }, { status: 400 });
    }

    const prompt = await prisma.prompt.create({
      data: {
        userId,
        title: title.trim(),
        content: content.trim(),
        category: typeof category === "string" ? category.trim().slice(0, 50) || "通用" : "通用",
        tags: tags ? JSON.stringify(tags) : null,
        variables: variables ? JSON.stringify(variables) : null,
      },
    });

    return NextResponse.json(prompt);
  } catch (e) {
    console.error("[Prompts] Failed to create prompt:", e);
    return NextResponse.json({ error: "创建Prompt失败" }, { status: 500 });
  }
}
