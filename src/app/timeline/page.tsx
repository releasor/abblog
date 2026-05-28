import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ActivityItem } from "@/components/activity-item";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "动态",
  description: "查看社区最新动态",
};

export default async function TimelinePage() {
  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, username: true, avatar: true } },
    },
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">动态</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">查看社区最新动态</p>
        </div>

        {activities.length === 0 ? (
          <EmptyState compact message="暂无动态" />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={{
                  ...activity,
                  createdAt: activity.createdAt.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
