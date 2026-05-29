import { Skeleton } from "@/components/skeleton";

export default function NewPostLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}
