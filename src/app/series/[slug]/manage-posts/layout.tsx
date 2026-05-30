import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理系列文章 - billionaire",
  description: "管理系列中的文章排序和内容",
};

export default function ManagePostsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
