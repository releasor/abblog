"use client";

import { useState, useEffect, memo } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Template {
  id: number;
  name: string;
  description?: string | null;
  content: string;
  category: string;
}

interface TemplatePickerProps {
  onSelect: (content: string) => void;
}

export const TemplatePicker = memo(function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [show, setShow] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch((e) => console.error("[TemplatePicker] Failed to fetch templates:", e));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, content: newContent }),
      });
      if (res.ok) {
        const t = await res.json();
        setTemplates([t, ...templates]);
        setNewName("");
        setNewContent("");
        setShowCreate(false);
      }
    } catch (e) {
      console.error("[TemplatePicker] Failed to create template:", e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== id));
      }
    } catch (e) {
      console.error("[TemplatePicker] Failed to delete template:", e);
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span>模板</span>
      </button>

      {show && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 z-10">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">文章模板</span>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              新建
            </button>
          </div>

          {showCreate && (
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="模板名称"
                className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="模板内容 (HTML)"
                rows={3}
                className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 resize-none"
              />
              <button
                onClick={handleCreate}
                className="w-full py-1 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
              >
                保存模板
              </button>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500 text-center">暂无模板</p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <button
                    onClick={() => {
                      onSelect(t.content);
                      setShow(false);
                    }}
                    className="flex-1 text-left text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    {t.name}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="p-1 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="删除模板"
        message="确定要删除此模板吗？此操作无法撤销。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
});
