import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function AdminConfigLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <SkeletonRow count={4} height="h-20" />
    </div>
  );
}
