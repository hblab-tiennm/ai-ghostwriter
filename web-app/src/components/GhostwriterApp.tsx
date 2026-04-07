"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { MessageSquare, FileEdit, Menu, X, History } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import EditorPanel from "@/components/EditorPanel";
import { Session, Message, Style, SubType } from "@/types";

const DEFAULT_STYLE: Style = "facebook_post";
const DEFAULT_SUBTYPE: SubType = "lifestyle_philosophy";

function createNewSession(style: Style = DEFAULT_STYLE, subType: SubType = DEFAULT_SUBTYPE): Session {
  return {
    id: uuidv4(),
    title: "Bài viết mới",
    style,
    subType,
    messages: [],
    document: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default function GhostwriterApp() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [mobileView, setMobileView] = useState<"chat" | "editor">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // ── Load saved sessions from Supabase on mount ────────────────
  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((rows: Array<{
        id: string; title: string; style: Style; sub_type: SubType;
        document: string; messages: Message[]; created_at: string; updated_at: string;
      }>) => {
        if (!Array.isArray(rows)) return;
        const loaded: Session[] = rows.map((row) => ({
          id: row.id,
          title: row.title,
          style: row.style,
          subType: row.sub_type,
          document: row.document ?? "",
          messages: (row.messages ?? []).map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
          savedToDb: true,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));
        setSessions(loaded);
        if (loaded.length > 0) setActiveSessionId(loaded[0].id);
      })
      .catch(() => {/* silently fail if Supabase not configured */});
  }, []);

  // ── Session management ────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    const session = createNewSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setSidebarOpen(false);
    setMobileView("chat");
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
  }, []);

  const updateSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date() } : s))
    );
  }, []);

  // ── Style / SubType changes ───────────────────────────────────
  const handleStyleChange = useCallback(
    (style: Style) => {
      if (!activeSessionId) return;
      updateSession(activeSessionId, { style });
    },
    [activeSessionId, updateSession]
  );

  const handleSubTypeChange = useCallback(
    (subType: SubType) => {
      if (!activeSessionId) return;
      updateSession(activeSessionId, { subType });
    },
    [activeSessionId, updateSession]
  );

  // ── Send prompt & stream response ─────────────────────────────
  const handleSend = useCallback(
    async (prompt: string) => {
      // Ensure there's an active session
      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = createNewSession();
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        sessionId = session.id;
      }

      const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
      const style = session?.style ?? DEFAULT_STYLE;
      const subType = session?.subType ?? DEFAULT_SUBTYPE;

      // User message
      const userMsg: Message = {
        id: uuidv4(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };

      // Derive session title from first message
      const isFirstMsg = (session?.messages.length ?? 0) === 0;
      const newTitle = isFirstMsg
        ? prompt.slice(0, 48) + (prompt.length > 48 ? "…" : "")
        : session?.title ?? "Bài viết mới";

      updateSession(sessionId, {
        title: newTitle,
        messages: [...(session?.messages ?? []), userMsg],
        document: "",
      });

      // Abort any previous stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      let accumulated = "";

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            prompt,
            style,
            subType,
            model: selectedModel || undefined,
            history: (session?.messages ?? [])
              .slice(-6)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok || !res.body) throw new Error("Lỗi kết nối API");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });

          // Update document live
          updateSession(sessionId, { document: accumulated });
        }

        // Final: extract title from first heading line of AI response
        const titleFromResponse = accumulated
          .split("\n")
          .map((l) => l.replace(/^#+\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").trim())
          .find((l) => l.length > 0);

        const aiMsg: Message = {
          id: uuidv4(),
          role: "assistant",
          content: "✓ Đã tạo xong nội dung. Bạn có thể chỉnh sửa trong trình soạn thảo.",
          timestamp: new Date(),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  title: titleFromResponse ?? s.title,
                  messages: [...s.messages, aiMsg],
                  document: accumulated,
                  updatedAt: new Date(),
                }
              : s
          )
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errorMsg: Message = {
          id: uuidv4(),
          role: "assistant",
          content: `⚠️ Lỗi: ${err instanceof Error ? err.message : "Không thể kết nối AI"}`,
          timestamp: new Date(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s
          )
        );
      } finally {
        setIsStreaming(false);
        // Auto-switch to editor on mobile when generation completes
        setMobileView("editor");
      }
    },
    [activeSessionId, sessions, updateSession]
  );

  // ── Save to dataset + persist to Supabase ────────────────────
  const handleSave = useCallback(
    async (text: string) => {
      if (!activeSession) return;
      const mcpId = `${activeSession.style === "facebook_post" ? "fb" : "news"}_${Date.now()}`;

      // Run MCP save and Supabase upsert independently — one failing won't block the other
      const [mcpResult, dbResult] = await Promise.allSettled([
        // 1. Save to MCP dataset
        fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style: activeSession.style,
            subType: activeSession.subType,
            id: mcpId,
            text,
            title: activeSession.title,
          }),
        }).then((r) => r.json()),

        // 2. Upsert session to Supabase
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeSession.id,
            title: activeSession.title,
            style: activeSession.style,
            subType: activeSession.subType,
            document: text,
            messages: activeSession.messages,
          }),
        }).then((r) => r.json()),
      ]);

      const mcpOk = mcpResult.status === "fulfilled" && mcpResult.value?.ok;
      const dbOk = dbResult.status === "fulfilled" && dbResult.value?.ok;

      if (dbOk) {
        // Mark session as saved in local state
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id ? { ...s, savedToDb: true, document: text } : s
          )
        );
      }

      if (mcpOk && dbOk) {
        showToast("✓ Đã lưu vào dataset và lịch sử!");
      } else if (dbOk) {
        showToast("✓ Đã lưu lịch sử! (MCP không khả dụng)");
      } else if (mcpOk) {
        showToast("✓ Đã lưu dataset! (Lỗi lưu lịch sử)");
      } else {
        showToast("⚠️ Lỗi lưu — kiểm tra kết nối");
      }
    },
    [activeSession]
  );

  const handleContentChange = useCallback(
    (text: string) => {
      if (!activeSessionId) return;
      updateSession(activeSessionId, { document: text });
    },
    [activeSessionId, updateSession]
  );

  // ── If no active session, auto-create one ─────────────────────
  const displaySession: Session = activeSession ?? createNewSession();

  return (
    <div className="app-shell">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`sidebar${sidebarOpen ? " sidebar-mobile-open" : ""}`}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
        />
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>
      </div>

      <div className="main-content">
        <div className={`chat-panel-wrap${mobileView === "chat" ? " mobile-active" : ""}`}>
          <ChatPanel
            messages={displaySession.messages}
            isStreaming={isStreaming}
            style={displaySession.style}
            subType={displaySession.subType}
            selectedModel={selectedModel}
            onStyleChange={handleStyleChange}
            onSubTypeChange={handleSubTypeChange}
            onModelChange={setSelectedModel}
            onSend={handleSend}
          />
        </div>

        <div className={`editor-panel-wrap${mobileView === "editor" ? " mobile-active" : ""}`}>
          <EditorPanel
            content={displaySession.document}
            isStreaming={isStreaming && activeSessionId !== null}
            sessionTitle={displaySession.title}
            sessionId={displaySession.id}
            onSave={handleSave}
            onContentChange={handleContentChange}
          />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="mobile-nav">
        <button
          className={`mobile-nav-btn${mobileView === "chat" ? " active" : ""}`}
          onClick={() => setMobileView("chat")}
        >
          <MessageSquare size={20} />
          <span>Chat</span>
        </button>
        <button
          className={`mobile-nav-btn${mobileView === "editor" ? " active" : ""}`}
          onClick={() => setMobileView("editor")}
        >
          <FileEdit size={20} />
          <span>Soạn thảo</span>
        </button>
        <button
          className="mobile-nav-btn"
          onClick={() => setSidebarOpen(true)}
        >
          <History size={20} />
          <span>Lịch sử</span>
        </button>
      </div>
    </div>
  );
}

function showToast(message: string) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("visible")));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
