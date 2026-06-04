import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { CACHE_PUBLIC_S_MAXAGE_MEDIUM, CACHE_PUBLIC_STALE_MEDIUM, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from "@/lib/constants";
import { createActivity } from "@/lib/activity";
import { estimateReadingTime } from "@/lib/reading-time";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let postId: number;
  try { postId = requireId(id); } catch { return invalidIdResponse(); }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
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
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_MEDIUM}, stale-while-revalidate=${CACHE_PUBLIC_STALE_MEDIUM}` },
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
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`post-edit:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { title, content, excerpt, coverImageUrl, categoryId, tags, status, isPinned, scheduledAt } = body;

    if (title !== undefined && (typeof title !== "string" || title.length > MAX_TITLE_LENGTH)) {
      return NextResponse.json({ error: `标题不能超过${MAX_TITLE_LENGTH}个字符` }, { status: 400 });
    }
    if (content !== undefined && (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH)) {
      return NextResponse.json({ error: "内容过长" }, { status: 400 });
    }
    if (categoryId && isNaN(parseInt(categoryId, 10))) {
      return NextResponse.json({ error: "无效的分类ID" }, { status: 400 });
    }
    if (tags && (!Array.isArray(tags) || tags.some((t: string) => isNaN(parseInt(t, 10))))) {
      return NextResponse.json({ error: "无效的标签ID" }, { status: 400 });
    }

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
      const slugTaken = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
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
              tag: { connect: { id: parseInt(tagId, 10) } },
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
        categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId, 10) : null) : existing.categoryId,
        ...tagUpdate,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
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
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const existing = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, userId: true } });
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
