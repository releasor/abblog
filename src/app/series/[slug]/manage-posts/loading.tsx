import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="w-8 h-8 rounded" />
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <SkeletonRow count={4} height="h-16" />
    </div>
  );
}
