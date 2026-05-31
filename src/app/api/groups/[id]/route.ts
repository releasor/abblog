import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, username: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, username: true, avatar: true } } }, take: 100 },
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

    const rl = checkRateLimit(`group-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { ownerId: true } });
    if (!group || group.ownerId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { name, description, coverImage, isPublic } = body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "圈子名称不能为空" }, { status: 400 });
    }
    if (name !== undefined && name.trim().length > 50) {
      return NextResponse.json({ error: "圈子名称不能超过50个字符" }, { status: 400 });
    }
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim().slice(0, 500) || null }),
        ...(coverImage !== undefined && { coverImage: coverImage || null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
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
    let groupId: number;
    try { groupId = requireId(id); } catch { return invalidIdResponse(); }

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { ownerId: true } });
    if (!group || group.ownerId !== userId) return NextResponse.json({ error: "无权限" }, { status: 403 });

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Group] Failed to delete group:", e);
    return NextResponse.json({ error: "删除圈子失败" }, { status: 500 });
  }
}
