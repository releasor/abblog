import { Skeleton } from "@/components/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-9 w-24 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
