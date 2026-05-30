"use client";

import { useState, useEffect } from "react";
import { useCopyWithId } from "@/hooks/use-copy";

export default function TimestampConverter() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [inputTs, setInputTs] = useState("");
  const [inputDate, setInputDate] = useState("");
  const [tsResult, setTsResult] = useState("");
  const [dateResult, setDateResult] = useState("");
  const [unit, setUnit] = useState<"s" | "ms">("s");
  const { copiedId, copy } = useCopyWithId<string>();

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const tsToDate = () => {
    const ts = parseInt(inputTs);
    if (isNaN(ts)) { setTsResult("请输入有效时间戳"); return; }
    const ms = unit === "s" ? ts * 1000 : ts;
    const d = new Date(ms);
    if (isNaN(d.getTime())) { setTsResult("无效时间戳"); return; }
    setTsResult(
      `本地时间: ${d.toLocaleString("zh-CN")}\n` +
      `UTC 时间: ${d.toUTCString()}\n` +
      `ISO 格式: ${d.toISOString()}\n` +
      `秒级时间戳: ${Math.floor(d.getTime() / 1000)}\n` +
      `毫秒时间戳: ${d.getTime()}`
    );
  };

  const dateToTs = () => {
    if (!inputDate) { setDateResult("请输入日期时间"); return; }
    const d = new Date(inputDate);
    if (isNaN(d.getTime())) { setDateResult("无效日期格式"); return; }
    setDateResult(
      `秒级时间戳: ${Math.floor(d.getTime() / 1000)}\n` +
      `毫秒时间戳: ${d.getTime()}\n` +
      `ISO 格式: ${d.toISOString()}\n` +
      `本地时间: ${d.toLocaleString("zh-CN")}`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">当前时间戳</span>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{now}</div>
        </div>
        <button
          onClick={() => copy(String(now), "timestamp")}
          className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          {copiedId === "timestamp" ? "已复制!" : "复制"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">时间戳 → 日期</h3>
          <div className="flex gap-2">
            <input
              value={inputTs}
              onChange={(e) => setInputTs(e.target.value)}
              placeholder="输入时间戳"
              className="flex-1 px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as "s" | "ms")}
              className="px-2 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            >
              <option value="s">秒</option>
              <option value="ms">毫秒</option>
            </select>
            <button
              onClick={tsToDate}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              转换
            </button>
          </div>
          {tsResult && (
            <pre className="p-3 text-sm font-mono whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300">
              {tsResult}
            </pre>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">日期 → 时间戳</h3>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            <button
              onClick={dateToTs}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              转换
            </button>
          </div>
          {dateResult && (
            <pre className="p-3 text-sm font-mono whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300">
              {dateResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
