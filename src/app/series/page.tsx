import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SeriesCard } from "@/components/series-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "系列文章",
  description: "浏览所有系列文章",
};

export const revalidate = 600;

export default async function SeriesPage() {
  const series = await prisma.postSeries.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      _count: { select: { posts: true } },
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "系列文章",
    description: "浏览所有系列文章",
    url: absoluteUrl("/series"),
    hasPart: series.map((s) => ({
      "@type": "Thing",
      name: s.name,
      url: absoluteUrl(`/series/${s.slug}`),
    })),
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHeader title="系列文章" description="浏览所有系列文章，系统地学习某个主题" />

      {series.length === 0 ? (
        <EmptyState compact message="暂无系列文章" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </main>
  );
}
