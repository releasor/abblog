import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { highlightTerms } from "@/lib/highlight";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const suggestions = searchParams.get("suggestions") === "true";

  if (!query) {
    return NextResponse.json({ error: "Please enter a search term" }, { status: 400 });
  }

  const limit = suggestions ? 5 : 20;

  try {
    const results: Array<{
      id: number;
      title: string;
      slug: string;
      excerpt: string | null;
      content: string;
      publishedAt: Date | null;
      categoryName: string | null;
      categorySlug: string | null;
      relevance: number;
    }> = await prisma.$queryRaw`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.content,
        p.published_at AS publishedAt,
        c.name AS categoryName,
        c.slug AS categorySlug,
        MATCH(p.title, p.content) AGAINST(${query} IN NATURAL LANGUAGE MODE) AS relevance
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE
        p.status = 'PUBLISHED'
        AND MATCH(p.title, p.content) AGAINST(${query} IN NATURAL LANGUAGE MODE)
      ORDER BY relevance DESC
      LIMIT ${limit}
    `;

    if (suggestions) {
      return NextResponse.json({
        suggestions: results.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
        })),
      });
    }

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt ? highlightTerms(r.excerpt, query) : null,
        highlightedContent: highlightTerms(
          r.content.replace(/<[^>]*>/g, "").slice(0, 300),
          query
        ),
        publishedAt: r.publishedAt,
        category: r.categoryName
          ? { name: r.categoryName, slug: r.categorySlug }
          : null,
      })),
      total: results.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
