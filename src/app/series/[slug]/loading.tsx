import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function SeriesDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Skeleton className="h-10 w-64 mb-2" />
      <Skeleton className="h-5 w-96 mb-8" />
      <SkeletonList count={5} />
    </div>
  );
}
