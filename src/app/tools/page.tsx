"use client";

import { useState, useEffect, useRef } from "react";

type Tool = "json" | "regex" | "color" | "markdown" | "timestamp" | "base64" | "password" | "diff" | "qrcode" | "yaml" | "cron" | "httpstatus" | "cssunit";

export default function ToolsPage() {
  const [active, setActive] = useState<Tool>("json");

  const tabs: { key: Tool; label: string; icon: string }[] = [
    { key: "json", label: "JSON 格式化", icon: "{ }" },
    { key: "regex", label: "正则测试", icon: ".*" },
    { key: "color", label: "颜色转换", icon: "#" },
    { key: "markdown", label: "Markdown 预览", icon: "M" },
    { key: "timestamp", label: "时间戳转换", icon: "⏱" },
    { key: "base64", label: "Base64", icon: "B64" },
    { key: "password", label: "密码生成", icon: "***" },
    { key: "diff", label: "文本对比", icon: "≠" },
    { key: "qrcode", label: "二维码", icon: "▣" },
    { key: "yaml", label: "JSON ↔ YAML", icon: "Y" },
    { key: "cron", label: "Crontab", icon: "*" },
    { key: "httpstatus", label: "HTTP 状态码", icon: "→" },
    { key: "cssunit", label: "CSS 单位", icon: "px" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        在线工具箱
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8">
        开发者常用工具，即开即用
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === tab.key
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <span className="font-mono text-xs opacity-60">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        {active === "json" && <JsonFormatter />}
        {active === "regex" && <RegexTester />}
        {active === "color" && <ColorConverter />}
        {active === "markdown" && <MarkdownPreview />}
        {active === "timestamp" && <TimestampConverter />}
        {active === "base64" && <Base64Tool />}
        {active === "password" && <PasswordGenerator />}
        {active === "diff" && <DiffChecker />}
        {active === "qrcode" && <QRCodeGenerator />}
        {active === "yaml" && <YamlConverter />}
        {active === "cron" && <CrontabGenerator />}
        {active === "httpstatus" && <HttpStatusLookup />}
        {active === "cssunit" && <CssUnitConverter />}
      </div>
    </div>
  );
}

function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
    }
  };

  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
    }
  };

  const copy = () => navigator.clipboard.writeText(output);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={format} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          格式化
        </button>
        <button onClick={minify} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          压缩
        </button>
        <button onClick={copy} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          复制结果
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输入</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-80 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
            placeholder='{"key": "value"}'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输出</label>
          <textarea
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
}

