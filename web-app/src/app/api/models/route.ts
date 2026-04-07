import { NextResponse } from "next/server";

export interface ModelOption {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
  description: string;
}

// Returns only models for keys that are actually configured
export async function GET() {
  const models: ModelOption[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    models.push(
      { id: "claude-opus-4-5",   label: "Claude Opus",   provider: "anthropic", description: "Mạnh nhất, chậm hơn" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet", provider: "anthropic", description: "Cân bằng tốc độ & chất lượng" },
      { id: "claude-haiku-3-5",  label: "Claude Haiku",  provider: "anthropic", description: "Nhanh nhất" },
    );
  }

  if (process.env.OPENAI_API_KEY) {
    models.push(
      { id: "gpt-5.4-mini",  label: "GPT-5.4 Mini",  provider: "openai", description: "Mạnh, nhanh, tiết kiệm ⭐ mặc định" },
      { id: "gpt-5.4",       label: "GPT-5.4",       provider: "openai", description: "Mạnh nhất, agentic & coding" },
      { id: "gpt-4o",        label: "GPT-4o",         provider: "openai", description: "Ổn định, phổ biến" },
      { id: "gpt-4o-mini",   label: "GPT-4o Mini",    provider: "openai", description: "Rẻ nhất, tác vụ đơn giản" },
      { id: "gpt-4.1",       label: "GPT-4.1",        provider: "openai", description: "Thông minh, non-reasoning" },
      { id: "gpt-4.1-mini",  label: "GPT-4.1 Mini",   provider: "openai", description: "Nhanh, rẻ" },
      { id: "gpt-5-mini",    label: "GPT-5 Mini",     provider: "openai", description: "Cân bằng chi phí & chất lượng" },
      { id: "gpt-5",         label: "GPT-5",          provider: "openai", description: "Reasoning + coding mạnh" },
    );
  }

  return NextResponse.json({ models });
}
