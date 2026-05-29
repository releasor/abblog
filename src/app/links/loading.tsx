import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function LinksLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-20" />
      <SkeletonRow count={5} height="h-16" />
    </div>
  );
}
