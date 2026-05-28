import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GroupCard } from "@/components/group-card";

export const metadata: Metadata = {
  title: "圈子",
  description: "浏览所有圈子小组",
};

export default async function GroupsPage() {
  const groups = await prisma.group.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, posts: true } },
    },
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">圈子</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          加入感兴趣的圈子，与志同道合的人交流
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400">暂无圈子</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </main>
  );
}
