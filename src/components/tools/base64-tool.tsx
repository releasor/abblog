"use client";

import { useState, memo } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy";

export default memo(function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [error, setError] = useState("");
  const { copied, copy } = useCopyToClipboard();

  const process = () => {
    try {
      if (mode === "encode") {
        const bytes = new TextEncoder().encode(input);
        const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
        setOutput(btoa(binary));
      } else {
        const binary = atob(input);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        setOutput(new TextDecoder().decode(bytes));
      }
      setError("");
    } catch {
      setError(mode === "decode" ? "无效的 Base64 字符串" : "编码失败");
      setOutput("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("encode")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${mode === "encode" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
        >
          编码
        </button>
        <button
          onClick={() => setMode("decode")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${mode === "decode" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
        >
          解码
        </button>
        <button onClick={process} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          转换
        </button>
        <button onClick={() => copy(output)} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          {copied ? "已复制!" : "复制结果"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="b64-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输入</label>
          <textarea id="b64-input" value={input} onChange={(e) => setInput(e.target.value)} className="w-full h-48 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 resize-none" placeholder={mode === "encode" ? "输入要编码的文本..." : "输入 Base64 字符串..."} />
        </div>
        <div>
          <label htmlFor="b64-output" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输出</label>
          <textarea id="b64-output" value={error || output} readOnly className={`w-full h-48 p-3 font-mono text-sm border rounded-lg resize-none focus:outline-none ${error ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"}`} />
        </div>
      </div>
    </div>
  );
});
