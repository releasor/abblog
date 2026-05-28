"use client";

import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { BarChart3 } from "lucide-react";

export function TiptapPoll({ node }: NodeViewProps) {
  const { question, options } = node.attrs;

  return (
    <NodeViewWrapper className="my-4">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{question || "投票"}</span>
        </div>
        <div className="space-y-2">
          {(options || []).map((opt: string, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700"
            >
              <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
