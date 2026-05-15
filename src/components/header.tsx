"use client";

import Link from "next/link";
import { DarkModeToggle } from "./dark-mode-toggle";
import { SearchInput } from "./search-input";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-zinc-100 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          KitTest
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Home
          </Link>
          <Link href="/posts" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Posts
          </Link>
          <Link href="/about" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            About
          </Link>
          <SearchInput />
          <DarkModeToggle />
        </nav>
      </div>
    </header>
  );
}
