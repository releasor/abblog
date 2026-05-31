import { Skeleton, SkeletonPostListItem } from "@/components/skeleton";

export default function PostsLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 mb-8" />
        <SkeletonPostListItem count={5} />
      </div>
    </div>
  );
}
