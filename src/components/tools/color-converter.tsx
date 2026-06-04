"use client";

import { useState, memo } from "react";
import { useCopyWithId } from "@/hooks/use-copy";

export default memo(function ColorConverter() {
  const [hex, setHex] = useState("#3b82f6");
  const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });
  const [hsl, setHsl] = useState({ h: 217, s: 91, l: 60 });
  const { copiedId, copy } = useCopyWithId<string>();

  const hexToRgb = (h: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!result?.[1] || !result[2] || !result[3]) return null;
    return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) };
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

  const updateFromHex = (val: string) => {
    setHex(val);
    const c = hexToRgb(val);
    if (c) { setRgb(c); setHsl(rgbToHsl(c.r, c.g, c.b)); }
  };

  const updateFromRgb = (r: number, g: number, b: number) => {
    const clamped = { r: Math.min(255, Math.max(0, r)), g: Math.min(255, Math.max(0, g)), b: Math.min(255, Math.max(0, b)) };
    setRgb(clamped);
    setHex(rgbToHex(clamped.r, clamped.g, clamped.b));
    setHsl(rgbToHsl(clamped.r, clamped.g, clamped.b));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div
          className="w-32 h-32 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-inner"
          style={{ backgroundColor: hex }}
        />
        <div className="space-y-3">
          <button onClick={() => copy(hex, "HEX")} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            {copiedId === "HEX" ? "已复制!" : `HEX: ${hex}`}
          </button>
          <button onClick={() => copy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, "RGB")} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            {copiedId === "RGB" ? "已复制!" : `RGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
          </button>
          <button onClick={() => copy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, "HSL")} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            {copiedId === "HSL" ? "已复制!" : `HSL: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="color-hex" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">HEX</label>
          <input
            id="color-hex"
            value={hex}
            onChange={(e) => updateFromHex(e.target.value)}
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="color-r" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">RGB</label>
          <div className="flex gap-1">
            {(["r", "g", "b"] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                value={rgb[ch]}
                onChange={(e) => updateFromRgb(ch === "r" ? +e.target.value : rgb.r, ch === "g" ? +e.target.value : rgb.g, ch === "b" ? +e.target.value : rgb.b)}
                className="w-full px-2 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
              />
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="color-h" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">HSL</label>
          <div className="flex gap-1">
            {(["h", "s", "l"] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                value={hsl[ch]}
                readOnly
                className="w-full px-2 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
