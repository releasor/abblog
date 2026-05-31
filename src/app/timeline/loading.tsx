import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function TimelineLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-9 w-20 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <SkeletonList count={5} />
      </div>
    </div>
  );
}
