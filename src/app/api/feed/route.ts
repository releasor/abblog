import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: {
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    const siteUrl = absoluteUrl("");
    const items = posts
      .map(
        (post) => {
          const link = absoluteUrl(`/posts/${post.slug}`);
          const description = post.excerpt
            ? `${post.excerpt}<p><a href="${link}">阅读全文 →</a></p>`
            : `<p><a href="${link}">阅读全文 →</a></p>`;
          return `
      <item>
        <title><![CDATA[${post.title}]]></title>
        <link>${link}</link>
        <guid isPermaLink="true">${link}</guid>
        <description><![CDATA[${description}]]></description>
        <pubDate>${post.publishedAt?.toUTCString() || ""}</pubDate>
        <author><![CDATA[${post.author.name}]]></author>
        ${post.category ? `<category><![CDATA[${post.category.name}]]></category>` : ""}
      </item>`;
        }
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>billionaire</title>
      <link>${siteUrl}</link>
      <description>AI 与数字生活的无限可能</description>
      <language>zh-CN</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <atom:link href="${absoluteUrl("/api/feed")}" rel="self" type="application/rss+xml"/>
      ${items}
    </channel>
  </rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[Feed] Failed to generate RSS feed:", e);
    return new NextResponse("服务器内部错误", { status: 500 });
  }
}
