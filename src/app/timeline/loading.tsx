import { Skeleton } from "@/components/skeleton";

export default function TimelineLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-9 w-20 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
            >
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
