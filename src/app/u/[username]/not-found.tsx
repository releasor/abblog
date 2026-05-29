import Link from "next/link";

export default function UserNotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center py-16">
        <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          404
        </h1>
        <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          用户未找到
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          该用户不存在或账号已被注销。
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
