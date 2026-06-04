"use client";

import { useState, lazy, Suspense, memo } from "react";

type Tool = "json" | "regex" | "color" | "markdown" | "timestamp" | "base64" | "password" | "diff" | "qrcode" | "yaml" | "cron" | "httpstatus" | "cssunit";

const JsonFormatter = lazy(() => import("@/components/tools/json-formatter"));
const RegexTester = lazy(() => import("@/components/tools/regex-tester"));
const ColorConverter = lazy(() => import("@/components/tools/color-converter"));
const MarkdownPreview = lazy(() => import("@/components/tools/markdown-preview"));
const TimestampConverter = lazy(() => import("@/components/tools/timestamp-converter"));
const Base64Tool = lazy(() => import("@/components/tools/base64-tool"));
const PasswordGenerator = lazy(() => import("@/components/tools/password-generator"));
const DiffChecker = lazy(() => import("@/components/tools/diff-checker"));
const QRCodeGenerator = lazy(() => import("@/components/tools/qrcode-generator"));
const YamlConverter = lazy(() => import("@/components/tools/yaml-converter"));
const CrontabGenerator = lazy(() => import("@/components/tools/crontab-generator"));
const HttpStatusLookup = lazy(() => import("@/components/tools/http-status-lookup"));
const CssUnitConverter = lazy(() => import("@/components/tools/css-unit-converter"));

const TOOL_COMPONENTS: Record<Tool, React.LazyExoticComponent<React.ComponentType<object>>> = {
  json: JsonFormatter,
  regex: RegexTester,
  color: ColorConverter,
  markdown: MarkdownPreview,
  timestamp: TimestampConverter,
  base64: Base64Tool,
  password: PasswordGenerator,
  diff: DiffChecker,
  qrcode: QRCodeGenerator,
  yaml: YamlConverter,
  cron: CrontabGenerator,
  httpstatus: HttpStatusLookup,
  cssunit: CssUnitConverter,
};

function ToolLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
    </div>
  );
}

export default memo(function ToolsPage() {
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

  const ActiveComponent = TOOL_COMPONENTS[active];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        在线工具箱
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8">
        开发者常用工具，即开即用
      </p>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="工具列表">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            role="tab"
            aria-selected={active === tab.key}
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
        <Suspense fallback={<ToolLoader />}>
          <ActiveComponent />
        </Suspense>
      </div>
    </div>
  );
});
