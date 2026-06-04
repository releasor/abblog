import { memo } from "react";
import { PopularPosts } from "./popular-posts";

export const PostsSidebar = memo(function PostsSidebar() {
  return (
    <aside className="hidden lg:block w-72 flex-shrink-0">
      <div className="sticky top-24 space-y-6">
        <PopularPosts />
      </div>
    </aside>
  );
});
