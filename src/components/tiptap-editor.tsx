"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { VideoExtension } from "./tiptap-video";
import { useEffect, useRef, useState, memo } from "react";
import { List, ListOrdered, Quote, Link2, Image as ImageIcon, Video, Film } from "lucide-react";
import { showToast } from "./toast";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const TiptapEditor = memo(function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "bg-zinc-100 dark:bg-zinc-800 p-4 rounded-md font-mono text-sm" } },
      }),
      Link.configure({ openOnClick: false }),
      Image.configure({ HTMLAttributes: { class: "post-image" } }),
      VideoExtension,
      Placeholder.configure({ placeholder: "开始写文章内容..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-zinc dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
});

export default TiptapEditor;

// Type helper for tiptap commands not in base types (provided by StarterKit)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(editor: NonNullable<ReturnType<typeof useEditor>>) {
  return editor.chain() as any;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `px-2 py-1 text-sm rounded transition-colors ${
      active
        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;

  const uploadFile = async (file: File, type: "image" | "video") => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "上传失败", "error");
        return;
      }
      if (type === "image") {
        editor.chain().focus().setImage({ src: data.url }).run();
      } else {
        editor.chain().focus().setVideo({ src: data.url, type: "upload" }).run();
      }
    } catch {
      showToast("上传失败，请稍后重试", "error");
    } finally {
      setUploading(false);
    }
  };

  const addImage = () => imgInputRef.current?.click();

  const addVideoEmbed = () => {
    const url = window.prompt("输入视频链接（支持YouTube、Bilibili）：");
    if (url) editor.chain().focus().setVideo({ src: url, type: "embed" }).run();
  };

  const addVideoUpload = () => vidInputRef.current?.click();

  const addLink = () => {
    const url = window.prompt("输入链接地址：");
    if (url) chain(editor).focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
      <button type="button" onClick={() => chain(editor).focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="粗体" aria-label="粗体">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="斜体" aria-label="斜体">
        <em>I</em>
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleStrike().run()} className={btnClass(editor.isActive("strike"))} title="删除线" aria-label="删除线">
        <s>S</s>
      </button>

      <span className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

      <button type="button" onClick={() => chain(editor).focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))} title="标题2" aria-label="标题2">
        H2
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))} title="标题3" aria-label="标题3">
        H3
      </button>

      <span className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

      <button type="button" onClick={() => chain(editor).focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="无序列表" aria-label="无序列表">
        <List className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="有序列表" aria-label="有序列表">
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))} title="引用" aria-label="引用">
        <Quote className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => chain(editor).focus().toggleCodeBlock().run()} className={btnClass(editor.isActive("codeBlock"))} title="代码块" aria-label="代码块">
        {"</>"}
      </button>

      <span className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

      <button type="button" onClick={addLink} className={btnClass(editor.isActive("link"))} title="插入链接" aria-label="插入链接">
        <Link2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={addImage} disabled={uploading} className={btnClass(false)} title="上传图片" aria-label="上传图片">
        <ImageIcon className="w-4 h-4" />
      </button>
      <button type="button" onClick={addVideoEmbed} className={btnClass(false)} title="嵌入视频链接" aria-label="嵌入视频链接">
        <Video className="w-4 h-4" />
      </button>
      <button type="button" onClick={addVideoUpload} disabled={uploading} className={btnClass(false)} title="上传视频" aria-label="上传视频">
        <Film className="w-4 h-4" />
      </button>

      {uploading && <span className="text-xs text-zinc-500 ml-2">上传中...</span>}

      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], "image"); }} />
      <input ref={vidInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], "video"); }} />
    </div>
  );
}
