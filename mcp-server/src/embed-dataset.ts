/**
 * Dataset indexing script — indexes all JSON files from dataset/ into vectra local indexes.
 *
 * - Facebook posts: embeds `content` field (full text)
 * - News articles:  embeds `title + summary` (no full content in dataset)
 * - Re-run safe: each run creates fresh indexes (deleteIfExists: true)
 *
 * Usage (from mcp-server/ directory):
 *   cp .env.example .env   # fill in OPENAI_API_KEY
 *   npx ts-node --esm src/embed-dataset.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ── Bootstrap: load .env before any other imports ──────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

import OpenAI from "openai";
import { LocalIndex } from "vectra";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
// CHROMA_DB_PATH env var reused for vector-db path (backward compat)
const VECTOR_DB_PATH = process.env.CHROMA_DB_PATH ?? path.resolve(__dirname, "../../vector-db");
const DATASET_PATH = process.env.DATASET_PATH ?? path.resolve(__dirname, "../../dataset");

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set. Copy mcp-server/.env.example to mcp-server/.env and fill it in.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/** Embed text using OpenAI text-embedding-3-small (1536 dims) */
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

/** Resolve style to collection/index name */
function resolveCollectionName(style: string): string {
  if (style === "facebook_post" || style === "facebook") return "facebook_posts";
  if (style === "news") return "news_posts";
  throw new Error(`Unknown style: "${style}"`);
}

/** Extract the text to embed — facebook uses content, news uses full text (or title+summary fallback) */
function extractEmbedText(record: Record<string, unknown>): string {
  const style = String(record.style ?? "");
  if (style === "facebook_post" || style === "facebook") {
    return String(record.content ?? record.text ?? record.summary ?? "");
  }
  // News: prefer full text, fallback to title + summary
  const text = String(record.text ?? "").trim();
  if (text) return text;
  const title = String(record.title ?? "");
  const summary = String(record.summary ?? "");
  return `${title} ${summary}`.trim();
}

/** Create (or recreate) a fresh LocalIndex for a collection */
async function createFreshIndex(collectionName: string): Promise<LocalIndex> {
  const folderPath = path.join(VECTOR_DB_PATH, collectionName);
  const idx = new LocalIndex(folderPath);
  await idx.createIndex({
    version: 1,
    deleteIfExists: true, // wipe and recreate on each run
    metadata_config: { indexed: ["sub_type", "style"] },
  });
  return idx;
}

/** Index all JSON files in a directory into a pre-created LocalIndex */
async function indexDirectory(
  dir: string,
  indexes: Map<string, LocalIndex>
): Promise<number> {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return 0;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let totalIndexed = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const items: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : [parsed as Record<string, unknown>];

    console.log(`\n📂 ${file} — ${items.length} records`);

    for (const item of items) {
      const id = String(item.id ?? "");
      const style = String(item.style ?? "");

      if (!id || !style) {
        console.warn(`  ⚠️  Skipping record — missing id or style`);
        continue;
      }

      const text = extractEmbedText(item);
      if (!text.trim()) {
        console.warn(`  ⚠️  Skipping ${id} — no embeddable text`);
        continue;
      }

      const collectionName = resolveCollectionName(style);
      const idx = indexes.get(collectionName);
      if (!idx) {
        console.warn(`  ⚠️  No index for collection "${collectionName}", skipping ${id}`);
        continue;
      }

      // Build metadata (vectra accepts any value)
      const metadata: Record<string, string | number | boolean> = {
        post_id: id,
        text,
        style,
        sub_type: String(item.sub_type ?? ""),
        title: String(item.title ?? ""),
        source: String(item.source ?? ""),
      };
      if (item.project) metadata.project = String(item.project);
      if (item.url) metadata.url = String(item.url);

      const vector = await embed(text);
      await idx.insertItem({ vector, metadata });

      console.log(`  ✓ ${id} → ${collectionName} (${style}/${metadata.sub_type})`);
      totalIndexed++;
    }
  }

  return totalIndexed;
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log("🚀 Starting dataset indexing...");
console.log(`   Vector DB path: ${VECTOR_DB_PATH}`);
console.log(`   Dataset path:   ${DATASET_PATH}`);

// Create fresh indexes for both collections upfront
console.log("\n🗂️  Creating indexes...");
const indexes = new Map<string, LocalIndex>();
indexes.set("facebook_posts", await createFreshIndex("facebook_posts"));
indexes.set("news_posts", await createFreshIndex("news_posts"));
console.log("  ✓ facebook_posts index ready");
console.log("  ✓ news_posts index ready");

const fbCount = await indexDirectory(path.join(DATASET_PATH, "facebook"), indexes);
const newsCount = await indexDirectory(path.join(DATASET_PATH, "news"), indexes);

console.log(`\n✅ Indexing complete! Total: ${fbCount + newsCount} records`);
console.log(`   facebook_posts: ${fbCount}`);
console.log(`   news_posts:     ${newsCount}`);
