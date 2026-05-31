import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "发布文章 - billionaire",
  robots: { index: false, follow: false },
};

export default function NewPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
