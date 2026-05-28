import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Flame, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "话题广场",
  description: "浏览热门话题，发现精彩内容",
};

export default async function TopicsPage() {
  const [hotTopics, newTopics] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { postCount: "desc" },
      take: 12,
    }),
    prisma.topic.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">话题广场</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">浏览热门话题，发现精彩内容</p>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          热门话题
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {hotTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                {topic.coverImage ? (
                  <img src={topic.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
                    {topic.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-orange-500">
                    {topic.name}
                  </h3>
                  <p className="text-xs text-zinc-500">{topic.postCount} 篇文章</p>
                </div>
              </div>
              {topic.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{topic.description}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          最新话题
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {newTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
            >
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-500 mb-1">
                {topic.name}
              </h3>
              <p className="text-xs text-zinc-500">{topic.postCount} 篇文章</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
