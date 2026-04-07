import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addPostToCollection, getCollectionName } from "../services/vector-store-service.js";

/**
 * MCP tool: add_post
 * Adds (upserts) a new post/article to ChromaDB as a style example.
 * Used for the manual style memory loop — save edited posts back to dataset.
 */
export function registerAddPost(server: McpServer): void {
  server.tool(
    "add_post",
    "Add a new post or article to the vector database as a writing style example",
    {
      style: z.enum(["facebook_post", "news"]).describe("Writing style"),
      sub_type: z.string().describe("Sub-type classification e.g. lifestyle_philosophy"),
      id: z.string().describe("Unique ID for this post e.g. fb_002, news_052"),
      text: z.string().describe("Full post or article text to embed and store"),
      title: z.string().optional().describe("Title (recommended for news articles)"),
      project: z.string().optional().describe("Project name if content is project-specific"),
    },
    async ({ style, sub_type, id, text, title, project }) => {
      const collectionName = getCollectionName(style);

      // Build metadata — ChromaDB only accepts string | number | boolean values
      const metadata: Record<string, string | number | boolean> = {
        style,
        sub_type,
        added_at: new Date().toISOString(),
      };
      if (title) metadata.title = title;
      if (project) metadata.project = project;

      await addPostToCollection(collectionName, id, text, metadata);

      return {
        content: [{
          type: "text",
          text: `✓ Added post id="${id}" to collection "${collectionName}" (style=${style}, sub_type=${sub_type})`,
        }],
      };
    }
  );
}
