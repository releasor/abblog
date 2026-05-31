import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "工具箱 - billionaire",
  description: "实用在线开发工具：JSON 格式化、正则测试、颜色转换、Markdown 预览、时间戳转换等",
};

const tools = [
  { name: "JSON 格式化", path: "/tools", description: "JSON 格式化与校验" },
  { name: "正则测试", path: "/tools", description: "正则表达式在线测试" },
  { name: "颜色转换", path: "/tools", description: "HEX/RGB/HSL 颜色转换" },
  { name: "Markdown 预览", path: "/tools", description: "Markdown 实时预览" },
  { name: "时间戳转换", path: "/tools", description: "Unix 时间戳转换" },
  { name: "Base64", path: "/tools", description: "Base64 编解码" },
  { name: "密码生成", path: "/tools", description: "随机密码生成器" },
  { name: "文本对比", path: "/tools", description: "文本差异对比" },
  { name: "二维码", path: "/tools", description: "二维码生成" },
  { name: "JSON ↔ YAML", path: "/tools", description: "JSON 与 YAML 互转" },
  { name: "Crontab", path: "/tools", description: "Crontab 表达式生成" },
  { name: "HTTP 状态码", path: "/tools", description: "HTTP 状态码查询" },
  { name: "CSS 单位", path: "/tools", description: "CSS 单位换算" },
];

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "在线工具箱",
    description: "实用在线开发工具",
    url: absoluteUrl("/tools"),
    hasPart: tools.map((tool) => ({
      "@type": "WebApplication",
      name: tool.name,
      url: absoluteUrl(tool.path),
      description: tool.description,
      applicationCategory: "DeveloperApplication",
    })),
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
