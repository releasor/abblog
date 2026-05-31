"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Check } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean";
}

const defaultConfigs: ConfigItem[] = [
  { key: "site_name", value: "", label: "站点名称", type: "text" },
  { key: "site_description", value: "", label: "站点描述", type: "textarea" },
  { key: "site_keywords", value: "", label: "SEO 关键词", type: "text" },
  { key: "site_logo", value: "", label: "Logo URL", type: "text" },
  { key: "site_favicon", value: "", label: "Favicon URL", type: "text" },
  { key: "footer_text", value: "", label: "页脚文字", type: "text" },
  { key: "icp_number", value: "", label: "ICP 备案号", type: "text" },
  { key: "analytics_id", value: "", label: "统计分析 ID", type: "text" },
  { key: "comment_review", value: "true", label: "评论需审核", type: "boolean" },
  { key: "allow_register", value: "true", label: "允许注册", type: "boolean" },
  { key: "post_per_page", value: "10", label: "每页文章数", type: "number" },
  { key: "auto_save_interval", value: "30", label: "自动保存间隔(秒)", type: "number" },
];

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>(defaultConfigs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    async function loadConfig() {
      const result = await fetchApi<{ key: string; value: string }[]>("/api/admin/config", { errorMessage: "加载配置失败" });
      if (result.ok && Array.isArray(result.data)) {
        setConfigs((prev) =>
          prev.map((c) => {
            const found = result.data.find((d) => d.key === c.key);
            return found ? { ...c, value: found.value } : c;
          })
        );
      }
    }
    loadConfig();
  }, []);

  const handleChange = (key: string, value: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await fetchApi("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ configs: configs.map((c) => ({ key: c.key, value: c.value })) }),
      errorMessage: "保存失败",
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          站点配置
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              已保存
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {saving ? "保存中..." : "保存配置"}
            </>
          )}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {configs.map((config, i) => (
          <div
            key={config.key}
            className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 ${
              i < configs.length - 1
                ? "border-b border-zinc-100 dark:border-zinc-800"
                : ""
            }`}
          >
            <label htmlFor={`config-${config.key}`} className="sm:w-40 text-sm text-zinc-600 dark:text-zinc-400 flex-shrink-0">
              {config.label}
            </label>
            {config.type === "boolean" ? (
              <button
                id={`config-${config.key}`}
                onClick={() =>
                  handleChange(
                    config.key,
                    config.value === "true" ? "false" : "true"
                  )
                }
                role="switch"
                aria-checked={config.value === "true"}
                aria-label={config.label}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${
                  config.value === "true"
                    ? "bg-zinc-900 dark:bg-zinc-100"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white dark:bg-zinc-900 rounded-full shadow-sm transition-transform ${
                    config.value === "true" ? "translate-x-[18px]" : ""
                  }`}
                />
              </button>
            ) : config.type === "textarea" ? (
              <textarea
                id={`config-${config.key}`}
                value={config.value}
                onChange={(e) => handleChange(config.key, e.target.value)}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 resize-none"
              />
            ) : (
              <input
                id={`config-${config.key}`}
                type={config.type === "number" ? "number" : "text"}
                value={config.value}
                onChange={(e) => handleChange(config.key, e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
