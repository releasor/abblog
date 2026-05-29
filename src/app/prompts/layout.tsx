import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt 管理 - billionaire",
  description: "管理你的 AI 提示词，支持分类、标签和变量替换",
};

export default function PromptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
