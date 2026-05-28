import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site-url";

export async function GET() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  const categories = await prisma.category.findMany({ select: { slug: true } });
  const tags = await prisma.tag.findMany({ select: { slug: true } });

  const urls = [
    { loc: absoluteUrl(""), lastmod: undefined, changefreq: "daily", priority: "1.0" },
    { loc: absoluteUrl("/posts"), lastmod: undefined, changefreq: "daily", priority: "0.9" },
    { loc: absoluteUrl("/categories"), lastmod: undefined, changefreq: "weekly", priority: "0.7" },
    { loc: absoluteUrl("/tags"), lastmod: undefined, changefreq: "weekly", priority: "0.7" },
    ...posts.map((p) => ({
      loc: absoluteUrl(`/posts/${p.slug}`),
      lastmod: (p.updatedAt || p.publishedAt)?.toISOString(),
      changefreq: "monthly",
      priority: "0.8",
    })),
    ...categories.map((c) => ({ loc: absoluteUrl(`/categories/${c.slug}`), lastmod: undefined, changefreq: "weekly", priority: "0.6" })),
    ...tags.map((t) => ({ loc: absoluteUrl(`/tags/${t.slug}`), lastmod: undefined, changefreq: "weekly", priority: "0.5" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
