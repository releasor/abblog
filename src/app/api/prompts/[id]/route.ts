import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const promptId = parseInt(id);
    if (isNaN(promptId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
    });

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    return NextResponse.json(prompt, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
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

    const { id } = await params;
    const promptId = parseInt(id);
    if (isNaN(promptId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const existing = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, category, tags, variables, isPinned } = body;

    const prompt = await prisma.prompt.update({
      where: { id: promptId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
        ...(variables !== undefined && { variables: variables ? JSON.stringify(variables) : null }),
        ...(isPinned !== undefined && { isPinned }),
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
    const promptId = parseInt(id);
    if (isNaN(promptId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const existing = await prisma.prompt.findFirst({
      where: { id: promptId, userId },
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
