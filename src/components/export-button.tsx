"use client";

import { useState, memo } from "react";
import { Download, FileText } from "lucide-react";
import { showToast } from "./toast";

interface ExportButtonProps {
  postId: number;
  title: string;
}

export const ExportButton = memo(function ExportButton({ postId, title }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleExport(format: "markdown" | "pdf") {
    setOpen(false);
    setExporting(true);
    try {
      if (format === "markdown") {
        const res = await fetch(`/api/posts/${postId}/export?format=markdown`);
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        window.print();
      }
    } catch {
      showToast("导出失败，请稍后重试", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        disabled={exporting}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Download className="w-4 h-4" />
        <span>导出</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 z-20">
            <button
              onClick={() => handleExport("markdown")}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-t-lg"
            >
              <FileText className="w-4 h-4" />
              <span>Markdown</span>
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-b-lg"
            >
              <Download className="w-4 h-4" />
              <span>PDF (打印)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});
