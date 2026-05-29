import { Skeleton, SkeletonText } from "@/components/skeleton";

export default function AboutLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-32" />
      <SkeletonText lines={3} />
    </div>
  );
}
