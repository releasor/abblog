import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Rate limit AI requests
  const rl = checkRateLimit(`ai:${userId}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "AI 请求过于频繁，请稍后再试" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ error: "缺少文章ID" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { title: true, content: true },
  });

  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-3.5-turbo";

  if (!apiKey) {
    const plainText = post.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const summary = plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
    return NextResponse.json({ summary });
  }

  try {
    const plainText = post.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 3000);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是一个文章摘要助手。请用一句简洁的中文概括文章核心内容，不超过50字。",
          },
          {
            role: "user",
            content: `标题：${post.title}\n\n内容：${plainText}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const plainTextFallback = post.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      const summary = plainTextFallback.slice(0, 150) + (plainTextFallback.length > 150 ? "..." : "");
      return NextResponse.json({ summary });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || "暂无摘要";
    return NextResponse.json({ summary });
  } catch {
    const plainTextFallback = post.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const summary = plainTextFallback.slice(0, 150) + (plainTextFallback.length > 150 ? "..." : "");
    return NextResponse.json({ summary });
  }
}
