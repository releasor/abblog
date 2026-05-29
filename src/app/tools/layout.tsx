import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "工具箱 - billionaire",
  description: "实用在线开发工具：JSON 格式化、正则测试、颜色转换、Markdown 预览、时间戳转换等",
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
