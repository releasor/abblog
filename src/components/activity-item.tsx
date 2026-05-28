import { memo } from "react";
import Link from "next/link";
import { FileText, MessageCircle, Heart, UserPlus, Bookmark } from "lucide-react";

interface ActivityItemProps {
  activity: {
    id: number;
    type: string;
    targetId?: number | null;
    metadata?: string | null;
    createdAt: string;
    user: {
      id: number;
      name: string;
      username?: string | null;
      avatar?: string | null;
    };
  };
}

const typeIcons: Record<string, typeof FileText> = {
  POST_PUBLISHED: FileText,
  COMMENT_ADDED: MessageCircle,
  LIKE_ADDED: Heart,
  FOLLOW_USER: UserPlus,
  BOOKMARK_ADDED: Bookmark,
};

const typeLabels: Record<string, string> = {
  POST_PUBLISHED: "发布了文章",
  COMMENT_ADDED: "评论了文章",
  LIKE_ADDED: "点赞了文章",
  FOLLOW_USER: "关注了用户",
  BOOKMARK_ADDED: "收藏了文章",
};

export const ActivityItem = memo(function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = typeIcons[activity.type] || FileText;
  const label = typeLabels[activity.type] || activity.type;
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;

  return (
    <div className="flex gap-3 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/u/${activity.user.username || activity.user.id}`}
            className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
          >
            {activity.user.name}
          </Link>
          <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        </div>
        {metadata?.title && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{metadata.title}</p>
        )}
        <time className="text-xs text-zinc-400 dark:text-zinc-500">
          {new Date(activity.createdAt).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
});
