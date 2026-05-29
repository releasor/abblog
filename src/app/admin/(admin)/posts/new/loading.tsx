import { Skeleton } from "@/components/skeleton";

export default function AdminNewPostLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
