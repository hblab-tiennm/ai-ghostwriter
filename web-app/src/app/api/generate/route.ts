import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { Style, SubType } from "@/types";

// ── Lazy provider clients — only init when key exists ─────────
let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

// Identify models by provider for correct routing
const OPENAI_MODELS = new Set([
  "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano",
  "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro",
  "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "gpt-4o", "gpt-4o-mini",
  "o3", "o4-mini",
]);
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-5";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini"; // most universally available

function getProvider(
  requestedModel?: string
): { provider: "anthropic"; client: Anthropic; model: string } | { provider: "openai"; client: OpenAI; model: string } {
  // If caller explicitly requested an OpenAI model, route to OpenAI
  if (requestedModel && OPENAI_MODELS.has(requestedModel) && process.env.OPENAI_API_KEY) {
    _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { provider: "openai", client: _openai, model: requestedModel };
  }
  // If caller requested a non-OpenAI model (i.e. Claude), route to Anthropic
  if (requestedModel && !OPENAI_MODELS.has(requestedModel) && process.env.ANTHROPIC_API_KEY) {
    _anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return { provider: "anthropic", client: _anthropic, model: requestedModel };
  }
  // Auto-detect: prefer Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    _anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return { provider: "anthropic", client: _anthropic, model: DEFAULT_ANTHROPIC_MODEL };
  }
  if (process.env.OPENAI_API_KEY) {
    _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { provider: "openai", client: _openai, model: DEFAULT_OPENAI_MODEL };
  }
  throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local");
}

const MCP_BASE = process.env.MCP_SERVER_URL ?? "http://localhost:3001";

// ── Load SKILL.md once at server startup (cached) ─────────────
// Reads the actual ghostwriter skill file so webapp uses the
// exact same instructions as Claude CLI — zero quality gap.
let _skillCache: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (_skillCache) return _skillCache;
  try {
    // Resolve relative to project root (one level up from web-app)
    const skillPath = resolve(process.cwd(), "../.agent/skills/ghostwriter/SKILL.md");
    const raw = await readFile(skillPath, "utf-8");
    _skillCache = raw;
    console.log("[ghostwriter] SKILL.md loaded:", skillPath);
    return raw;
  } catch {
    // Fallback if file path differs in production
    console.warn("[ghostwriter] SKILL.md not found, using fallback system prompt");
    _skillCache = `Bạn là ghostwriter cá nhân chuyên viết nội dung bất động sản cao cấp cho FUTA Land.
Viết theo WRITING RULES và STYLE EXAMPLES được cung cấp trong prompt.
Trả về nội dung trực tiếp. Cuối bài thêm [Style: style / sub_type].
Luôn viết bằng tiếng Việt, giọng văn sang trọng, chuyên nghiệp.`;
    return _skillCache;
  }
}

