import { Skeleton, SkeletonPostListItem } from "@/components/skeleton";

export default function PostsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-48 mb-8" />
      <SkeletonPostListItem count={5} />
    </div>
  );
}
