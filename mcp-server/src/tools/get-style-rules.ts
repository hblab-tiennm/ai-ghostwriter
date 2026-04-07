import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStyleRule, getValidSubTypes } from "../services/style-rules.js";

/**
 * MCP tool: get_style_rules
 * Returns the static writing style rules for a given style + sub_type.
 * Claude uses this JSON to guide content generation tone, structure, length.
 */
export function registerGetStyleRules(server: McpServer): void {
  server.tool(
    "get_style_rules",
    "Get writing style rules (tone, structure, length, emoji usage) for a given style and sub_type",
    {
      style: z.enum(["facebook_post", "news"]).describe("Writing style"),
      sub_type: z.string().describe(
        "Sub-type e.g. lifestyle_philosophy, project_announcement, market_insight, testimonial_story, project_news, market_analysis, policy_update, company_update"
      ),
    },
    async ({ style, sub_type }) => {
      const rule = getStyleRule(style, sub_type);

      if (!rule) {
        const validSubTypes = getValidSubTypes(style).join(", ");
        return {
          content: [{
            type: "text",
            text: `Unknown sub_type "${sub_type}" for style "${style}". Valid sub_types: ${validSubTypes}`,
          }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(rule, null, 2) }],
      };
    }
  );
}
