"use client";

import { useState, memo } from "react";
import { getErrorMessage } from "@/lib/api-utils";

export default memo(function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [testStr, setTestStr] = useState("");
  const [matches, setMatches] = useState<string[]>([]);
  const [error, setError] = useState("");

  const test = () => {
    try {
      const regex = new RegExp(pattern, flags);
      const found = testStr.match(regex) || [];
      setMatches(found);
      setError("");
    } catch (e) {
      setError(getErrorMessage(e));
      setMatches([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="regex-pattern" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">正则表达式</label>
          <div className="flex gap-2">
            <span className="px-3 py-2 text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg">/</span>
            <input
              id="regex-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="flex-1 px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
              placeholder="[a-z]+"
            />
            <span className="px-3 py-2 text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg">/</span>
            <input
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="w-16 px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            />
          </div>
        </div>
        <div className="flex items-end">
          <button onClick={test} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            测试
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="regex-test-str" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">测试字符串</label>
        <textarea
          id="regex-test-str"
          value={testStr}
          onChange={(e) => setTestStr(e.target.value)}
          className="w-full h-40 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 resize-none"
          placeholder="输入要测试的文本..."
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {matches.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            匹配结果 ({matches.length} 个)
          </label>
          <div className="flex flex-wrap gap-2">
            {matches.map((m, i) => (
              <span key={i} className="px-2 py-1 text-sm font-mono bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
