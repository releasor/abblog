"use client";

import { useState, memo } from "react";
import { useCopyWithId } from "@/hooks/use-copy";

const COMMON_SIZES = [12, 14, 16, 18, 20, 24, 32, 48, 64];

export default memo(function CssUnitConverter() {
  const [px, setPx] = useState("16");
  const [baseSize, setBaseSize] = useState("16");
  const [viewportWidth, setViewportWidth] = useState("1920");
  const { copiedId, copy } = useCopyWithId<string>();

  const pxVal = parseFloat(px) || 0;
  const base = parseFloat(baseSize) || 16;
  const vw = parseFloat(viewportWidth) || 1920;

  const rem = pxVal / base;
  const em = pxVal / base;
  const vwVal = (pxVal / vw) * 100;
  const vhVal = (pxVal / (vw * 9 / 16)) * 100;
  const pt = pxVal * 0.75;
  const percent = (pxVal / base) * 100;

  const results = [
    { unit: "px", value: pxVal, label: "像素" },
    { unit: "rem", value: rem, label: "根元素相对单位" },
    { unit: "em", value: em, label: "父元素相对单位" },
    { unit: "%", value: percent, label: "百分比" },
    { unit: "vw", value: vwVal, label: "视口宽度" },
    { unit: "vh", value: vhVal, label: "视口高度" },
    { unit: "pt", value: pt, label: "磅" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="css-px" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">像素值 (px)</label>
          <input
            id="css-px"
            value={px}
            onChange={(e) => setPx(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="css-base" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">根字体大小 (px)</label>
          <input
            id="css-base"
            value={baseSize}
            onChange={(e) => setBaseSize(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="css-vw" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">视口宽度 (px)</label>
          <input
            id="css-vw"
            value={viewportWidth}
            onChange={(e) => setViewportWidth(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {results.map((r) => (
          <button
            key={r.unit}
            onClick={() => copy(`${parseFloat(r.value.toFixed(4))}${r.unit === "%" ? "%" : r.unit}`, r.unit)}
            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-left"
          >
            <div>
              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {parseFloat(r.value.toFixed(4))}{r.unit === "%" ? "%" : r.unit}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-3">{r.label}</span>
            </div>
            <span className="text-xs text-zinc-400">{copiedId === r.unit ? "已复制!" : "点击复制"}</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">常用尺寸</h3>
        <div className="flex flex-wrap gap-2">
          {COMMON_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setPx(String(s))}
              className="px-3 py-1.5 text-sm font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {s}px
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
