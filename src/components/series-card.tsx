import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";

interface SeriesCardProps {
  series: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    coverImage?: string | null;
    _count?: { posts: number };
  };
}

export const SeriesCard = memo(function SeriesCard({ series }: SeriesCardProps) {
  return (
    <Link
      href={`/series/${series.slug}`}
      className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="aspect-video bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
        {series.coverImage && (
          <Image
            src={series.coverImage}
            alt={series.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg">{series.name}</h3>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-zinc-900">
        {series.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">
            {series.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-sm text-zinc-500">
          <BookOpen className="w-4 h-4" />
          <span>{series._count?.posts ?? 0} 篇文章</span>
        </div>
      </div>
    </Link>
  );
});
