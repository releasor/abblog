"use client";

import { useState, memo } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy";

export default memo(function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const { copied, setCopied, copy } = useCopyToClipboard();

  const generate = () => {
    let chars = "";
    if (useUpper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (useLower) chars += "abcdefghijklmnopqrstuvwxyz";
    if (useNumbers) chars += "0123456789";
    if (useSymbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
    if (!chars) { setPassword("请至少选择一种字符类型"); return; }

    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    setPassword(Array.from(arr, (x) => chars[x % chars.length]).join(""));
    setCopied(false);
  };

  const getStrength = () => {
    let poolSize = 0;
    if (useUpper) poolSize += 26;
    if (useLower) poolSize += 26;
    if (useNumbers) poolSize += 10;
    if (useSymbols) poolSize += 29;
    const entropy = length * Math.log2(poolSize || 1);
    if (entropy < 28) return { label: "弱", color: "text-red-500" };
    if (entropy < 50) return { label: "中", color: "text-yellow-500" };
    if (entropy < 70) return { label: "强", color: "text-green-500" };
    return { label: "非常强", color: "text-emerald-500" };
  };

  const strength = getStrength();

  return (
    <div className="space-y-6">
      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-lg text-zinc-900 dark:text-zinc-100 break-all">{password || "点击生成按钮"}</span>
        </div>
        {password && (
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-sm font-medium ${strength.color}`}>强度: {strength.label}</span>
            <button onClick={() => copy(password)} className="ml-auto px-3 py-1 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">长度: {length}</label>
          <input type="range" min="4" max="64" value={length} onChange={(e) => setLength(+e.target.value)} className="w-full" />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} className="rounded" /> 大写字母
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} className="rounded" /> 小写字母
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} className="rounded" /> 数字
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} className="rounded" /> 特殊符号
          </label>
        </div>
        <button onClick={generate} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          生成密码
        </button>
      </div>
    </div>
  );
});
