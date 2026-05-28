"use client";

import { memo, useCallback } from "react";

interface ShareButtonsProps {
  title: string;
  url: string;
  postId?: number;
}

const WeiboIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.739 5.443zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.86 1.791-.577.625.283.82.986.444 1.568zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.307-.361-.163-.592.138-.226.436-.346.672-.24.239.09.315.36.18.579zm.476-3.3c-1.823-.479-3.882.421-4.635 2.026-.769 1.636-.028 3.462 1.813 4.036 1.904.594 4.124-.322 4.86-2.014.724-1.669-.141-3.538-2.038-4.048z"/>
    <path d="M17.737 12.776c-.183-.479-.596-.711-.955-.579-.359.131-.49.579-.307 1.058.178.479.591.716.955.579.359-.131.49-.579.307-1.058zm-1.358-1.038c-.626-1.626-2.035-2.457-3.148-1.857-1.117.596-1.563 2.311-.937 3.936.626 1.626 2.035 2.457 3.148 1.857 1.117-.596 1.563-2.311.937-3.936z"/>
  </svg>
);

const TwitterIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const WechatIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 01.177-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.036 2.87c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.072 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
  </svg>
);

export const ShareButtons = memo(function ShareButtons({ title, url, postId }: ShareButtonsProps) {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  const trackShare = useCallback((platform: string) => {
    if (postId) {
      fetch(`/api/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      }).catch(() => {});
    }
  }, [postId]);

  const shareLinks = [
    { name: "微博", platform: "weibo", url: `https://service.weibo.com/share/share.php?title=${encodedTitle}&url=${encodedUrl}`, icon: WeiboIcon },
    { name: "Twitter", platform: "twitter", url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, icon: TwitterIcon },
    { name: "微信", platform: "wechat", url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`, icon: WechatIcon },
  ];

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(url);
    trackShare("copy");
  }, [url, trackShare]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">分享：</span>
      {shareLinks.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare(link.platform)}
          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          title={`分享到${link.name}`}
        >
          {link.icon}
        </a>
      ))}
      <button
        onClick={copyLink}
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        title="复制链接"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>
    </div>
  );
});
