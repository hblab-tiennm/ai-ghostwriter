"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Message, Style, SubType, STYLE_OPTIONS } from "@/types";

export interface ModelOption {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
  description: string;
}

interface ChatPanelProps {
  messages: Message[];
  isStreaming: boolean;
  style: Style;
  subType: SubType;
  selectedModel: string;
  onStyleChange: (style: Style) => void;
  onSubTypeChange: (subType: SubType) => void;
  onModelChange: (modelId: string) => void;
  onSend: (prompt: string) => void;
}

const STYLE_LABELS: Record<Style, string> = {
  facebook_post: "Facebook",
  news: "Bài báo",
};

export default function ChatPanel({
  messages,
  isStreaming,
  style,
  subType,
  selectedModel,
  onStyleChange,
  onSubTypeChange,
  onModelChange,
  onSend,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: ModelOption[] }) => {
        setModels(data.models);
        // Auto-select first model if none selected
        if (data.models.length > 0 && !selectedModel) {
          onModelChange(data.models[0].id);
        }
      })
      .catch(() => {}); // Fail silently
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setInput(el.value);
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On mobile (touch), let Enter add newline normally — user taps send button
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStyleChange = (s: Style) => {
    onStyleChange(s);
    onSubTypeChange(STYLE_OPTIONS[s][0].value);
  };

  const activeModel = models.find((m) => m.id === selectedModel);

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-title">Ghostwriter AI</div>
        <div className="chat-header-sub">FUTA Land · Nội dung BĐS cao cấp</div>
      </div>

      {/* Style Selector */}
      <div className="style-selector">
        <div className="style-row">
          <span className="style-label">Dạng bài</span>
          <div className="style-chips">
            {(Object.keys(STYLE_OPTIONS) as Style[]).map((s) => (
              <button
                key={s}
                className={`chip${style === s ? " selected" : ""}`}
                onClick={() => handleStyleChange(s)}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="style-row">
          <span className="style-label">Chủ đề</span>
          <div className="style-chips">
            {STYLE_OPTIONS[style].map((opt) => (
              <button
                key={opt.value}
                className={`chip${subType === opt.value ? " selected" : ""}`}
                onClick={() => onSubTypeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--color-muted)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
              Xin chào! 🌸
            </p>
            <p style={{ fontSize: "0.83rem", lineHeight: 1.7 }}>
              Nhập các ý chính (bullet points) bạn muốn viết.<br />
              AI sẽ tạo nội dung theo phong cách FUTA Land.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`msg-bubble ${msg.role === "user" ? "user" : ""}`}>
            <div className={`msg-avatar ${msg.role === "user" ? "user" : "ai"}`}>
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div className={`msg-content ${msg.role === "user" ? "user" : "ai"}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="msg-bubble">
            <div className="msg-avatar ai">AI</div>
            <div className="msg-content ai">
              <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Đang viết</span>
              <span className="thinking-dots" style={{ marginLeft: 8 }}>
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Nhập ý tưởng (Enter để gửi)"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title="Gửi (Enter)"
            id="send-button"
          >
            <Send size={16} color="white" />
          </button>
        </div>

        {/* {models.length > 1 && (
          <div className="model-selector-row">
            <span className="model-selector-label">Model</span>
            <select
              id="model-select"
              className="model-select"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={isStreaming}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
            {activeModel && (
              <span className={`model-provider-badge ${activeModel.provider}`}>
                {activeModel.provider === "anthropic" ? "Claude" : "OpenAI"}
              </span>
            )}
          </div>
        )}

        {models.length === 1 && (
          <div className="model-selector-row">
            <span className="model-selector-label">Model</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text)", fontFamily: "var(--font-ui)" }}>
              {models[0].label}
            </span>
            <span className={`model-provider-badge ${models[0].provider}`}>
              {models[0].provider === "anthropic" ? "Claude" : "OpenAI"}
            </span>
          </div>
        )} */}

        <p className="chat-hint" style={{
          fontSize: "0.68rem",
          color: "var(--color-muted)",
          marginTop: 6,
          textAlign: "center",
          fontFamily: "var(--font-ui)",
        }}>
          Shift+Enter để xuống dòng
        </p>
      </div>
    </div>
  );
}