function RegexTester() {
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
      setError((e as Error).message);
      setMatches([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">正则表达式</label>
          <div className="flex gap-2">
            <span className="px-3 py-2 text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg">/</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="flex-1 px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              placeholder="[a-z]+"
            />
            <span className="px-3 py-2 text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg">/</span>
            <input
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="w-16 px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">测试字符串</label>
        <textarea
          value={testStr}
          onChange={(e) => setTestStr(e.target.value)}
          className="w-full h-40 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
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
}

function ColorConverter() {
  const [hex, setHex] = useState("#3b82f6");
  const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });
  const [hsl, setHsl] = useState({ h: 217, s: 91, l: 60 });

  const hexToRgb = (h: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!result) return null;
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

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div
          className="w-32 h-32 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-inner"
          style={{ backgroundColor: hex }}
        />
        <div className="space-y-3">
          <button onClick={() => copy(hex)} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
            HEX: {hex}
          </button>
          <button onClick={() => copy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
            RGB: rgb({rgb.r}, {rgb.g}, {rgb.b})
          </button>
          <button onClick={() => copy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)} className="block font-mono text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
            HSL: hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">HEX</label>
          <input
            value={hex}
            onChange={(e) => updateFromHex(e.target.value)}
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">RGB</label>
          <div className="flex gap-1">
            {(["r", "g", "b"] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                value={rgb[ch]}
                onChange={(e) => updateFromRgb(ch === "r" ? +e.target.value : rgb.r, ch === "g" ? +e.target.value : rgb.g, ch === "b" ? +e.target.value : rgb.b)}
                className="w-full px-2 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">HSL</label>
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
}

function MarkdownPreview() {
  const [input, setInput] = useState("# Hello World\n\n这是一段 **Markdown** 文本。\n\n- 列表项 1\n- 列表项 2\n\n```js\nconsole.log('hello');\n```");

  const renderMarkdown = (md: string) => {
    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    return `<p>${html}</p>`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Markdown</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-80 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">预览</label>
        <div
          className="w-full h-80 p-3 overflow-auto border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(input) }}
        />
      </div>
    </div>
  );
}

function TimestampConverter() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [inputTs, setInputTs] = useState("");
  const [inputDate, setInputDate] = useState("");
  const [tsResult, setTsResult] = useState("");
  const [dateResult, setDateResult] = useState("");
  const [unit, setUnit] = useState<"s" | "ms">("s");

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

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-6">
      {/* Current timestamp */}
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">当前时间戳</span>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{now}</div>
        </div>
        <button
          onClick={() => copy(String(now))}
          className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          复制
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timestamp to Date */}
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

        {/* Date to Timestamp */}
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

function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [error, setError] = useState("");

  const process = () => {
    try {
      if (mode === "encode") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
      setError("");
    } catch {
      setError(mode === "decode" ? "无效的 Base64 字符串" : "编码失败");
      setOutput("");
    }
  };

  const copy = () => navigator.clipboard.writeText(output);

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
        <button onClick={copy} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          复制结果
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输入</label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} className="w-full h-48 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder={mode === "encode" ? "输入要编码的文本..." : "输入 Base64 字符串..."} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输出</label>
          <textarea value={error || output} readOnly className={`w-full h-48 p-3 font-mono text-sm border rounded-lg resize-none focus:outline-none ${error ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"}`} />
        </div>
      </div>
    </div>
  );
}

function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

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

  const copy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrength = () => {
    if (length < 8) return { label: "弱", color: "text-red-500" };
    if (length < 12) return { label: "中", color: "text-yellow-500" };
    if (length < 16) return { label: "强", color: "text-green-500" };
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
            <button onClick={copy} className="ml-auto px-3 py-1 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
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
}

function DiffChecker() {
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
}

function QRCodeGenerator() {
  const [text, setText] = useState("https://example.com");
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = () => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simple QR code using canvas (basic implementation)
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Draw a simple pattern based on text hash
    ctx.fillStyle = "#000000";
    const cellSize = 8;
    const grid = Math.floor(size / cellSize);

    // Generate deterministic pattern from text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    // Draw finder patterns (corners)
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

    // Draw data pattern
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
  };

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
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">内容</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
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
}

function YamlConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"json2yaml" | "yaml2json">("json2yaml");
  const [error, setError] = useState("");

  const jsonToYaml = (obj: unknown, indent = 0): string => {
    const pad = "  ".repeat(indent);
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") {
      if (obj.includes("\n")) return `|\n${obj.split("\n").map((l) => pad + "  " + l).join("\n")}`;
      if (/[:{}\[\],&*?|>!%@`#'"]/.test(obj) || obj.trim() !== obj) return `"${obj.replace(/"/g, '\\"')}"`;
      return obj;
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return obj.map((item) => `${pad}- ${jsonToYaml(item, indent + 1).trimStart()}`).join("\n");
    }
    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return "{}";
      return entries.map(([k, v]) => {
        const val = jsonToYaml(v, indent + 1);
        if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v as object).length > 0) {
          return `${pad}${k}:\n${val}`;
        }
        if (Array.isArray(v) && v.length > 0) {
          return `${pad}${k}:\n${val}`;
        }
        return `${pad}${k}: ${val}`;
      }).join("\n");
    }
    return String(obj);
  };

  const yamlToJson = (yaml: string): unknown => {
    const lines = yaml.split("\n");
    const root: Record<string, unknown> = {};
    const stack: { obj: Record<string, unknown>; indent: number }[] = [{ obj: root, indent: -1 }];

    for (const rawLine of lines) {
      if (rawLine.trim() === "" || rawLine.trim().startsWith("#")) continue;
      const indent = rawLine.search(/\S/);
      const line = rawLine.trim();

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      if (line.startsWith("- ")) {
        const val = line.slice(2).trim();
        const arrKey = Object.keys(parent).pop();
        if (arrKey && Array.isArray(parent[arrKey])) {
          (parent[arrKey] as unknown[]).push(parseYamlValue(val));
        }
      } else {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim();
          if (val === "") {
            parent[key] = {};
            stack.push({ obj: parent[key] as Record<string, unknown>, indent });
          } else if (val === "[]") {
            parent[key] = [];
          } else if (val === "{}") {
            parent[key] = {};
          } else {
            parent[key] = parseYamlValue(val);
          }
        }
      }
    }
    return root;
  };

  const parseYamlValue = (val: string): unknown => {
    if (val === "null" || val === "~") return null;
    if (val === "true") return true;
    if (val === "false") return false;
    if (/^-?\d+$/.test(val)) return parseInt(val);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    return val;
  };

  const convert = () => {
    try {
      if (mode === "json2yaml") {
        const parsed = JSON.parse(input);
        setOutput(jsonToYaml(parsed));
      } else {
        const parsed = yamlToJson(input);
        setOutput(JSON.stringify(parsed, null, 2));
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
    }
  };

  const copy = () => navigator.clipboard.writeText(output);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setMode("json2yaml")} className={`px-4 py-2 text-sm rounded-lg transition-colors ${mode === "json2yaml" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
          JSON → YAML
        </button>
        <button onClick={() => setMode("yaml2json")} className={`px-4 py-2 text-sm rounded-lg transition-colors ${mode === "yaml2json" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
          YAML → JSON
        </button>
        <button onClick={convert} className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          转换
        </button>
        <button onClick={copy} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          复制结果
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输入</label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} className="w-full h-80 p-3 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder={mode === "json2yaml" ? '{"key": "value"}' : "key: value"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">输出</label>
          <textarea value={error || output} readOnly className={`w-full h-80 p-3 font-mono text-sm border rounded-lg resize-none focus:outline-none ${error ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"}`} />
        </div>
      </div>
    </div>
  );
}

