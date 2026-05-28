import { Skeleton } from "@/components/skeleton";

export default function TagsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="h-5 w-24" />
      </header>
      <div className="flex flex-wrap gap-3 justify-center mb-12">
        {[...Array(15)].map((_, i) => (
          <Skeleton
            key={i}
            className={`h-8 rounded-full ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`}
          />
        ))}
      </div>
    </div>
  );
}
