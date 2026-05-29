import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);

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

  const { messages, mode } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "缺少对话内容" }, { status: 400 });
  }

  const config = await getAiConfig(userId);

  if (!config.apiKey) {
    return NextResponse.json({
      reply: "请先在「账号设置 → AI 设置」中配置 API Key。",
    });
  }

  const systemPrompt = mode === "generate-spec"
    ? `你是一个专业的 AI 提示词工程师。用户会和你讨论他们想要的 AI 提示词需求。

当用户说"生成 spec"或类似的意图时，请根据整个对话内容生成一个结构化的提示词规格文档（Spec）。

输出格式：
---
# 提示词 Spec

## 角色
[AI 应该扮演的角色]

## 任务
[具体要完成的任务描述]

## 输入
[需要的输入信息和格式]

## 输出
[期望的输出格式和要求]

## 约束
[限制条件和边界]

## 示例
[输入输出示例（如有）]
---

如果用户还没有明确需求，继续和用户对话，帮助他们澄清需求。用中文回复。`
    : `你是一个友好的 AI 助手。用中文回复，保持简洁有帮助。`;

  try {
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("AI error:", errText);
      return NextResponse.json({ reply: `AI 服务返回错误 (${res.status}): ${errText.slice(0, 200)}` });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "无法生成回复";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("AI fetch error:", e);
    return NextResponse.json({ reply: "请求失败，请检查AI设置后重试" });
  }
}
