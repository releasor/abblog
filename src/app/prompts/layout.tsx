import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Prompt 管理 - billionaire",
  description: "管理你的 AI 提示词，支持分类、标签和变量替换",
};

export default function PromptsLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Prompt 管理",
    description: "管理你的 AI 提示词，支持分类、标签和变量替换",
    url: absoluteUrl("/prompts"),
    applicationCategory: "ProductivityApplication",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
