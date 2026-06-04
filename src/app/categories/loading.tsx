import { Skeleton, SkeletonGrid } from "@/components/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-9 w-24 mb-8" />
      <SkeletonGrid count={6} cols={3} />
    </div>
  );
}
