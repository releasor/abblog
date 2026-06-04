import { Skeleton, SkeletonText } from "@/components/skeleton";

export default function PostDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex md:gap-8">
        <article className="max-w-3xl flex-1 min-w-0">
          <Skeleton className="w-full aspect-[16/9] rounded-lg mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 mb-8">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonText lines={12} />
          <div className="flex items-center justify-between py-6 my-8 border-t border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </article>
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24 space-y-2">
            <Skeleton className="h-4 w-20 mb-3" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
