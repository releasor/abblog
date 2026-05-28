import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const { title, slug, content, excerpt, coverImageUrl, categoryId, tags, status } = body;

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "标题、slug和内容不能为空" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "slug 已存在" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      coverImageUrl: coverImageUrl || null,
      status: status || "DRAFT",
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      authorId: 1, // Default admin author for compatibility
      userId: parseInt(userId),
      categoryId: categoryId ? parseInt(categoryId) : null,
      ...(tags?.length > 0 && {
        tags: {
          create: tags.map((tagId: string) => ({
            tag: { connect: { id: parseInt(tagId) } },
          })),
        },
      }),
    },
  });

  return NextResponse.json(post, { status: 201 });
}
