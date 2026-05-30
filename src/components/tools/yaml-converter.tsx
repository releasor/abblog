"use client";

import { useState } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { getErrorMessage } from "@/lib/api-utils";

export default function YamlConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"json2yaml" | "yaml2json">("json2yaml");
  const [error, setError] = useState("");
  const { copied, copy } = useCopyToClipboard();

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
      setError(getErrorMessage(e));
      setOutput("");
    }
  };

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
        <button onClick={() => copy(output)} className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          {copied ? "已复制!" : "复制结果"}
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
