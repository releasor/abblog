import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

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

    // Find or create default admin user for authorId
    let adminUser = await prisma.adminUser.findFirst();
    if (!adminUser) {
      adminUser = await prisma.adminUser.create({
        data: { email: "admin@system.local", passwordHash: "system", name: "System" },
      });
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
        authorId: adminUser.id,
        userId,
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
  } catch (e) {
    console.error("[UserPosts] Failed to create post:", e);
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
