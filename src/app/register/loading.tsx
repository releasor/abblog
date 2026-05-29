import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function RegisterLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <div className="mt-8">
          <SkeletonRow count={4} height="h-12" />
        </div>
      </div>
    </div>
  );
}
