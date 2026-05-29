import { Skeleton, SkeletonRow } from "@/components/skeleton";

export default function AdminLoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <SkeletonRow count={3} height="h-12" />
      </div>
    </div>
  );
}
