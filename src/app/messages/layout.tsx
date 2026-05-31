import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "私信 - billionaire",
  description: "查看和管理你的私信对话",
  robots: { index: false, follow: false },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
