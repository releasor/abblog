"use client";

import { useState, useEffect, memo } from "react";
import { Heart } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { formatDate } from "@/lib/format-date";
import { DataTable } from "@/components/data-table";
import { SimplePagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";

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

export default memo(function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tab, setTab] = useState<"all" | "sent" | "received">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDonations() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: String(ADMIN_PAGE_SIZE) });
        if (tab !== "all") params.set("type", tab);
        const res = await fetchApi<{ donations: Donation[]; pagination: { totalPages: number } }>(`/api/donations?${params}`, { showErrorToast: false });
        if (!cancelled && res.ok) {
          setDonations(res.data.donations || []);
          setTotalPages(res.data.pagination?.totalPages || 1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDonations();
    return () => { cancelled = true; };
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

      <FilterTabs
        tabs={[
          { key: "all", label: "全部" },
          { key: "sent", label: "发出" },
          { key: "received", label: "收到" },
        ]}
        active={tab}
        onChange={(key) => {
          setTab(key as "all" | "sent" | "received");
          setPage(1);
        }}
      />

      <DataTable
        columns={[
          {
            key: "sender",
            label: "发送者",
            render: (d) => (
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {d.sender.name}
              </span>
            ),
          },
          {
            key: "recipient",
            label: "接收者",
            render: (d) => (
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {d.recipient.name}
              </span>
            ),
          },
          {
            key: "amount",
            label: "金额",
            render: (d) => (
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                ¥{(d.amount / 100).toFixed(0)}
              </span>
            ),
          },
          {
            key: "post",
            label: "文章",
            hideOnMobile: true,
            render: (d) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-xs block">
                {d.post ? d.post.title : "—"}
              </span>
            ),
          },
          {
            key: "status",
            label: "状态",
            render: (d) => <StatusBadge config={statusConfig[d.status] ?? { label: "待处理", dot: "bg-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-700 dark:text-yellow-400" }} />,
          },
          {
            key: "createdAt",
            label: "时间",
            hideOnMobile: true,
            render: (d) => (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(d.createdAt)}
              </span>
            ),
          },
        ]}
        data={donations}
        loading={loading}
        loadingRows={5}
        emptyIcon={<Heart className="w-8 h-8" />}
        emptyMessage="暂无赞赏记录"
        keyExtractor={(d) => d.id}
      />

      <SimplePagination
        page={page}
        totalPages={totalPages}
        totalLabel={`第 ${page} 页，共 ${totalPages} 页`}
        onPageChange={setPage}
      />
    </div>
  );
});
