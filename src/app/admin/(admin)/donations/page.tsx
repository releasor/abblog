"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { SkeletonRow } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { SimplePagination } from "@/components/pagination";

interface Donation {
  id: number;
  amount: number;
  message: string | null;
  status: string;
  createdAt: string;
  sender: { id: number; name: string; avatar: string | null };
  recipient: { id: number; name: string; avatar: string | null };
  post: { id: number; title: string } | null;
}

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tab, setTab] = useState<"all" | "sent" | "received">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "20" });
    if (tab !== "all") params.set("type", tab);
    fetch(`/api/donations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setDonations(data.donations || []);
        setTotalPages(data.pagination?.totalPages || 1);
      })
      .catch((e) => console.error("[Donations] Failed to fetch donations:", e))
      .finally(() => setLoading(false));
  }, [page, tab]);

  const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    COMPLETED: {
      label: "已完成",
      dot: "bg-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    PENDING: {
      label: "处理中",
      dot: "bg-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-700 dark:text-amber-400",
    },
    REFUNDED: {
      label: "已退款",
      dot: "bg-zinc-400",
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-600 dark:text-zinc-400",
    },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        赞赏管理
      </h1>

      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg w-fit">
        {([
          { key: "all", label: "全部" },
          { key: "sent", label: "发出" },
          { key: "received", label: "收到" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRow count={5} height="h-16" />
      ) : donations.length === 0 ? (
        <EmptyState icon={<Heart className="w-8 h-8" />} message="暂无赞赏记录" />
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  发送者
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  接收者
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  金额
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  文章
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {donations.map((d) => {
                const config = statusConfig[d.status] || statusConfig.PENDING;
                return (
                  <tr
                    key={d.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-zinc-900 dark:text-zinc-100">
                      {d.sender.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-900 dark:text-zinc-100">
                      {d.recipient.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      ¥{(d.amount / 100).toFixed(0)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                      {d.post ? d.post.title : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDate(d.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SimplePagination
        page={page}
        totalPages={totalPages}
        totalLabel={`第 ${page} 页，共 ${totalPages} 页`}
        onPageChange={setPage}
      />
    </div>
  );
}
