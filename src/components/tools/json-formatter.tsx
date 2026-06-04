"use client";

import { useState, memo } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { getErrorMessage } from "@/lib/api-utils";

export default memo(function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const { copied, copy } = useCopyToClipboard();

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (e) {
      setError(getErrorMessage(e));
      setOutput("");
    }
  };

  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError("");
    } catch (e) {
      setError(getErrorMessage(e));
      setOutput("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={format} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          格式化
        </button>
        <button onClick={minify} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          压缩
        </button>
        <button onClick={() => copy(output)} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          {copied ? "已复制!" : "复制结果"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="json-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输入</label>
          <textarea
            id="json-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-80 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 resize-none"
            placeholder='{"key": "value"}'
          />
        </div>
        <div>
          <label htmlFor="json-output" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输出</label>
          <textarea
            id="json-output"
            value={error || output}
            readOnly
            className={`w-full h-80 p-3 font-mono text-sm border rounded-lg resize-none focus:outline-none ${
              error
                ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            }`}
          />
        </div>
      </div>
    </div>
  );
});