// ── Call MCP tool via direct HTTP client ──────────────────────
async function callMcpTool(tool: string, params: Record<string, unknown>) {
  try {
    // Use the ghostwriter MCP tools exposed by the MCP server via the ghostwriter MCP plugin
    const res = await fetch(`${MCP_BASE}/tools/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`MCP tool ${tool} failed: ${res.status}`);
    const data = await res.json();
    return data.result ?? data;
  } catch (err) {
    console.warn(`[MCP] ${tool} unavailable:`, err);
    return null;
  }
}

// ── Extract English keywords for better embedding search ──────
// Mirrors what Claude CLI does in SKILL.md Step 2:
// "Query: luxury apartment project launch Da Nang prime location..."
async function extractSearchQuery(
  userPrompt: string,
  style: Style,
  subType: SubType
): Promise<string> {
  try {
    if (process.env.OPENAI_API_KEY) {
      _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await _openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "Extract 8-12 English keywords from a Vietnamese real estate content request. Return ONLY space-separated keywords, no punctuation, no explanation.",
          },
          {
            role: "user",
            content: `Style: ${style}/${subType}\nRequest: ${userPrompt}`,
          },
        ],
      });
      const keywords = res.choices[0]?.message?.content?.trim() ?? userPrompt;
      console.log("[generate] Search query (EN):", keywords);
      return keywords;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      _anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await _anthropic.messages.create({
        model: "claude-haiku-3-5",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: `Extract 8-12 English keywords from this Vietnamese real estate request. Return ONLY space-separated keywords.\nStyle: ${style}/${subType}\nRequest: ${userPrompt}`,
          },
        ],
      });
      const keywords = res.content[0]?.type === "text" ? res.content[0].text.trim() : userPrompt;
      console.log("[generate] Search query (EN):", keywords);
      return keywords;
    }
  } catch (err) {
    console.warn("[generate] keyword extraction failed, using raw prompt:", err);
  }
  return userPrompt;
}

// ── Build rich prompt with style rules + examples ─────────────
async function buildAugmentedPrompt(
  userPrompt: string,
  style: Style,
  subType: SubType
): Promise<string> {
  // Step 1: Extract English keywords for better embedding search
  const searchQuery = await extractSearchQuery(userPrompt, style, subType);

  // Step 2: Parallel fetch style rules + semantic examples
  let [rules, examples] = await Promise.all([
    callMcpTool("get_style_rules", { style, sub_type: subType }),
    callMcpTool("search_style_examples", { style, sub_type: subType, query: searchQuery, top_k: 3 }),
  ]);

  // Step 2b: Fallback — if no examples for this sub_type, search all sub_types of same style
  const examplesStr = typeof examples === "string" ? examples : JSON.stringify(examples ?? "");
  const noExamples = !examples || examplesStr.includes("No examples found") || examplesStr.trim() === "";
  if (noExamples) {
    console.warn(`[generate] No examples for ${style}/${subType} — trying cross-subtype fallback`);
    // Try other sub_types in same style for style tone reference
    const fallbackSubTypes: Record<Style, SubType[]> = {
      news: ["project_news", "market_analysis"],
      facebook_post: ["lifestyle_philosophy", "project_announcement"],
    };
    for (const fallback of fallbackSubTypes[style] ?? []) {
      if (fallback === subType) continue;
      examples = await callMcpTool("search_style_examples", {
        style,
        sub_type: fallback,
        query: searchQuery,
        top_k: 2,
      });
      const fb = typeof examples === "string" ? examples : JSON.stringify(examples ?? "");
      if (examples && !fb.includes("No examples found") && fb.trim() !== "") {
        console.log(`[generate] Fallback examples found from ${style}/${fallback}`);
        break;
      }
      examples = null;
    }
  }

  const examplesFound = examples && !JSON.stringify(examples).includes("No examples found");
  console.log(`[generate] rules=${!!rules} examples=${examplesFound}`);

  let prompt = `<task_description>\nViết một bài ${style}/${subType} bằng tiếng Việt. Bạn phải tuân thủ nghiêm ngặt các quy tắc viết (<writing_rules>), phong cách bài mẫu (<style_examples>), và truyền tải đầy đủ các ý chính do người dùng cung cấp (<user_bullet_points>).\n</task_description>\n\n`;

  if (rules) {
    prompt += `<writing_rules>\n${typeof rules === "string" ? rules : JSON.stringify(rules, null, 2)}\n</writing_rules>\n\n`;
  }

  if (examplesFound) {
    prompt += `<style_examples>\n${typeof examples === "string" ? examples : JSON.stringify(examples)}\n</style_examples>\n\n`;
  }

  prompt += `<user_bullet_points>\n${userPrompt}\n</user_bullet_points>\n\n`;

  const lengthStr = rules && typeof rules === "object" && rules.length ? rules.length : "yêu cầu trong <writing_rules>";
  prompt += `<critical_constraints>\n`;
  prompt += `- TUYỆT ĐỐI KHÔNG COPY nội dung từ <style_examples>. Chỉ dùng bài mẫu để học hỏi giọng văn (tone) và cấu trúc (structure).\n`;
  prompt += `- ĐỘ DÀI BẮT BUỘC: Bạn phải viết ở khoảng độ dài ${lengthStr}. TUYỆT ĐỐI KHÔNG VIẾT VƯỢT QUÁ GIỚI HẠN NÀY.\n`;
  prompt += `- Nếu <user_bullet_points> có quá nhiều chi tiết, hãy chọn lọc, cô đọng tinh hoa, lược bỏ rườm rà để đảm bảo không vượt giới hạn chữ.\n`;
  prompt += `</critical_constraints>`;

  return prompt;
}

// ── API Route Handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('body',body)
    const { prompt, style, subType, model, history = [] } = body as {
      prompt: string;
      style: Style;
      subType: SubType;
      model?: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // Build augmented prompt with MCP context
    const [augmentedPrompt, systemPrompt] = await Promise.all([
      buildAugmentedPrompt(prompt, style, subType),
      getSystemPrompt(),
    ]);

    // Build provider-neutral messages list
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: augmentedPrompt },
    ];

    // Stream from whichever provider is available
    const encoder = new TextEncoder();
    const { provider, client, model: resolvedModel } = getProvider(model);
    console.log(`[generate] provider=${provider} model=${resolvedModel}`);
    console.log(`[generate] ANTHROPIC_API_KEY=${!!process.env.ANTHROPIC_API_KEY} OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
    console.log("─────────────────────────────────────────────");
    console.log("[generate] SYSTEM PROMPT (first 300 chars):\n" + systemPrompt.slice(0, 300));
    console.log("─────────────────────────────────────────────");
    console.log("[generate] AUGMENTED PROMPT:\n" + augmentedPrompt);
    console.log("─────────────────────────────────────────────");
    console.log(`[generate] MESSAGES SENT (${messages.length} total):`);
    messages.forEach((m, i) =>
      console.log(`  [${i}] role=${m.role} | ${String(m.content).slice(0, 120)}${String(m.content).length > 120 ? "..." : ""}`)
    );
    console.log("─────────────────────────────────────────────");

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (provider === "anthropic") {
            // ── Anthropic streaming ──
            const anthropicStream = (client as Anthropic).messages.stream({
              model: resolvedModel,
              max_tokens: 4096,
              system: systemPrompt,
              messages: messages as Anthropic.MessageParam[],
            });
            for await (const chunk of anthropicStream) {
              if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
          } else {
            // ── OpenAI streaming fallback ──
            const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: "system", content: systemPrompt },
              ...messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
                const text = typeof m.content === "string" ? m.content : "";
                return m.role === "assistant"
                  ? { role: "assistant", content: text }
                  : { role: "user", content: text };
              }),
            ];
            const isReasoning = resolvedModel.includes("gpt-5") || resolvedModel.includes("o1") || resolvedModel.includes("o3");
            const openaiStream = await (client as OpenAI).chat.completions.create({
              model: resolvedModel,
              ...(isReasoning ? { max_completion_tokens: 4096 } : { max_tokens: 4096 }),
              stream: true,
              messages: openaiMessages,
            });
            for await (const chunk of openaiStream) {
              const text = chunk.choices[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error("[generate] stream error:", err);
          controller.enqueue(encoder.encode(`\n\n⚠️ **Lỗi AI:** ${errMsg}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
