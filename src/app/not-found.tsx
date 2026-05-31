import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "页面未找到",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center py-16">
        <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          404
        </h1>
        <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          页面未找到
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          您访问的页面不存在或已被移除。
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
