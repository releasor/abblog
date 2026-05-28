"use client";

import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import { showToast } from "@/components/toast";

export default function AdminExportPage() {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billionaire-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch {
      showToast("导出失败，请稍后重试", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        数据导出
      </h1>

      <div className="max-w-xl">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <FileJson className="w-6 h-6 text-zinc-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                全站数据导出
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                导出所有文章、分类、标签、评论、用户、媒体文件等数据为 JSON
                格式。可用于数据备份或迁移到其他平台。
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {exporting ? "导出中..." : exported ? "已下载" : "开始导出"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            导出文件包含所有数据，请妥善保管，避免泄露。导出过程可能需要几秒钟时间。
          </p>
        </div>
      </div>
    </div>
  );
}
