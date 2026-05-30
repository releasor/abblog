import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "用户主页 - billionaire",
  description: "查看用户的文章、点赞和收藏",
};

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
