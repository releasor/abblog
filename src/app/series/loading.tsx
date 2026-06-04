import { Skeleton, SkeletonGrid } from "@/components/skeleton";

export default function SeriesLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-48 mb-8" />
      <SkeletonGrid count={4} cols={2} />
    </div>
  );
}
