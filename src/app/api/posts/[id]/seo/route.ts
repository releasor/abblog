import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, content: true, excerpt: true, slug: true, coverImageUrl: true, tags: { include: { tag: true } } },
    });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    // Calculate SEO score
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Title length check
    if (post.title.length >= 10 && post.title.length <= 60) {
      score += 20;
    } else if (post.title.length < 10) {
      issues.push("标题太短 (建议10-60字符)");
      score += 5;
    } else {
      issues.push("标题太长 (建议10-60字符)");
      score += 10;
    }

    // Excerpt check
    if (post.excerpt && post.excerpt.length >= 50 && post.excerpt.length <= 160) {
      score += 20;
    } else if (!post.excerpt) {
      issues.push("缺少摘要");
      suggestions.push("添加50-160字符的摘要，有助于搜索引擎展示");
    } else {
      score += 10;
      suggestions.push("摘要长度建议在50-160字符之间");
    }

    // Content length check
    const contentText = post.content.replace(/<[^>]*>/g, "");
    if (contentText.length >= 300) {
      score += 20;
    } else {
      issues.push("内容太短 (建议至少300字)");
      score += 5;
    }

    // Cover image check
    if (post.coverImageUrl) {
      score += 15;
    } else {
      suggestions.push("添加封面图有助于社交分享");
    }

    // Tags check
    if (post.tags.length > 0) {
      score += 15;
      if (post.tags.length < 3) {
        suggestions.push("建议添加3-5个标签");
      }
    } else {
      issues.push("缺少标签");
    }

    // Heading structure check
    const hasH2 = post.content.includes("<h2");
    const hasH3 = post.content.includes("<h3");
    if (hasH2) score += 5;
    if (hasH3) score += 5;
    if (!hasH2) suggestions.push("使用H2标题组织内容结构");

    // Image alt check (basic)
    const imgCount = (post.content.match(/<img/g) || []).length;
    const altCount = (post.content.match(/alt="/g) || []).length;
    if (imgCount > 0 && altCount < imgCount) {
      suggestions.push("部分图片缺少alt属性");
    }

    return NextResponse.json({
      score: Math.min(100, score),
      issues,
      suggestions,
      details: {
        titleLength: post.title.length,
        excerptLength: post.excerpt?.length || 0,
        contentLength: contentText.length,
        tagCount: post.tags.length,
        hasCover: !!post.coverImageUrl,
        hasH2,
        hasH3,
      },
    }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  } catch (e) {
    console.error("[SEO] Failed to analyze SEO:", e);
    return NextResponse.json({ error: "SEO分析失败" }, { status: 500 });
  }
}
