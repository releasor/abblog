import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

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

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const existing = await prisma.postTemplate.findUnique({ where: { id: templateId } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const data = await request.json();
    const template = await prisma.postTemplate.update({
      where: { id: templateId },
      data: {
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        content: data.content ?? existing.content,
        category: data.category ?? existing.category,
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
    const templateId = parseInt(id);
    if (isNaN(templateId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const existing = await prisma.postTemplate.findUnique({ where: { id: templateId } });
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
