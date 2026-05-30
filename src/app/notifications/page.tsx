"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format-date";
import { EmptyState } from "@/components/empty-state";
import { showToast } from "@/components/toast";
import { Skeleton } from "@/components/skeleton";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

interface Notification {
  id: number;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  COMMENT_REPLY: "💬",
  LIKE: "❤️",
};
const getTypeIcon = (type: string) => TYPE_ICONS[type] || "📢";

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetchNotifications();
  }, [status]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (e) {
      console.error("[Notifications] Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id?: number) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      if (res.ok) {
        fetchNotifications();
      } else {
        showToast("标记已读失败", "error");
      }
    } catch (e) {
      console.error("[Notifications] Failed to mark as read:", e);
      showToast("标记已读失败，请检查网络连接", "error");
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <PageHeader
        title="通知中心"
        description={unreadCount > 0 ? `${unreadCount} 条未读通知` : undefined}
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => markAsRead()}>
              全部已读
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <EmptyState compact message="暂无通知" />
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                n.isRead
                  ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
              }`}
            >
              <span className="text-lg">{getTypeIcon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{n.message}</p>
                <time className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
                  {formatDateTime(n.createdAt)}
                </time>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {n.link && (
                  <Link
                    href={n.link}
                    onClick={() => !n.isRead && markAsRead(n.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    查看
                  </Link>
                )}
                {!n.isRead && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="w-2 h-2 rounded-full bg-blue-500"
                    aria-label="标记已读"
                    title="标记已读"
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
