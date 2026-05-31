import { Skeleton, SkeletonPostListItem } from "@/components/skeleton";

export default function TagDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-9 w-40 mb-2" />
      <Skeleton className="h-5 w-24 mb-8" />
      <SkeletonPostListItem count={5} />
    </div>
  );
}
