import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function AdminPostsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <SkeletonRow count={5} height="h-16" />
    </div>
  );
}
