"use client";

import { Plus, Feather } from "lucide-react";
import { Session } from "@/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
}

const STYLE_SHORT: Record<string, string> = {
  facebook_post: "FB",
  news: "News",
};

const SUBTYPE_SHORT: Record<string, string> = {
  lifestyle_philosophy: "Triết lý",
  project_announcement: "Dự án",
  market_insight: "Thị trường",
  testimonial_story: "Câu chuyện",
  project_news: "Tin dự án",
  market_analysis: "Phân tích",
  policy_update: "Chính sách",
  company_update: "Doanh nghiệp",
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
}: SidebarProps) {
  return (
    <>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Feather size={16} color="white" />
          </div>
          Joon Ghostwriter
        </div>

        <button
          id="new-session-btn"
          className="sidebar-new-btn"
          onClick={onNewSession}
        >
          <Plus size={15} />
          Bài viết mới
        </button>
      </div>

      {/* Session list */}
      <div className="sidebar-scroll">
        {sessions.length === 0 ? (
          <div style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "0.8rem",
            lineHeight: 1.7,
            fontFamily: "var(--font-ui)",
          }}>
            Chưa có bài viết nào.<br />
            Nhấn <strong>Bài viết mới</strong> để bắt đầu.
          </div>
        ) : (
          <>
            <div className="sidebar-section-label">Lịch sử</div>
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`sidebar-item${activeSessionId === session.id ? " active" : ""}`}
                onClick={() => onSelectSession(session.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sidebar-item-title">{session.title}</div>
                  <div className="sidebar-item-meta">
                    <span style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      background: "var(--color-border)",
                      borderRadius: 99,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      marginRight: 4,
                      color: "var(--color-text)",
                    }}>
                      {STYLE_SHORT[session.style]}
                    </span>
                    {SUBTYPE_SHORT[session.subType]} · {timeAgo(session.updatedAt)}
                  </div>
                </div>
                {session.savedToDb && (
                  <span title="Đã lưu" style={{
                    fontSize: "0.6rem",
                    color: "var(--color-primary)",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginLeft: 4,
                  }}>✦</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--color-border)",
        fontSize: "0.68rem",
        color: "var(--color-muted)",
        fontFamily: "var(--font-ui)",
        lineHeight: 1.6,
      }}>
        Idelisa's AI<br />
        <span style={{ color: "var(--color-primary)" }}>✦</span> Powered by Tom
      </div>
    </>
  );
}
