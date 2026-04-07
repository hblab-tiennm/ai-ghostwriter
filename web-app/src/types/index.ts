export type Style = "facebook_post" | "news";

export type SubType =
  // facebook_post
  | "lifestyle_philosophy"
  | "project_announcement"
  | "market_insight"
  | "testimonial_story"
  | "teaser"
  | "lifestyle_branding"
  | "financial_policy"
  | "sales_opening"
  // news
  | "project_news"
  | "market_analysis"
  | "policy_update"
  | "company_update";

export interface StyleOption {
  value: SubType;
  label: string;
  style: Style;
}

export const STYLE_OPTIONS: Record<Style, StyleOption[]> = {
  facebook_post: [
    { style: "facebook_post", value: "lifestyle_philosophy",  label: "Triết lý sống 🌿" },
    { style: "facebook_post", value: "project_announcement",  label: "Ra mắt dự án 🎉" },
    { style: "facebook_post", value: "market_insight",        label: "Thị trường 📊" },
    { style: "facebook_post", value: "testimonial_story",     label: "Câu chuyện KH 💬" },
    { style: "facebook_post", value: "teaser",                label: "Teaser bí ẩn 🔐" },
    { style: "facebook_post", value: "lifestyle_branding",    label: "Lifestyle thương hiệu ✨" },
    { style: "facebook_post", value: "financial_policy",      label: "Chính sách tài chính 💰" },
    { style: "facebook_post", value: "sales_opening",         label: "Mở bán 🔥" },
  ],
  news: [
    { style: "news", value: "project_news",    label: "Tin dự án — Ra mắt / Khởi công" },
    { style: "news", value: "market_analysis", label: "Phân tích thị trường BĐS" },
    { style: "news", value: "policy_update",   label: "Chính sách / Pháp lý" },
    { style: "news", value: "company_update",  label: "Tin doanh nghiệp / Giải thưởng" },
  ],
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  title: string;
  style: Style;
  subType: SubType;
  messages: Message[];
  document: string;
  savedToDb?: boolean;  // true if persisted to Supabase
  createdAt: Date;
  updatedAt: Date;
}
