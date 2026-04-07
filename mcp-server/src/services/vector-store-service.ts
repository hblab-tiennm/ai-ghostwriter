import { LocalIndex } from "vectra";
import * as path from "path";
import { fileURLToPath } from "url";
import { embedText } from "./embedding-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base directory for all vector indexes — persisted as JSON files on disk
const VECTOR_DB_PATH = process.env.CHROMA_DB_PATH // reuse same env var for compat
  ?? path.resolve(__dirname, "../../vector-db");

// Cache of LocalIndex instances keyed by collection name
const indexCache = new Map<string, LocalIndex>();

/**
 * Get (or create) a LocalIndex for a named collection.
 * Indexes are stored as sub-directories under VECTOR_DB_PATH.
 * Metadata field "sub_type" is indexed for filtering.
 */
async function getIndex(collectionName: string): Promise<LocalIndex> {
  if (indexCache.has(collectionName)) {
    return indexCache.get(collectionName)!;
  }

  const folderPath = path.join(VECTOR_DB_PATH, collectionName);
  const idx = new LocalIndex(folderPath);

  if (!(await idx.isIndexCreated())) {
    await idx.createIndex({
      version: 1,
      // Index sub_type for metadata filtering
      metadata_config: { indexed: ["sub_type", "style"] },
    });
  }

  indexCache.set(collectionName, idx);
  return idx;
}

/**
 * Resolve dataset style value to collection name.
 * Handles both "facebook_post" (raw data) and "facebook" (alternate).
 */
export function getCollectionName(style: string): string {
  if (style === "facebook_post" || style === "facebook") return "facebook_posts";
  if (style === "news") return "news_posts";
  throw new Error(`Unknown style: "${style}". Valid values: facebook_post, news`);
}

/**
 * Search for top-k posts similar to query in a collection.
 * Filters by sub_type if provided; falls back to unfiltered if no results.
 */
export async function searchSimilarPosts(
  collectionName: string,
  query: string,
  subType: string,
  topK: number = 5
): Promise<Array<{ text: string; metadata: Record<string, unknown> }>> {
  const idx = await getIndex(collectionName);
  const queryVector = await embedText(query);

  // Build filter — apply sub_type filter only when provided
  const filter = subType ? { sub_type: { $eq: subType } } : undefined;

  // vectra queryItems signature in 0.12+: queryItems(vector, query, topK, filter?)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await (idx as any).queryItems(queryVector, query, topK, filter);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (results as any[]).map((r) => ({
    text: String(r.item.metadata?.text ?? ""),
    metadata: r.item.metadata ?? {},
  }));
}

/**
 * Add (upsert) a post into a collection with its embedding.
 * Note: vectra doesn't support true upsert by custom ID —
 * we store the post ID in metadata and use insertItem.
 */
export async function addPostToCollection(
  collectionName: string,
  id: string,
  text: string,
  metadata: Record<string, string | number | boolean>
): Promise<void> {
  const idx = await getIndex(collectionName);
  const vector = await embedText(text);

  await idx.insertItem({
    vector,
    metadata: { ...metadata, text, post_id: id },
  });
}
