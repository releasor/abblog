"use client";

import { useState, useEffect, memo } from "react";
import Image from "next/image";
import { ImageIcon, Copy, Check, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { useCopyWithId } from "@/hooks/use-copy";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { fetchApi } from "@/lib/fetch-api";

interface MediaFile {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default memo(function MediaPage() {
  const [images, setImages] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { copiedId, copy } = useCopyWithId<string>();
  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const [deleteTargetFile, setDeleteTargetFile] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMedia() {
      const result = await fetchApi<MediaFile[]>("/api/media", { errorMessage: "加载媒体库失败" });
      if (!cancelled) {
        setLoading(false);
        if (result.ok && Array.isArray(result.data)) setImages(result.data);
      }
    }
    loadMedia();
    return () => { cancelled = true; };
  }, []);

  const copyUrl = (url: string) => copy(url, url);

  const handleDelete = async (filename: string) => {
    setDeleteFile(filename);
    const result = await fetchApi(`/api/media/manage?filename=${encodeURIComponent(filename)}`, {
      method: "DELETE",
      errorMessage: "删除失败",
    });
    setDeleteFile(null);
    if (result.ok) setImages((prev) => prev.filter((img) => img.filename !== filename));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          媒体库
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        媒体库
        <span className="ml-2 text-sm font-normal text-zinc-400">
          {images.length} 个文件
        </span>
      </h1>

      {images.length === 0 ? (
        <EmptyState icon={<ImageIcon className="w-8 h-8" />} message="还没有上传过文件" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <div
              key={img.filename}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                <Image
                  src={img.url}
                  alt={img.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => copyUrl(img.url)}
                    className="p-2 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
                    aria-label="复制图片链接"
                    title="复制链接"
                  >
                    {copiedId === img.url ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteTargetFile(img.filename)}
                    disabled={deleteFile === img.filename}
                    className="p-2 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
                    aria-label="删除图片"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p
                  className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium"
                  title={img.filename}
                >
                  {img.filename}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {formatSize(img.size)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetFile !== null}
        title="删除文件"
        message="确定要删除此文件吗？此操作无法撤销。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetFile) handleDelete(deleteTargetFile);
          setDeleteTargetFile(null);
        }}
        onCancel={() => setDeleteTargetFile(null)}
      />
    </div>
  );
});
