import { SkeletonRow } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>
      <SkeletonRow count={3} height="h-24" />
    </div>
  );
}
