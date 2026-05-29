"use client";

import { useState, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const quotes = [
  { text: "AI 不会取代你，但会使用 AI 的人会取代你。", author: "佚名" },
  { text: "技术的意义在于让人回归生活本身。", author: "佚名" },
  { text: "简洁是复杂的极致。", author: "列奥纳多·达·芬奇" },
  { text: "最好的代码是不需要写的代码。", author: "Jeff Atwood" },
  { text: "工具是手的延伸，AI 是思维的延伸。", author: "佚名" },
  { text: "少即是多。", author: "密斯·凡·德·罗" },
  { text: "未来已来，只是分布不均。", author: "威廉·吉布森" },
  { text: "效率是做正确的事，效能是正确地做事。", author: "彼得·德鲁克" },
  { text: "不要用战术上的勤奋掩盖战略上的懒惰。", author: "雷军" },
  { text: "保持饥饿，保持愚蠢。", author: "史蒂夫·乔布斯" },
  { text: "好的设计是尽可能少的设计。", author: "迪特·拉姆斯" },
  { text: "代码是写给人看的，顺便能被机器执行。", author: "Harold Abelson" },
  { text: "数字极简主义不是拒绝技术，而是有意识地选择技术。", author: "Cal Newport" },
  { text: "每一个聪明的工具背后，都有一个更聪明的使用者。", author: "佚名" },
  { text: "简单是终极的复杂。", author: "列奥纳多·达·芬奇" },
];

export const DailyQuote = memo(function DailyQuote() {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i - 1 + quotes.length) % quotes.length);
  const next = () => setIndex((i) => (i + 1) % quotes.length);

  const quote = quotes[index];

  return (
    <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-6">
          每日一句
        </p>
        <blockquote className="mb-6">
          <p className="text-xl md:text-2xl font-light text-zinc-700 dark:text-zinc-300 leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <footer className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            —— {quote.author}
          </footer>
        </blockquote>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prev}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="上一句"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs text-zinc-400 tabular-nums">
            {index + 1} / {quotes.length}
          </span>
          <button
            onClick={next}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="下一句"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
});
