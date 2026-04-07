"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useRef } from "react";
import {
  Copy, Download, Save, FileText, Undo2, Redo2,
} from "lucide-react";

interface EditorPanelProps {
  content: string;
  isStreaming: boolean;
  sessionTitle: string;
  sessionId: string;  // used to detect session switch and reset editor state
  onSave: (text: string) => void;
  onContentChange: (text: string) => void;
}

export default function EditorPanel({
  content,
  isStreaming,
  sessionTitle,
  sessionId,
  onSave,
  onContentChange,
}: EditorPanelProps) {
  const prevContentRef = useRef<string>("");
  const prevSessionIdRef = useRef<string>("");
  // Track whether user has manually edited since last AI content
  const userEditedRef = useRef<boolean>(false);
  // Use ref for isStreaming to avoid stale closure in onUpdate
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  // Detect streaming→done transition for final formatting
  const wasStreamingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Nội dung do AI tạo ra sẽ xuất hiện ở đây. Bạn có thể chỉnh sửa trực tiếp sau khi nhận được...",
      }),
      CharacterCount,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate({ editor }) {
      // Mark user has edited only when not streaming (use ref for fresh value)
      if (!isStreamingRef.current) userEditedRef.current = true;
      onContentChange(editor.getText());
    },
    immediatelyRender: false,
  });

  // Sync content from parent into editor
  useEffect(() => {
    if (!editor) return;

    // Session switched → force reset so new session content always loads
    const sessionChanged = sessionId !== prevSessionIdRef.current;
    if (sessionChanged) {
      prevSessionIdRef.current = sessionId;
      prevContentRef.current = "";
      userEditedRef.current = false;
      if (!content) {
        editor.commands.clearContent(false);
        return;
      }
    }

    // Detect streaming → done transition for final formatting
    const streamingJustEnded = wasStreamingRef.current && !isStreaming;
    wasStreamingRef.current = isStreaming;

    // Skip if content hasn't actually changed (unless streaming just ended)
    if (content === prevContentRef.current && !streamingJustEnded) return;
    prevContentRef.current = content;

    // During streaming, AI is taking over → reset user-edited flag
    if (isStreaming) {
      userEditedRef.current = false;
    }

    // Skip update if user has manually edited (preserves cursor position)
    if (userEditedRef.current) return;

    // Empty content → clear editor
    if (!content) {
      editor.commands.clearContent(false);
      return;
    }

    // Convert markdown inline formatting to HTML
    const md = (text: string) =>
      text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

    if (isStreaming) {
      const streamHtml = `<p>${md(content.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>"))}</p>`;
      editor.commands.setContent(streamHtml, { emitUpdate: false });
    } else {
      // Final format after streaming or loading saved content
      const html = content
        .split("\n\n")
        .map((para) => {
          const trimmed = para.trim();
          if (trimmed.startsWith("### ")) return `<h3>${md(trimmed.slice(4))}</h3>`;
          if (trimmed.startsWith("## ")) return `<h2>${md(trimmed.slice(3))}</h2>`;
          if (trimmed.startsWith("# ")) return `<h1>${md(trimmed.slice(2))}</h1>`;
          // Standalone bold-only paragraph → treat as subheading
          const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
          if (boldMatch) return `<h3>${boldMatch[1]}</h3>`;
          return `<p>${md(para.replace(/\n/g, "<br>"))}</p>`;
        })
        .join("");
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [content, isStreaming, sessionId, editor]);

  const handleCopy = () => {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getText());
    showToast("Đã copy nội dung!");
  };

  const handleDownload = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionTitle || "ghostwriter-futa"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã tải xuống!");
  };

  const charCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;
  const editorHasText = (editor?.getText().trim().length ?? 0) > 0;
  const hasContent = editorHasText || content.trim().length > 0;

  return (
    <div className="editor-panel">
      <div className="editor-toolbar">
        <span className="editor-toolbar-title">
          {sessionTitle || "Bài viết mới"}
          {isStreaming && <span style={{ color: "var(--color-primary)", marginLeft: 8, fontSize: "0.75rem" }}>• Đang tạo...</span>}
        </span>

        <div className="toolbar-divider" />

        <button
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>

        <button
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          title="Làm lại (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="toolbar-btn toolbar-btn-ghost"
          onClick={handleCopy}
          disabled={!hasContent}
          title="Sao chép"
        >
          <Copy size={14} />
          Copy
        </button>

        <button
          className="toolbar-btn toolbar-btn-ghost"
          onClick={handleDownload}
          disabled={!hasContent}
          title="Tải xuống"
        >
          <Download size={14} />
          Tải về
        </button>

        <button
          className="toolbar-btn toolbar-btn-primary"
          onClick={() => editor && onSave(editor.getText())}
          disabled={!hasContent || isStreaming}
          title="Lưu"
        >
          <Save size={14} />
          Lưu
        </button>

        {hasContent && (
          <span className="char-count">
            {wordCount} từ · {charCount} ký tự
          </span>
        )}
      </div>

      <div className="editor-scroll">
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  );
}

// Simple toast helper
function showToast(message: string) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
