import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      category: true,
      tags: { include: { tag: true } },
      author: { select: { id: true, name: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...post,
    tags: post.tags.map((pt) => pt.tag),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImageUrl, categoryId, tags, status, isPinned, scheduledAt } = body;

  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const slug = body.slug || (title ? slugify(title) : existing.slug);
  if (slug !== existing.slug) {
    const slugTaken = await prisma.post.findUnique({ where: { slug } });
    if (slugTaken) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
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
    await createActivity(parseInt(userId), "POST_PUBLISHED", postId, { title: post.title });
  }

  return NextResponse.json({
    ...post,
    tags: post.tags.map((pt) => pt.tag),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade delete: PostTag and Comment have onDelete: Cascade in schema
  await prisma.post.delete({ where: { id: postId } });

  return NextResponse.json({ success: true });
}
