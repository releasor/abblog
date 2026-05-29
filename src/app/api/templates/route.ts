import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const templates = await prisma.postTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(templates, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
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

    const { name, description, content, category } = await request.json();
    if (!name || !content) return NextResponse.json({ error: "请输入模板名称和内容" }, { status: 400 });

    const template = await prisma.postTemplate.create({
      data: {
        userId,
        name,
        description,
        content,
        category: category || "通用",
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (e) {
    console.error("[Templates] Failed to create template:", e);
    return NextResponse.json({ error: "创建模板失败" }, { status: 500 });
  }
}
