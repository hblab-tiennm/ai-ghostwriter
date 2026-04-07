import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchStyleExamples } from "./tools/search-style-examples.js";
import { registerGetStyleRules } from "./tools/get-style-rules.js";
import { registerAddPost } from "./tools/add-post.js";

// Load environment variables
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const server = new McpServer({
  name: "ghostwriter",
  version: "1.0.0",
});

// Register all MCP tools
registerSearchStyleExamples(server);
registerGetStyleRules(server);
registerAddPost(server);

// Connect via stdio transport (Claude Code CLI)
const transport = new StdioServerTransport();
await server.connect(transport);
