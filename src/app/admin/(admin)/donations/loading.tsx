import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function AdminDonationsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <SkeletonRow count={5} height="h-16" />
    </div>
  );
}
