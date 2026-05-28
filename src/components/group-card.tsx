import Link from "next/link";
import { Users } from "lucide-react";

interface GroupCardProps {
  group: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    coverImage?: string | null;
    isPublic: boolean;
    _count?: { members: number; posts: number };
  };
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="aspect-video bg-gradient-to-br from-emerald-500 to-teal-600 relative overflow-hidden">
        {group.coverImage && (
          <img
            src={group.coverImage}
            alt={group.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg">{group.name}</h3>
          {!group.isPublic && (
            <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">私密</span>
          )}
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-zinc-900">
        {group.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">
            {group.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{group._count?.members ?? 0} 成员</span>
          </div>
          <span>{group._count?.posts ?? 0} 文章</span>
        </div>
      </div>
    </Link>
  );
}
