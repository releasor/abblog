import { Skeleton } from "@/components/skeleton";

export default function AdminExportLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
