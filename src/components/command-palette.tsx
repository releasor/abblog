"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Folder, Tag, Sun, Home, PenSquare } from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette = memo(function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = useMemo(() => [
    {
      id: "home",
      label: "首页",
      icon: Home,
      action: () => { router.push("/"); onClose(); },
      keywords: ["home", "首页"],
    },
    {
      id: "posts",
      label: "文章",
      icon: FileText,
      action: () => { router.push("/posts"); onClose(); },
      keywords: ["posts", "文章", "blog"],
    },
    {
      id: "categories",
      label: "分类",
      icon: Folder,
      action: () => { router.push("/categories"); onClose(); },
      keywords: ["categories", "分类"],
    },
    {
      id: "tags",
      label: "标签",
      icon: Tag,
      action: () => { router.push("/tags"); onClose(); },
      keywords: ["tags", "标签"],
    },
    {
      id: "new-post",
      label: "写文章",
      icon: PenSquare,
      action: () => { router.push("/posts/new"); onClose(); },
      keywords: ["new", "write", "写文章", "新建"],
    },
    {
      id: "search",
      label: "搜索",
      icon: Search,
      action: () => { router.push("/search"); onClose(); },
      keywords: ["search", "搜索"],
    },
    {
      id: "theme-toggle",
      label: "切换主题",
      icon: Sun,
      action: () => {
        document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
        onClose();
      },
      keywords: ["theme", "dark", "light", "主题", "暗色", "亮色"],
    },
  ], [router, onClose]);

  const filtered = useMemo(() => commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }), [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] md:pt-[20vh]" role="dialog" aria-modal="true" aria-label="命令面板">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`flex items-center gap-3 w-full px-4 py-2 text-left ${
                  i === selectedIndex
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{cmd.label}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">没有匹配的命令</p>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">↑↓</kbd>
            <span>导航</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">↵</kbd>
            <span>确认</span>
          </div>
          <span className="text-xs text-zinc-400">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
});
