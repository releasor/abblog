import type { Metadata } from "next";
import Image from "next/image";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "友情链接",
  description: "推荐的博客和网站",
};

interface FriendLink {
  name: string;
  description: string;
  url: string;
  avatar: string;
}

const friends: FriendLink[] = [
  {
    name: "阮一峰的网络日志",
    description: "科技爱好者，关注 JavaScript、人工智能等领域",
    url: "https://www.ruanyifeng.com/blog/",
    avatar: "https://www.ruanyifeng.com/blog/images/person2_s.jpg",
  },
  {
    name: "张鑫旭",
    description: "前端开发工程师，CSS 专家",
    url: "https://www.zhangxinxu.com/",
    avatar: "https://www.zhangxinxu.com/wp-content/themes/TinySheep/images/avatar.png",
  },
  {
    name: "Anthony Fu",
    description: "开源开发者，Vue/Vite 核心团队成员",
    url: "https://antfu.me/",
    avatar: "https://antfu.me/avatar.png",
  },
  {
    name: "Lee Robinson",
    description: "Vercel 前端框架副总裁",
    url: "https://leerob.io/",
    avatar: "https://leerob.io/api/avatar",
  },
  {
    name: "Josh Comeau",
    description: "互动式 CSS 和 React 教程",
    url: "https://www.joshwcomeau.com/",
    avatar: "https://www.joshwcomeau.com/favicon.png",
  },
  {
    name: "Dan Abramov",
    description: "React 核心团队，Redux 作者",
    url: "https://overreacted.io/",
    avatar: "https://overreacted.io/favicon.ico",
  },
  {
    name: "Prizm",
    description: "PrizmTeam: coding helps everyone",
    url: "https://github.com/lone-yu-cmd",
    avatar: "https://avatars.githubusercontent.com/u/60804333?v=4",
  },
];

export default function LinksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          友情链接
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          推荐的技术博客和值得关注的网站
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {friends.map((friend) => (
          <a
            key={friend.name}
            href={friend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all group"
          >
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
              <Image
                src={friend.avatar}
                alt={friend.name}
                fill
                className="object-cover"
                sizes="48px"
                loading="lazy"
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:underline">
                {friend.name}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                {friend.description}
              </p>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          申请友链
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          如果你也有技术博客，欢迎通过{" "}
          <a href="/guestbook" className="text-zinc-900 dark:text-zinc-100 underline underline-offset-4">
            留言墙
          </a>{" "}
          申请交换链接。请提供：博客名称、简介和头像链接。
        </p>
      </div>
    </div>
  );
}
