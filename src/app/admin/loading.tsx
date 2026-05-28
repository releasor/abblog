import { Skeleton } from "@/components/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      <aside className="w-60 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="p-3 space-y-1">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3"
              >
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </main>
    </div>
  );
}
