import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH, MAX_SLUG_LENGTH } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`post:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { title, slug, content, excerpt, coverImageUrl, categoryId, tags, status } = body;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: "标题、slug和内容不能为空" }, { status: 400 });
    }
    if (typeof title !== "string" || title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `标题不能超过${MAX_TITLE_LENGTH}个字符` }, { status: 400 });
    }
    if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: "内容过长" }, { status: 400 });
    }
    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug) || slug.length > MAX_SLUG_LENGTH) {
      return NextResponse.json({ error: "slug 格式无效，只能包含小写字母、数字和连字符" }, { status: 400 });
    }
    if (categoryId && isNaN(parseInt(categoryId, 10))) {
      return NextResponse.json({ error: "无效的分类ID" }, { status: 400 });
    }
    if (tags && (!Array.isArray(tags) || tags.some((t: string) => isNaN(parseInt(t, 10))))) {
      return NextResponse.json({ error: "无效的标签ID" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
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

    try {
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
          categoryId: categoryId ? parseInt(categoryId, 10) : null,
          ...(tags?.length > 0 && {
            tags: {
              create: tags.map((tagId: string) => ({
                tag: { connect: { id: parseInt(tagId, 10) } },
              })),
            },
          }),
        },
      });
      return NextResponse.json(post, { status: 201 });
    } catch (createErr: unknown) {
      if ((createErr as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "slug 已存在" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (e) {
    console.error("[UserPosts] Failed to create post:", e);
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
