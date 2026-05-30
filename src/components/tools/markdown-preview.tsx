"use client";

import { useState } from "react";

const renderMarkdown = (md: string) => {
  const html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  return `<p>${html}</p>`;
};

export default function MarkdownPreview() {
  const [input, setInput] = useState("# Hello World\n\n这是一段 **Markdown** 文本。\n\n- 列表项 1\n- 列表项 2\n\n```js\nconsole.log('hello');\n```");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Markdown</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-80 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">预览</label>
        <div
          className="w-full h-80 p-3 overflow-auto border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(input) }}
        />
      </div>
    </div>
  );
}
