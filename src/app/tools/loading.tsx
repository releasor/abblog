import { Skeleton } from "@/components/skeleton";

export default function ToolsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
