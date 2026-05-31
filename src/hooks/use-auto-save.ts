"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const STORAGE_KEY = "billionaire_drafts";
const SAVE_INTERVAL = 5000; // 5 seconds

interface DraftData {
  title: string;
  content: string;
  excerpt: string;
  coverImageUrl: string;
  categoryId: string;
  tags: string[];
  savedAt: string;
}

function getDrafts(): Record<string, DraftData> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDraft(key: string, data: DraftData) {
  try {
    const drafts = getDrafts();
    drafts[key] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* storage full or private browsing */ }
}

function removeDraft(key: string) {
  try {
    const drafts = getDrafts();
    delete drafts[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* storage full or private browsing */ }
}

export function getDraft(key: string): DraftData | null {
  return getDrafts()[key] || null;
}

export function clearDraft(key: string) {
  removeDraft(key);
}

export function useAutoSave(
  key: string,
  data: { title: string; content: string; excerpt?: string; coverImageUrl?: string; categoryId?: string; tags?: string[] },
  enabled: boolean = true
) {
  const lastSaved = useRef<string>("");
  const dataRef = useRef(data);
  const keyRef = useRef(key);
  const enabledRef = useRef(enabled);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    dataRef.current = data;
    keyRef.current = key;
    enabledRef.current = enabled;
  });

  const doSave = useCallback(() => {
    if (!enabledRef.current) return;
    const currentData = dataRef.current;
    const serialized = JSON.stringify(currentData);
    if (serialized === lastSaved.current) return;

    saveDraft(keyRef.current, {
      ...currentData,
      excerpt: currentData.excerpt || "",
      coverImageUrl: currentData.coverImageUrl || "",
      categoryId: currentData.categoryId || "",
      tags: currentData.tags || [],
      savedAt: new Date().toISOString(),
    });
    lastSaved.current = serialized;
    setLastSaveTime(new Date());
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(data);
    if (serialized !== lastSaved.current) {
      setHasUnsavedChanges(true);
    }

    const interval = setInterval(doSave, SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [data, enabled, doSave]);

  // Save on page unload
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = () => doSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, doSave]);

  return { lastSaveTime, hasUnsavedChanges, saveNow: doSave };
}
