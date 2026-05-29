import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "关于",
  description: "关于 billionaire 博客 — 专注于 AI 与数字生活的个人博客",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <PageHeader title="关于" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p>
          欢迎来到 billionaire — 这是一个专注于 AI 与数字生活的个人博客。
        </p>

        <p>
          在这里，我分享关于 AI 工具、数字效率、极简生活方式的思考与实践。
          从 ChatGPT 到 Midjourney，从工作流优化到数字断舍离，
          探索技术如何让生活变得更好。
        </p>

        <h2>你会在这里找到什么</h2>
        <ul>
          <li>AI 工具的实用技巧和深度评测</li>
          <li>提升数字生活效率的方法和工具</li>
          <li>科技趋势的观察和思考</li>
          <li>极简主义和数字生活方式的探索</li>
        </ul>

        <h2>在线工具箱</h2>
        <p>
          我还提供了一些实用的在线工具，包括 JSON 格式化、正则测试、颜色转换和 Markdown 预览，
          帮助开发者提升日常工作效率。
        </p>

        <h2>联系方式</h2>
        <p>
          有问题或想合作？欢迎通过页脚中的社交媒体链接与我联系，
          或者在留言墙上留下你的想法。
        </p>
      </div>
    </div>
  );
}
