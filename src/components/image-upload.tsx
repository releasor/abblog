"use client";

import { useState, useRef, useCallback, memo } from "react";
import { Upload } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

const ImageUpload = memo(function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "上传失败");
          return;
        }

        onChange(data.url);
      } catch {
        setError("上传失败");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("不支持的文件类型");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("文件太大（最大 5MB）");
      return;
    }

    upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="封面图片"
            className="w-full max-w-md h-48 object-cover rounded-md border border-zinc-200 dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            移除
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 right-20 px-2 py-1 text-xs bg-zinc-600 text-white rounded-md hover:bg-zinc-700 transition-colors"
          >
            替换
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="上传封面图片，支持拖放或点击选择"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className={`w-full max-w-md h-48 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          }`}
        >
          {uploading ? (
            <div className="text-sm text-zinc-500">上传中...</div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-zinc-400 mb-2" />
              <p className="text-sm text-zinc-500">
                拖放图片或点击选择
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                JPEG, PNG, GIF, WebP — 最大 5MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

export default ImageUpload;
