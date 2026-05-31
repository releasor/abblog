import { SkeletonPost } from "@/components/skeleton";

export default function PostDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SkeletonPost />
    </div>
  );
}
