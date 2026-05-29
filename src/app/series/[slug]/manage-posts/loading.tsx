import { SkeletonRow } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div>
          <div className="h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <SkeletonRow count={4} height="h-16" />
    </div>
  );
}
