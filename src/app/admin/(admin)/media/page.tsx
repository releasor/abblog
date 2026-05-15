"use client";

import { useState, useEffect } from "react";

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
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Media Library
      </h1>

      {images.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No images uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <div
              key={img.filename}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={img.url}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2">
                <p
                  className="text-xs text-zinc-700 dark:text-zinc-300 truncate"
                  title={img.filename}
                >
                  {img.filename}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatSize(img.size)} · {formatDate(img.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={() => copyUrl(img.url)}
                  className="mt-1.5 w-full px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copied === img.url ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
