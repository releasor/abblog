import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { title, content, category, tags, variables } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
    }

    const prompt = await prisma.prompt.create({
      data: {
        userId,
        title,
        content,
        category: category || "通用",
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
