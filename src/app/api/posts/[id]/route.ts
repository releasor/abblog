import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { createActivity } from "@/lib/activity";
import { estimateReadingTime } from "@/lib/reading-time";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "无效ID" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        author: { select: { id: true, name: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    return NextResponse.json({
      ...post,
      tags: post.tags.map((pt) => pt.tag),
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("[Posts] Failed to fetch post:", e);
    return NextResponse.json({ error: "获取文章详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "无效ID" }, { status: 400 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImageUrl, categoryId, tags, status, isPinned, scheduledAt } = body;

  try {
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      include: { collaborators: { where: { userId, role: "EDITOR" }, select: { id: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    if (existing.authorId !== userId && existing.collaborators.length === 0) {
      return NextResponse.json({ error: "无权限编辑此文章" }, { status: 403 });
    }

    const slug = body.slug || (title ? slugify(title) : existing.slug);
    if (slug !== existing.slug) {
      const slugTaken = await prisma.post.findUnique({ where: { slug } });
      if (slugTaken) {
        return NextResponse.json({ error: "该标识已被其他文章使用" }, { status: 409 });
      }
    }

    const isPublished = status === "PUBLISHED";
    const wasPublished = existing.status === "PUBLISHED";

    // If transitioning to published for the first time, set publishedAt
    let publishedAt = existing.publishedAt;
    if (isPublished && !wasPublished) {
      publishedAt = new Date();
    }

    // If tags provided, replace all tags
    // Auto-save version before updating if content or title changed
    if ((content && content !== existing.content) || (title && title !== existing.title)) {
      const latestVersion = await prisma.postVersion.findFirst({
        where: { postId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;
      await prisma.postVersion.create({
        data: {
          postId,
          title: existing.title,
          content: existing.content,
          excerpt: existing.excerpt,
          version: nextVersion,
        },
      });
    }

    const tagUpdate = tags !== undefined
      ? {
          tags: {
            deleteMany: {},
            create: tags.map((tagId: string) => ({
              tag: { connect: { id: parseInt(tagId) } },
            })),
          },
        }
      : {};

    const updatedContent = content ?? existing.content;

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        title: title ?? existing.title,
        slug,
        content: updatedContent,
        excerpt: excerpt !== undefined ? excerpt || null : existing.excerpt,
        coverImageUrl: coverImageUrl !== undefined ? coverImageUrl || null : existing.coverImageUrl,
        status: isPublished ? "PUBLISHED" : "DRAFT",
        publishedAt,
        isPinned: isPinned !== undefined ? Boolean(isPinned) : existing.isPinned,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : existing.scheduledAt,
        readingTime: content ? estimateReadingTime(content) : existing.readingTime,
        categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : existing.categoryId,
        ...tagUpdate,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    // Create activity when post is first published
    if (isPublished && !wasPublished) {
      await createActivity(userId, "POST_PUBLISHED", postId, { title: post.title });
    }

    return NextResponse.json({
      ...post,
      tags: post.tags.map((pt) => pt.tag),
    });
  } catch (e) {
    console.error("[Posts] Failed to update post:", e);
    return NextResponse.json({ error: "更新文章失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "无效ID" }, { status: 400 });
  }

  try {
    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    if (existing.authorId !== userId && existing.userId !== userId) {
      return NextResponse.json({ error: "无权限删除此文章" }, { status: 403 });
    }

    await prisma.post.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Posts] Failed to delete post:", e);
    return NextResponse.json({ error: "删除文章失败" }, { status: 500 });
  }
}
