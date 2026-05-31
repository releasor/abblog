import { SkeletonProfile } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <SkeletonProfile />
    </div>
  );
}
