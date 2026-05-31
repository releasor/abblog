"use client";

import { useState, memo } from "react";
import { useCopyWithId } from "@/hooks/use-copy";

const CODES: { code: number; name: string; description: string; category: string }[] = [
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

export default memo(function HttpStatusLookup() {
  const [query, setQuery] = useState("");
  const { copiedId, copy } = useCopyWithId<number>();

  const copyCode = (code: number) => copy(String(code), code);

  const filtered = query
    ? CODES.filter((c) => String(c.code).includes(query) || c.name.toLowerCase().includes(query.toLowerCase()) || c.description.includes(query))
    : CODES;

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
                <button key={c.code} onClick={() => copyCode(c.code)} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-left w-full">
                  <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100 w-12">{copiedId === c.code ? "已复制!" : c.code}</span>
                  <span className="font-mono text-sm font-medium text-zinc-700 dark:text-zinc-300 w-40">{c.name}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{c.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
