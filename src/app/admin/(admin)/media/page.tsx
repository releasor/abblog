"use client";

import { useState, useEffect } from "react";
import { ImageIcon, Copy, Check, Trash2 } from "lucide-react";

interface MediaFile {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export default function MediaPage() {
  const [images, setImages] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteFile, setDeleteFile] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/media")
      .then((r) => r.json())
      .then((data) => {
        setImages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (filename: string) => {
    if (!confirm("确定要删除此文件吗？")) return;
    setDeleteFile(filename);
    const res = await fetch(`/api/media/manage?filename=${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setImages((prev) => prev.filter((img) => img.filename !== filename));
    }
    setDeleteFile(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          媒体库
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
            />
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <ImageIcon className="w-8 h-8 text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            还没有上传过文件
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <div
              key={img.filename}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                <img
                  src={img.url}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => copyUrl(img.url)}
                    className="p-2 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
                    title="复制链接"
                  >
                    {copied === img.url ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(img.filename)}
                    disabled={deleteFile === img.filename}
                    className="p-2 bg-white/90 dark:bg-zinc-900/90 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
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
    </div>
  );
}
