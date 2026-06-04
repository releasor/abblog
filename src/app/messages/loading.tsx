import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <SkeletonList count={5} />
      </div>
    </div>
  );
}
