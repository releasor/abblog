import { Skeleton } from "@/components/skeleton";

export default function ArchiveLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-12">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-12">
        {[1, 2].map((year) => (
          <div key={year}>
            <Skeleton className="h-8 w-20 mb-6" />
            <div className="space-y-8">
              {[1, 2, 3].map((month) => (
                <div key={month}>
                  <Skeleton className="h-6 w-16 mb-3" />
                  <div className="space-y-2 border-l-2 border-zinc-200 dark:border-zinc-800 pl-4">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="flex items-baseline gap-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-48" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
