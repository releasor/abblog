"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";

export default memo(function QRCodeGenerator() {
  const [text, setText] = useState("https://example.com");
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#000000";
    const cellSize = 8;
    const grid = Math.floor(size / cellSize);

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    const drawFinder = (x: number, y: number) => {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          if (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)) {
            ctx.fillRect((x + dx) * cellSize, (y + dy) * cellSize, cellSize, cellSize);
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(grid - 7, 0);
    drawFinder(0, grid - 7);

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if ((x < 8 && y < 8) || (x >= grid - 8 && y < 8) || (x < 8 && y >= grid - 8)) continue;
        const bit = (hash >> ((x * 31 + y * 17) % 31)) & 1;
        if (bit) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    setCanvasReady(true);
  }, [text]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="qr-content" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">内容</label>
        <input
          id="qr-content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          placeholder="输入网址或文本..."
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-white rounded-xl border border-zinc-200 dark:border-zinc-700">
          <canvas ref={canvasRef} className="block" />
        </div>
        {canvasReady && (
          <button onClick={download} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            下载二维码
          </button>
        )}
      </div>
    </div>
  );
});
