import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchSimilarPosts, getCollectionName } from "../services/vector-store-service.js";
import { getValidSubTypes } from "../services/style-rules.js";

/**
 * MCP tool: search_style_examples
 * Retrieves top-k similar posts from ChromaDB matching style + sub_type + query.
 * Falls back to unfiltered search if no results found for sub_type.
 */
export function registerSearchStyleExamples(server: McpServer): void {
  server.tool(
    "search_style_examples",
    "Retrieve similar posts matching a style and sub_type from the vector database to use as writing examples",
    {
      style: z.enum(["facebook_post", "news"]).describe("Writing style"),
      sub_type: z.string().describe(
        "Sub-type e.g. lifestyle_philosophy, project_announcement, market_insight, testimonial_story, project_news, market_analysis, policy_update, company_update"
      ),
      query: z.string().describe("Intent/topic summary to search similar posts (English or Vietnamese)"),
      top_k: z.number().int().min(1).max(10).default(5).describe("Number of results to return"),
    },
    async ({ style, sub_type, query, top_k }) => {
      const collectionName = getCollectionName(style);

      // Try with sub_type filter first
      let results = await searchSimilarPosts(collectionName, query, sub_type, top_k);

      // Fallback: search without sub_type filter if no results (e.g. sparse dataset)
      if (results.length === 0) {
        results = await searchSimilarPosts(collectionName, query, "", top_k);
      }

      if (results.length === 0) {
        const validSubTypes = getValidSubTypes(style).join(", ");
        return {
          content: [{
            type: "text",
            text: `No examples found for style="${style}" sub_type="${sub_type}". Valid sub_types: ${validSubTypes}`,
          }],
        };
      }

      const formatted = results
        .map((r, i) => `--- Example ${i + 1} (${r.metadata.sub_type ?? sub_type}) ---\n${r.text}`)
        .join("\n\n");

      return { content: [{ type: "text", text: formatted }] };
    }
  );
}
