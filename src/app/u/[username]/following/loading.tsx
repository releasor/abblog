import { Skeleton, SkeletonUserListItem } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-32" />
        <SkeletonUserListItem count={5} />
      </div>
    </div>
  );
}
