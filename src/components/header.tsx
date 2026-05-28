"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { DarkModeToggle } from "./dark-mode-toggle";
import { SearchInput } from "./search-input";
import { UserAvatar } from "./user-avatar";

function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((data) => setCount(data.unreadCount || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/notifications" className="relative p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold leading-4 text-center text-white bg-red-500 rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; avatar: string | null }>({ username: null, avatar: null });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => setProfile({ username: data.username, avatar: data.avatar }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const profileUrl = profile.username ? `/u/${profile.username}` : "/settings";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <UserAvatar name={session?.user?.name || "?"} avatar={profile.avatar} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{session?.user?.name}</p>
          </div>
          <Link href={profileUrl} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            个人主页
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            设置
          </Link>
          <Link href="/messages" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            私信
          </Link>
          <Link href="/bookmarks" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            我的收藏
          </Link>
          <Link href="/posts/new" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            发布文章
          </Link>
          <div className="border-t border-zinc-200 dark:border-zinc-800 mt-1 pt-1">
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();

  const handleLinkMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-logo">
            billionaire
          </Link>

          <nav className="site-nav">
            <Link href="/" className="site-nav-link" onMouseMove={handleLinkMouseMove}>首页</Link>
            <Link href="/posts" className="site-nav-link" onMouseMove={handleLinkMouseMove}>文章</Link>
            <Link href="/series" className="site-nav-link" onMouseMove={handleLinkMouseMove}>系列</Link>
            <Link href="/groups" className="site-nav-link" onMouseMove={handleLinkMouseMove}>圈子</Link>
            <Link href="/timeline" className="site-nav-link" onMouseMove={handleLinkMouseMove}>动态</Link>
            <Link href="/topics" className="site-nav-link" onMouseMove={handleLinkMouseMove}>话题</Link>
            <Link href="/tools" className="site-nav-link" onMouseMove={handleLinkMouseMove}>工具箱</Link>
            <Link href="/prompts" className="site-nav-link" onMouseMove={handleLinkMouseMove}>Prompt</Link>
            <Link href="/guestbook" className="site-nav-link" onMouseMove={handleLinkMouseMove}>留言墙</Link>
            <Link href="/uses" className="site-nav-link" onMouseMove={handleLinkMouseMove}>Uses</Link>
            <Link href="/links" className="site-nav-link" onMouseMove={handleLinkMouseMove}>友链</Link>
            <Link href="/archive" className="site-nav-link" onMouseMove={handleLinkMouseMove}>归档</Link>
            <Link href="/about" className="site-nav-link" onMouseMove={handleLinkMouseMove}>关于</Link>
            <SearchInput />
            <DarkModeToggle />
            {session && <NotificationBell />}
            {session ? (
              <UserMenu />
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link href="/login" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  登录
                </Link>
                <Link href="/register" className="px-3 py-1 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                  注册
                </Link>
              </div>
            )}
          </nav>

          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="打开菜单"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      <div className={`mobile-overlay ${menuOpen ? "open" : ""}`}>
        <button
          className="mobile-overlay-close"
          onClick={() => setMenuOpen(false)}
          aria-label="关闭菜单"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <Link href="/" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>首页</Link>
        <Link href="/posts" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>文章</Link>
        <Link href="/series" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>系列</Link>
        <Link href="/groups" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>圈子</Link>
        <Link href="/timeline" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>动态</Link>
        <Link href="/topics" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>话题</Link>
        <Link href="/tools" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>工具箱</Link>
        <Link href="/prompts" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>Prompt</Link>
        <Link href="/guestbook" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>留言墙</Link>
        <Link href="/uses" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>Uses</Link>
        <Link href="/links" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>友链</Link>
        <Link href="/archive" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>归档</Link>
        <Link href="/about" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>关于</Link>
        {session ? (
          <>
            <Link href="/posts/new" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>发布文章</Link>
            <Link href="/messages" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>私信</Link>
            <Link href="/bookmarks" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>我的收藏</Link>
            <Link href="/settings" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>设置</Link>
            <button className="mobile-overlay-link text-left" onClick={() => { signOut(); setMenuOpen(false); }}>退出</button>
          </>
        ) : (
          <>
            <Link href="/login" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>登录</Link>
            <Link href="/register" className="mobile-overlay-link" onClick={() => setMenuOpen(false)}>注册</Link>
          </>
        )}
      </div>
    </>
  );
}
