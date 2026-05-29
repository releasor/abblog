import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });

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
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });

    const { configs } = await request.json();
    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    await Promise.all(
      configs.map(({ key, value }: { key: string; value: string }) =>
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
