import { Skeleton, SkeletonGrid } from "@/components/skeleton";

export default function TopicsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-32 mb-2" />
      <Skeleton className="h-5 w-64 mb-8" />
      <SkeletonGrid count={6} cols={3} />
    </div>
  );
}
