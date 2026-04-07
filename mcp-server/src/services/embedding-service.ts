import OpenAI from "openai";

// Lazy-initialized OpenAI client
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Embed a text string using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}
