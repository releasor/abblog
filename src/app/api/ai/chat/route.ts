import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiConfig } from "@/lib/ai-config";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { stripHtml } from "@/lib/text";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`ai:${userId}`, { windowMs: 60_000, max: 10 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "AI 请求过于频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    let postId: string, question: string;
  try {
    const body = await request.json();
    postId = body.postId;
    question = body.question;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!postId || !question || typeof question !== "string") {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "问题不能超过500个字符" }, { status: 400 });
  }

  let postIdNum: number;
  try { postIdNum = requireId(postId); } catch { return invalidIdResponse(); }

  const post = await prisma.post.findUnique({
    where: { id: postIdNum },
    select: { title: true, content: true },
  });

  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

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
    const plainText = stripHtml(post.content).slice(0, 4000);

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
    } catch (e) {
      console.error("[AI Chat]", e);
      return NextResponse.json({ answer: "AI 服务暂时不可用，请稍后再试。" });
    }
  } catch (e) {
    console.error("[AI Chat] Unexpected error:", e);
    return NextResponse.json({ error: "请求处理失败" }, { status: 500 });
  }
}
