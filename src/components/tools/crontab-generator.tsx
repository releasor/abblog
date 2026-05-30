"use client";

import { useState } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy";

const PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天零点", value: "0 0 * * *" },
  { label: "每天上午9点", value: "0 9 * * *" },
  { label: "每周一上午9点", value: "0 9 * * 1" },
  { label: "每月1号零点", value: "0 0 1 * *" },
  { label: "每5分钟", value: "*/5 * * * *" },
  { label: "工作日上午9点", value: "0 9 * * 1-5" },
];

export default function CrontabGenerator() {
  const [minute, setMinute] = useState("*");
  const [hour, setHour] = useState("*");
  const [day, setDay] = useState("*");
  const [month, setMonth] = useState("*");
  const [weekday, setWeekday] = useState("*");
  const { copied, copy } = useCopyToClipboard();

  const cron = `${minute} ${hour} ${day} ${month} ${weekday}`;

  const describe = () => {
    const parts: string[] = [];
    if (minute === "*") parts.push("每分钟");
    else if (minute.startsWith("*/")) parts.push(`每${minute.slice(2)}分钟`);
    else parts.push(`第${minute}分钟`);

    if (hour === "*") parts.push("每小时");
    else if (hour.startsWith("*/")) parts.push(`每${hour.slice(2)}小时`);
    else parts.push(`${hour}时`);

    if (day !== "*") parts.push(`${day}日`);
    if (month !== "*") parts.push(`${month}月`);
    if (weekday === "1-5") parts.push("工作日");
    else if (weekday !== "*") parts.push(`星期${weekday}`);

    return parts.join("，");
  };

  const applyPreset = (value: string) => {
    const [m, h, d, mo, w] = value.split(" ");
    setMinute(m);
    setHour(h);
    setDay(d);
    setMonth(mo);
    setWeekday(w);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "分钟", value: minute, set: setMinute, placeholder: "0-59" },
          { label: "小时", value: hour, set: setHour, placeholder: "0-23" },
          { label: "日", value: day, set: setDay, placeholder: "1-31" },
          { label: "月", value: month, set: setMonth, placeholder: "1-12" },
          { label: "星期", value: weekday, set: setWeekday, placeholder: "0-7" },
        ].map((field) => (
          <div key={field.label}>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{field.label}</label>
            <input
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 font-mono text-sm text-center border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
        ))}
      </div>

      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Cron 表达式</span>
            <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{cron}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{describe()}</div>
          </div>
          <button onClick={() => copy(cron)} className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">常用预设</h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.value)}
              className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
