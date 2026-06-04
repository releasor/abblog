import { Skeleton, SkeletonGrid } from "@/components/skeleton";

export default function GroupsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-32 mb-8" />
      <SkeletonGrid count={6} cols={3} />
    </div>
  );
}
