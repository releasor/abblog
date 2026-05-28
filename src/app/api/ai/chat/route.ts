import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiConfig } from "@/lib/ai-config";

export async function POST(request: NextRequest) {
  const { postId, question } = await request.json();

  if (!postId || !question) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { title: true, content: true },
  });

  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  // Use user config if logged in, otherwise fall back to env vars
  const config = userId
    ? await getAiConfig(userId)
    : {
        apiKey: process.env.AI_API_KEY || "",
        apiUrl: process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
        model: process.env.AI_MODEL || "gpt-3.5-turbo",
      };

  if (!config.apiKey) {
    return NextResponse.json({
      answer: "AI 问答功能需要在「账号设置 → AI 设置」中配置 API Key。",
    });
  }

  try {
    const plainText = post.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 4000);

    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: `你是一个文章问答助手。根据以下文章内容回答用户问题。如果文章中没有相关信息，请说明。用中文回答。

文章标题：${post.title}
文章内容：${plainText}`,
          },
          {
            role: "user",
            content: question,
          },
        ],
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ answer: "AI 服务暂时不可用，请稍后再试。" });
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || "无法生成回答";
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ answer: "AI 服务暂时不可用，请稍后再试。" });
  }
}
