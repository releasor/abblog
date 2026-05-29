import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function PromptsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <SkeletonRow count={4} height="h-20" />
    </div>
  );
}
