"use client";

import { useState } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function TiptapAccordion({ node }: NodeViewProps) {
  const { title } = node.attrs;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <NodeViewWrapper className="my-4">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 text-left"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {title || "折叠面板"}
          </span>
        </button>
        {isOpen && (
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 prose dark:prose-invert max-w-none" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
