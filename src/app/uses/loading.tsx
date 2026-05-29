import { Skeleton, SkeletonText } from "@/components/skeleton";

export default function UsesLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </div>
  );
}
