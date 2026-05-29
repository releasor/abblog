import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GroupCard } from "@/components/group-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader title="圈子" description="加入感兴趣的圈子，与志同道合的人交流" />

      {groups.length === 0 ? (
        <EmptyState compact message="暂无圈子" />
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
