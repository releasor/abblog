import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "私信 - billionaire",
  robots: { index: false, follow: false },
};

export default function MessageDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
