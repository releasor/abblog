import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse, getClientIp } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_LONG, CACHE_PRIVATE_STALE_LONG } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const ip = getClientIp(request);
    const rl = checkRateLimit(`export:${userId || ip}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "markdown";

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, content: true, excerpt: true, publishedAt: true, author: { select: { name: true } } },
    });
    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    if (format === "markdown") {
      const md = `---\ntitle: "${post.title}"\nauthor: "${post.author.name}"\ndate: "${post.publishedAt?.toISOString() || ""}"\n---\n\n${post.content}`;
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(post.title)}.md"`,
          "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_LONG}, stale-while-revalidate=${CACHE_PRIVATE_STALE_LONG}`,
        },
      });
    }

    return NextResponse.json({ error: "不支持的格式" }, { status: 400 });
  } catch (e) {
    console.error("[Export] Failed to export post:", e);
    return NextResponse.json({ error: "导出文章失败" }, { status: 500 });
  }
}