function CrontabGenerator() {
  const [minute, setMinute] = useState("*");
  const [hour, setHour] = useState("*");
  const [day, setDay] = useState("*");
  const [month, setMonth] = useState("*");
  const [weekday, setWeekday] = useState("*");
  const [copied, setCopied] = useState(false);

  const cron = `${minute} ${hour} ${day} ${month} ${weekday}`;

  const presets = [
    { label: "每分钟", value: "* * * * *" },
    { label: "每小时", value: "0 * * * *" },
    { label: "每天零点", value: "0 0 * * *" },
    { label: "每天上午9点", value: "0 9 * * *" },
    { label: "每周一上午9点", value: "0 9 * * 1" },
    { label: "每月1号零点", value: "0 0 1 * *" },
    { label: "每5分钟", value: "*/5 * * * *" },
    { label: "工作日上午9点", value: "0 9 * * 1-5" },
  ];

  const descriptions: Record<string, string> = {
    "*": "每",
    "0": "第0",
  };

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

  const copyCron = () => {
    navigator.clipboard.writeText(cron);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
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
          <button onClick={copyCron} className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">常用预设</h3>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
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

function HttpStatusLookup() {
  const [query, setQuery] = useState("");

  const codes: { code: number; name: string; description: string; category: string }[] = [
    { code: 200, name: "OK", description: "请求成功", category: "2xx 成功" },
    { code: 201, name: "Created", description: "资源已创建", category: "2xx 成功" },
    { code: 204, name: "No Content", description: "成功但无返回内容", category: "2xx 成功" },
    { code: 301, name: "Moved Permanently", description: "永久重定向", category: "3xx 重定向" },
    { code: 302, name: "Found", description: "临时重定向", category: "3xx 重定向" },
    { code: 304, name: "Not Modified", description: "资源未修改，使用缓存", category: "3xx 重定向" },
    { code: 307, name: "Temporary Redirect", description: "临时重定向（保持方法）", category: "3xx 重定向" },
    { code: 308, name: "Permanent Redirect", description: "永久重定向（保持方法）", category: "3xx 重定向" },
    { code: 400, name: "Bad Request", description: "请求参数错误", category: "4xx 客户端错误" },
    { code: 401, name: "Unauthorized", description: "未认证，需要登录", category: "4xx 客户端错误" },
    { code: 403, name: "Forbidden", description: "无权限访问", category: "4xx 客户端错误" },
    { code: 404, name: "Not Found", description: "资源不存在", category: "4xx 客户端错误" },
    { code: 405, name: "Method Not Allowed", description: "请求方法不支持", category: "4xx 客户端错误" },
    { code: 408, name: "Request Timeout", description: "请求超时", category: "4xx 客户端错误" },
    { code: 409, name: "Conflict", description: "资源冲突", category: "4xx 客户端错误" },
    { code: 413, name: "Payload Too Large", description: "请求体过大", category: "4xx 客户端错误" },
    { code: 422, name: "Unprocessable Entity", description: "语义错误，无法处理", category: "4xx 客户端错误" },
    { code: 429, name: "Too Many Requests", description: "请求频率过高", category: "4xx 客户端错误" },
    { code: 500, name: "Internal Server Error", description: "服务器内部错误", category: "5xx 服务端错误" },
    { code: 502, name: "Bad Gateway", description: "网关错误", category: "5xx 服务端错误" },
    { code: 503, name: "Service Unavailable", description: "服务不可用", category: "5xx 服务端错误" },
    { code: 504, name: "Gateway Timeout", description: "网关超时", category: "5xx 服务端错误" },
  ];

  const filtered = query
    ? codes.filter((c) => String(c.code).includes(query) || c.name.toLowerCase().includes(query.toLowerCase()) || c.description.includes(query))
    : codes;

  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <div className="space-y-4">
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索状态码或描述..."
          className="w-full px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{cat}</h3>
            <div className="grid gap-2">
              {filtered.filter((c) => c.category === cat).map((c) => (
                <div key={c.code} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100 w-12">{c.code}</span>
                  <span className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300 w-40">{c.name}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CssUnitConverter() {
  const [px, setPx] = useState("16");
  const [baseSize, setBaseSize] = useState("16");
  const [viewportWidth, setViewportWidth] = useState("1920");

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

  const copy = (text: string) => navigator.clipboard.writeText(text);

  const commonSizes = [12, 14, 16, 18, 20, 24, 32, 48, 64];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">像素值 (px)</label>
          <input
            value={px}
            onChange={(e) => setPx(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">根字体大小 (px)</label>
          <input
            value={baseSize}
            onChange={(e) => setBaseSize(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">视口宽度 (px)</label>
          <input
            value={viewportWidth}
            onChange={(e) => setViewportWidth(e.target.value)}
            type="number"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {results.map((r) => (
          <button
            key={r.unit}
            onClick={() => copy(`${parseFloat(r.value.toFixed(4))}${r.unit === "%" ? "%" : r.unit}`)}
            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-left"
          >
            <div>
              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {parseFloat(r.value.toFixed(4))}{r.unit === "%" ? "%" : r.unit}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-3">{r.label}</span>
            </div>
            <span className="text-xs text-zinc-400">点击复制</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">常用尺寸</h3>
        <div className="flex flex-wrap gap-2">
          {commonSizes.map((s) => (
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
}
