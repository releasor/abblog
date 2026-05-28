import { Skeleton } from "@/components/skeleton";

export default function SearchLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-full max-w-md mx-auto mb-8 rounded-lg" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
          >
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
