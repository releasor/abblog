"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

export function SearchInput() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ id: number; title: string; slug: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const res = await fetchApi<{ suggestions: Array<{ id: number; title: string; slug: string }> }>(
      `/api/search?q=${encodeURIComponent(q)}&suggestions=true`,
      { showErrorToast: false }
    );
    if (res.ok) {
      setSuggestions(res.data.suggestions || []);
      setShowSuggestions(true);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSuggestions(false);
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleSuggestionClick = (slug: string) => {
    router.push(`/posts/${slug}`);
    setShowSuggestions(false);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        aria-label="搜索"
      >
        <Search className="w-[18px] h-[18px]" />
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="absolute right-0 top-full mt-2 z-50">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章..."
            className="w-48 sm:w-64 px-3 py-1.5 pr-8 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="提交搜索"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg z-50 overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(s.slug)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </div>
  );
}
