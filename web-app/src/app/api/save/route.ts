import { NextRequest } from "next/server";

const MCP_BASE = process.env.MCP_SERVER_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { style, subType, id, text, title, project } = body;

    if (!style || !subType || !id || !text) {
      return Response.json({ error: "style, subType, id, text are required" }, { status: 400 });
    }

    const res = await fetch(`${MCP_BASE}/tools/add_post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style, sub_type: subType, id, text, title, project }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `MCP error: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    return Response.json({ ok: true, message: data.result ?? "Saved" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
