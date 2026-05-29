import type { Metadata } from "next";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "我的装备",
  description: "我日常使用的设备、软件和工具",
};

interface ToolItem {
  name: string;
  description: string;
  url?: string;
}

interface ToolCategory {
  title: string;
  icon: string;
  items: ToolItem[];
}

const categories: ToolCategory[] = [
  {
    title: "开发工具",
    icon: "💻",
    items: [
      { name: "VS Code", description: "主力编辑器，轻量且扩展丰富", url: "https://code.visualstudio.com/" },
      { name: "Cursor", description: "AI 辅助编码，提高开发效率", url: "https://cursor.sh/" },
      { name: "WebStorm", description: "大型项目使用的 IDE", url: "https://www.jetbrains.com/webstorm/" },
      { name: "Warp", description: "现代化终端，AI 命令补全", url: "https://www.warp.dev/" },
    ],
  },
  {
    title: "前端框架",
    icon: "🎨",
    items: [
      { name: "Next.js", description: "React 全栈框架，SSR/SSG 支持", url: "https://nextjs.org/" },
      { name: "Tailwind CSS", description: "原子化 CSS，快速构建 UI", url: "https://tailwindcss.com/" },
      { name: "TypeScript", description: "类型安全的 JavaScript", url: "https://www.typescriptlang.org/" },
      { name: "Framer Motion", description: "React 动画库", url: "https://www.framer.com/motion/" },
    ],
  },
  {
    title: "AI 工具",
    icon: "🤖",
    items: [
      { name: "Claude", description: "AI 助手，代码和写作", url: "https://claude.ai/" },
      { name: "ChatGPT", description: "通用 AI 对话", url: "https://chat.openai.com/" },
      { name: "Midjourney", description: "AI 图像生成", url: "https://www.midjourney.com/" },
      { name: "Cursor", description: "AI 编程助手", url: "https://cursor.sh/" },
    ],
  },
  {
    title: "设计工具",
    icon: "🎯",
    items: [
      { name: "Figma", description: "UI/UX 设计，团队协作", url: "https://www.figma.com/" },
      { name: "Excalidraw", description: "手绘风格白板", url: "https://excalidraw.com/" },
      { name: "Raycast", description: "效率启动器", url: "https://www.raycast.com/" },
    ],
  },
  {
    title: "生产力",
    icon: "⚡",
    items: [
      { name: "Notion", description: "知识管理和笔记", url: "https://www.notion.so/" },
      { name: "Obsidian", description: "本地 Markdown 笔记", url: "https://obsidian.md/" },
      { name: "Arc Browser", description: "重新设计的浏览器", url: "https://arc.net/" },
      { name: "1Password", description: "密码管理器", url: "https://1password.com/" },
    ],
  },
  {
    title: "硬件",
    icon: "🖥️",
    items: [
      { name: "MacBook Pro 14\"", description: "M3 Pro，18GB 内存", url: "https://www.apple.com/macbook-pro/" },
      { name: "LG 27UK850", description: "4K 显示器，Type-C 供电", url: "https://www.lg.com/" },
      { name: "Keychron Q1", description: "机械键盘，Gateron 红轴", url: "https://www.keychron.com/" },
      { name: "Logitech MX Master 3S", description: "人体工学鼠标", url: "https://www.logitech.com/" },
    ],
  },
];

export default function UsesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          我的装备
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          我日常使用的设备、软件和工具。灵感来自{" "}
          <a
            href="https://uses.tech/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            uses.tech
          </a>
        </p>
      </header>

      <div className="grid gap-8">
        {categories.map((category) => (
          <section key={category.title}>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <span>{category.icon}</span>
              {category.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {category.items.map((item) => (
                <div
                  key={item.name}
                  className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                      >
                        {item.name}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
