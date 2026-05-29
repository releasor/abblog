import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "留言墙 - billionaire",
  description: "在 billionaire 博客的留言墙上分享你的想法和建议",
};

export default function GuestbookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
