"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Check } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConfigs((prev) =>
            prev.map((c) => {
              const found = data.find((d: { key: string }) => d.key === c.key);
              return found ? { ...c, value: found.value } : c;
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (key: string, value: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs: configs.map((c) => ({ key: c.key, value: c.value })) }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
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
            className={`flex items-center gap-4 px-5 py-4 ${
              i < configs.length - 1
                ? "border-b border-zinc-100 dark:border-zinc-800"
                : ""
            }`}
          >
            <label className="w-40 text-sm text-zinc-600 dark:text-zinc-400 flex-shrink-0">
              {config.label}
            </label>
            {config.type === "boolean" ? (
              <button
                onClick={() =>
                  handleChange(
                    config.key,
                    config.value === "true" ? "false" : "true"
                  )
                }
                className={`relative w-10 h-5.5 rounded-full transition-colors ${
                  config.value === "true"
                    ? "bg-zinc-900 dark:bg-zinc-100"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white dark:bg-zinc-900 rounded-full shadow-sm transition-transform ${
                    config.value === "true" ? "translate-x-4.5" : ""
                  }`}
                />
              </button>
            ) : config.type === "textarea" ? (
              <textarea
                value={config.value}
                onChange={(e) => handleChange(config.key, e.target.value)}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 resize-none"
              />
            ) : (
              <input
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
