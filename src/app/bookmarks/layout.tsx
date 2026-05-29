import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的收藏 - billionaire",
  description: "管理你收藏的文章和收藏夹",
};

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
