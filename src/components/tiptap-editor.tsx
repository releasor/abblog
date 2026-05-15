"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "bg-zinc-100 dark:bg-zinc-800 p-4 rounded-md font-mono text-sm" } },
      }),
      Link.configure({ openOnClick: false }),
      Image.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-md" } }),
      Placeholder.configure({ placeholder: "Write your post content..." }),
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
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `px-2 py-1 text-sm rounded ${
      active
        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))}>
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))}>
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))}>
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))}>
        H3
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive("codeBlock"))}>
        {"</>"}
      </button>
      <button type="button" onClick={addLink} className={btnClass(editor.isActive("link"))}>
        Link
      </button>
      <button type="button" onClick={addImage} className={btnClass(false)}>
        Image
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))}>
        List
      </button>
    </div>
  );
}
