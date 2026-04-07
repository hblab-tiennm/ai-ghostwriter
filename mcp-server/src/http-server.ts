import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerSearchStyleExamples } from "./tools/search-style-examples.js";
import { registerGetStyleRules } from "./tools/get-style-rules.js";
import { registerAddPost } from "./tools/add-post.js";
import { getStyleRule, getValidSubTypes } from "./services/style-rules.js";
import { searchSimilarPosts, addPostToCollection, getCollectionName } from "./services/vector-store-service.js";

import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3001;

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "ghostwriter",
    version: "1.0.0",
  });
  registerSearchStyleExamples(server);
  registerGetStyleRules(server);
  registerAddPost(server);
  return server;
}

const app = express();

app.use(
  cors({
    origin: process.env.WEBAPP_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// Session map: sessionId → transport
const transports: Map<string, SSEServerTransport> = new Map();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "ghostwriter-mcp", version: "1.0.0", sessions: transports.size });
});

// ── REST Shortcut Endpoints (/tools/:name) ────────────────────
// Same-server clients (Next.js) call these directly.
// No SSE session overhead — service layer called directly.

app.post("/tools/get_style_rules", async (req, res) => {
  try {
    const { style, sub_type } = req.body as { style: string; sub_type: string };
    if (!style || !sub_type) {
      res.status(400).json({ error: "style and sub_type are required" });
      return;
    }
    const rule = getStyleRule(style, sub_type);
    if (!rule) {
      const valid = getValidSubTypes(style).join(", ");
      res.json({ result: `Unknown sub_type "${sub_type}" for style "${style}". Valid: ${valid}` });
      return;
    }
    res.json({ result: JSON.stringify(rule, null, 2) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/tools/search_style_examples", async (req, res) => {
  try {
    const { style, sub_type, query, top_k = 5 } = req.body as {
      style: string; sub_type: string; query: string; top_k?: number;
    };
    if (!style || !sub_type || !query) {
      res.status(400).json({ error: "style, sub_type, query are required" });
      return;
    }
    const collection = getCollectionName(style);
    let results = await searchSimilarPosts(collection, query, sub_type, top_k);
    if (results.length === 0) {
      results = await searchSimilarPosts(collection, query, "", top_k);
    }
    if (results.length === 0) {
      res.json({ result: `No examples found for style="${style}" sub_type="${sub_type}"` });
      return;
    }
    const formatted = results
      .map((r, i) => `--- Example ${i + 1} (${r.metadata.sub_type ?? sub_type}) ---\n${r.text}`)
      .join("\n\n");
    res.json({ result: formatted });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/tools/add_post", async (req, res) => {
  try {
    const { style, sub_type, id, text, title, project } = req.body as {
      style: string; sub_type: string; id: string; text: string;
      title?: string; project?: string;
    };
    if (!style || !sub_type || !id || !text) {
      res.status(400).json({ error: "style, sub_type, id, text are required" });
      return;
    }
    const collection = getCollectionName(style);
    const metadata: Record<string, string | number | boolean> = {
      style, sub_type, added_at: new Date().toISOString(),
    };
    if (title) metadata.title = title;
    if (project) metadata.project = project;

    await addPostToCollection(collection, id, text, metadata);
    res.json({ result: `✓ Added post id="${id}" to collection "${collection}"` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── MCP SSE Protocol (for Claude CLI / MCP clients) ──────────
app.get("/sse", async (req, res) => {
  const server = createMcpServer();
  // SSEServerTransport auto-assigns a sessionId and sends it as "endpoint" event
  const transport = new SSEServerTransport("/message", res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  res.on("close", () => {
    transports.delete(sessionId);
  });

  await server.connect(transport);
});

// JSON-RPC messages from client — must include ?sessionId=<id>
app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId query parameter" });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: `Session "${sessionId}" not found or expired` });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`✅ Ghostwriter MCP HTTP Server running at http://localhost:${PORT}`);
  console.log(`   REST tools    : POST http://localhost:${PORT}/tools/{get_style_rules|search_style_examples|add_post}`);
  console.log(`   SSE endpoint  : GET  http://localhost:${PORT}/sse`);
  console.log(`   Message relay : POST http://localhost:${PORT}/message?sessionId=<id>`);
  console.log(`   Health check  : GET  http://localhost:${PORT}/health`);
});
