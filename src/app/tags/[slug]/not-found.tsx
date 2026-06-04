import Link from "next/link";

export default function TagNotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center py-16">
        <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          404
        </h1>
        <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          标签未找到
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          该标签不存在或已被删除。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/tags"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            浏览标签
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
