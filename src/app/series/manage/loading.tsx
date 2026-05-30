import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <SkeletonRow count={3} height="h-24" />
    </div>
  );
}
