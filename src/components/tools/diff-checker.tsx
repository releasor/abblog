"use client";

import { useState, memo } from "react";

export default memo(function DiffChecker() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [diffResult, setDiffResult] = useState<{ line: string; type: "same" | "added" | "removed" }[]>([]);

  const compare = () => {
    const lines1 = text1.split("\n");
    const lines2 = text2.split("\n");
    const maxLen = Math.max(lines1.length, lines2.length);
    const result: { line: string; type: "same" | "added" | "removed" }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const l1 = lines1[i];
      const l2 = lines2[i];

      if (l1 === undefined) {
        result.push({ line: l2, type: "added" });
      } else if (l2 === undefined) {
        result.push({ line: l1, type: "removed" });
      } else if (l1 === l2) {
        result.push({ line: l1, type: "same" });
      } else {
        result.push({ line: l1, type: "removed" });
        result.push({ line: l2, type: "added" });
      }
    }

    setDiffResult(result);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={compare} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          对比
        </button>
        <button onClick={() => { setText1(""); setText2(""); setDiffResult([]); }} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          清空
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">文本 1</label>
          <textarea value={text1} onChange={(e) => setText1(e.target.value)} className="w-full h-48 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder="输入第一段文本..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">文本 2</label>
          <textarea value={text2} onChange={(e) => setText2(e.target.value)} className="w-full h-48 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder="输入第二段文本..." />
        </div>
      </div>
      {diffResult.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">对比结果</label>
          <div className="p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 max-h-64 overflow-auto">
            {diffResult.map((item, i) => (
              <div key={i} className={`px-2 py-0.5 ${item.type === "added" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : item.type === "removed" ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                <span className="inline-block w-4 text-zinc-400">{item.type === "added" ? "+" : item.type === "removed" ? "-" : " "}</span>
                {item.line || " "}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
