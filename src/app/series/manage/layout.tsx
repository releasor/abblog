import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理系列 - billionaire",
  description: "管理你的系列文章",
};

export default function ManageSeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
