import { useState, useCallback } from "react";

export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelay);
    } catch {
      // Clipboard API may fail in insecure contexts
    }
  }, [resetDelay]);

  return { copied, setCopied, copy };
}

export function useCopyWithId<T extends string | number>(resetDelay = 2000) {
  const [copiedId, setCopiedId] = useState<T | null>(null);

  const copy = useCallback(async (text: string, id: T) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), resetDelay);
    } catch {
      // Clipboard API may fail in insecure contexts
    }
  }, [resetDelay]);

  return { copiedId, copy };
}
