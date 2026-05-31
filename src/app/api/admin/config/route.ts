import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const configs = await prisma.siteConfig.findMany();

    return NextResponse.json(configs, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[AdminConfig] Failed to fetch config:", e);
    return NextResponse.json({ error: "获取配置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const rl = checkRateLimit(`admin-config:${session?.user?.id || "admin"}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { configs } = body;
    if (!Array.isArray(configs) || configs.length === 0) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const validConfigs = configs.filter(
      (c: unknown): c is { key: string; value: string } =>
        typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).key === "string" && "value" in (c as Record<string, unknown>)
    );
    if (validConfigs.length === 0) {
      return NextResponse.json({ error: "配置项格式无效" }, { status: 400 });
    }

    await Promise.all(
      validConfigs.map(({ key, value }) =>
        prisma.siteConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[AdminConfig] Failed to update config:", e);
    return NextResponse.json({ error: "更新配置失败" }, { status: 500 });
  }
}
