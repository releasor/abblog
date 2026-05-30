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

  const rl = checkRateLimit(`ai:${userId}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "AI 请求过于频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
  }

  let content: string;
  try {
    const body = await request.json();
    content = body.content;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "缺少提示词内容" }, { status: 400 });
  }

  const config = await getAiConfig(userId);

  if (!config.apiKey) {
    return NextResponse.json({
      optimized: "请先在「账号设置 → AI 设置」中配置 API Key。",
    });
  }

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
          {
            role: "system",
            content: `你是一个 AI 提示词工程师。用户会给你一个初步的提示词，你需要将其优化并输出为结构化的 Spec 格式。

规则：
1. 分析用户的原始意图
2. 将其扩展为结构化的提示词规格
3. 保留用户可能已有的 {{变量}} 语法
4. 用中文输出

输出格式（严格遵守）：

# 提示词 Spec

## 角色
[AI 应该扮演的角色，具体且有专业性]

## 任务
[详细的任务描述，包含具体步骤]

## 输入
[需要的输入信息和格式，如有变量用 {{变量名}} 标记]

## 输出
[期望的输出格式、结构和风格要求]

## 约束
[限制条件、边界和注意事项]

## 示例
[至少一个输入输出示例]

只输出 Spec 内容，不要添加其他解释。`,
          },
          {
            role: "user",
            content: `请优化以下提示词并生成 Spec：\n\n${content}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ optimized: "AI 服务暂时不可用，请稍后再试。" });
    }

    const data = await res.json();
    const optimized = data.choices?.[0]?.message?.content || "无法生成优化结果";
    return NextResponse.json({ optimized });
  } catch (e) {
    console.error("[Prompt Optimize]", e);
    return NextResponse.json({ optimized: "AI 服务暂时不可用，请稍后再试。" });
  }
}
