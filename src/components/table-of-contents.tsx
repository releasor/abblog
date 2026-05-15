"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { TocHeading } from "@/lib/toc";

interface TableOfContentsProps {
  headings: TocHeading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveId(id);
        setIsOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    if (headingElements.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observerRef.current!.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* Mobile/tablet floating button — hidden on mobile, visible on md */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 md:hidden lg:hidden xl:hidden bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        aria-label="Toggle table of contents"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </button>

      {/* Mobile/tablet overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden lg:hidden xl:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-72 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Table of Contents
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                aria-label="Close table of contents"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <TocList
              headings={headings}
              activeId={activeId}
              onClick={handleClick}
            />
          </div>
        </div>
      )}

      {/* Desktop sticky sidebar */}
      <aside className="hidden md:block w-56 shrink-0">
        <nav
          className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2"
          aria-label="Table of contents"
        >
          <TocList
            headings={headings}
            activeId={activeId}
            onClick={handleClick}
          />
        </nav>
      </aside>
    </>
  );
}

function TocList({
  headings,
  activeId,
  onClick,
}: {
  headings: TocHeading[];
  activeId: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <ul className="space-y-1 text-sm">
      {headings.map((heading) => (
        <li
          key={heading.id}
          className={heading.level === 3 ? "ml-4" : ""}
        >
          <a
            href={`#${heading.id}`}
            onClick={(e) => onClick(e, heading.id)}
            className={`block py-1 px-2 rounded transition-colors ${
              activeId === heading.id
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 font-medium"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );
}
