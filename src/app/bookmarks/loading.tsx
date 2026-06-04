import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function BookmarksLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-3">
          <SkeletonList count={3} />
        </div>
      </div>
    </div>
  );
}
