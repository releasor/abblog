import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, username: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, username: true, avatar: true } } } },
        _count: { select: { members: true, posts: true } },
      },
    });
    if (!group) return NextResponse.json({ error: "圈子不存在" }, { status: 404 });
    return NextResponse.json(
      { ...group, memberCount: group._count.members, postCount: group._count.posts },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("[Group] Failed to fetch group:", e);
    return NextResponse.json({ error: "获取圈子详情失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.ownerId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const body = await request.json();
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        coverImage: body.coverImage ?? undefined,
        isPublic: body.isPublic ?? undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[Group] Failed to update group:", e);
    return NextResponse.json({ error: "更新圈子失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: "无效ID" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.ownerId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Group] Failed to delete group:", e);
    return NextResponse.json({ error: "删除圈子失败" }, { status: 500 });
  }
}
