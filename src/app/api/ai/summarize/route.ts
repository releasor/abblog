import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
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
